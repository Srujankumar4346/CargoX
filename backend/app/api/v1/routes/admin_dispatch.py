from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
import uuid
from datetime import datetime, timezone

from app.api.deps import get_current_admin
from app.models.user import User
from app.models.delivery import Trip, DeliveryRequest
from app.models.fleet import VehicleAssignment
from app.models.enums import DeliveryRequestStatus, InvoiceStatus
from app.schemas.dispatch import DispatchRequest, DispatchRead
from app.schemas.delivery_request import DeliveryRequestRead, CancelRequestSchema
from app.schemas.tracking_delivery import PODRead
from app.services.dispatch_service import DispatchService
from app.services.tracking_delivery_service import TrackingDeliveryService

router = APIRouter()

@router.get("/requests", response_model=list[DeliveryRequestRead])
async def list_requests(
    current_admin: User = Depends(get_current_admin),
    ):
    """
    List all delivery requests for admin dashboard.
    """
    return await DeliveryRequest.find_all().sort("-created_at").to_list()

class DeliveryRequestApprove(BaseModel):
    distance_km: Optional[Decimal] = Field(None, gt=Decimal("0"), description="Optional admin-approved distance in km")

@router.post("/requests/{request_id}/approve", response_model=DeliveryRequestRead)
async def approve_request(
    request_id: uuid.UUID,
    payload: Optional[DeliveryRequestApprove] = None,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Approves a delivery request, transitioning it from SUBMITTED to ACCEPTED.
    Under the approved direct-booking workflow, an accepted quotation is established
    using the active PricingConfig at approval time if none exists yet.
    """
    req = await DeliveryRequest.find_one(DeliveryRequest.id == request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.status != DeliveryRequestStatus.SUBMITTED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot approve request in {req.status} status")

    # If admin provided distance_km or request has no distance, apply approved distance
    if payload and payload.distance_km is not None and payload.distance_km > 0:
        req.distance_km = payload.distance_km
    
    # 1. Check whether an accepted quotation already exists for this request
    from app.models.pricing import Quotation
    from app.models.enums import QuotationStatus
    from app.services.pricing_engine import PricingEngineService
    from decimal import Decimal
    from datetime import timedelta

    existing_quote = await Quotation.find_one(Quotation.request_id == req.id)
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if existing_quote:
        if existing_quote.status != QuotationStatus.ACCEPTED:
            existing_quote.status = QuotationStatus.ACCEPTED
            existing_quote.accepted_at = now
            await existing_quote.save()
    else:
        # Direct Admin Booking Workflow: snapshot active PricingConfig at approval time
        active_config = await PricingEngineService.get_active_pricing_config()
        
        # Ensure a valid distance exists
        if req.distance_km is None or req.distance_km <= 0:
            if (
                req.pickup_lat is not None and req.pickup_lng is not None and
                req.destination_lat is not None and req.destination_lng is not None
            ):
                from app.api.v1.routes.requests import _haversine_road_distance
                req.distance_km = _haversine_road_distance(
                    req.pickup_lat, req.pickup_lng,
                    req.destination_lat, req.destination_lng
                )
                await req.save()
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot approve request without an actual approved distance",
                )

        # Calculate the snapshot from the approved request distance.
        dist = Decimal(str(req.distance_km))
        base_rate = Decimal(str(active_config.base_rate_per_km))
        margin_rate = Decimal(str(active_config.margin_per_km))
        
        internal_base_cost = (dist * base_rate).quantize(Decimal("0.01"))
        cargox_margin = (dist * margin_rate).quantize(Decimal("0.01"))
        customer_total_charge = internal_base_cost + cargox_margin
        
        from app.services.settings_service import SettingsService
        system_settings = await SettingsService.get_settings()
        fee_pct = system_settings.cargox_service_fee_percentage
        service_fee = (customer_total_charge * fee_pct / Decimal("100")).quantize(Decimal("0.01"))
        driver_payable = customer_total_charge - service_fee
        
        quotation = Quotation(
            request_id=req.id,
            pricing_config_id=active_config.id,
            distance_km=dist,
            base_rate_per_km=base_rate,
            internal_base_cost=internal_base_cost,
            cargox_margin=cargox_margin,
            customer_total_charge=customer_total_charge,
            service_fee_percentage=fee_pct,
            service_fee_amount=service_fee,
            driver_payable_amount=driver_payable,
            status=QuotationStatus.ACCEPTED,
            created_at=now,
            accepted_at=now,
            expires_at=now + timedelta(days=30),
        )
        await quotation.insert()

    req.status = DeliveryRequestStatus.ACCEPTED
    await req.save()
    return req


@router.post("/requests/{request_id}/cancel", response_model=DeliveryRequestRead)
async def cancel_request_admin(
    request_id: uuid.UUID,
    payload: Optional[CancelRequestSchema] = None,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Admin: Cancels a delivery request based on a mandatory reason.
    Releases assigned vehicle and driver if any, and rejects associated quotations.
    """
    reason = payload.reason if payload else None
    if not reason or not reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A cancellation reason is required for admin cancellation."
        )

    req = await DeliveryRequest.find_one(DeliveryRequest.id == request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

    if req.status in [DeliveryRequestStatus.DELIVERED, DeliveryRequestStatus.COMPLETED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a request that is already {req.status.value}"
        )
    if req.status in [DeliveryRequestStatus.CUSTOMER_CANCELLED, DeliveryRequestStatus.REJECTED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Request is already in {req.status.value} status"
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # If a trip was already created, release assignments and mark trip completed/cancelled
    trip = await Trip.find_one(Trip.request_id == req.id)
    if trip:
        from app.models.fleet import VehicleAssignment, Vehicle, Driver
        from app.models.enums import VehicleStatus, DriverStatus
        assignment = await VehicleAssignment.find_one(
            VehicleAssignment.trip_id == trip.id,
            VehicleAssignment.released_at == None
        )
        if assignment:
            assignment.released_at = now
            await assignment.save()
            vehicle = await Vehicle.find_one(Vehicle.id == assignment.vehicle_id)
            if vehicle and vehicle.status == VehicleStatus.ASSIGNED:
                vehicle.status = VehicleStatus.AVAILABLE
                await vehicle.save()
            driver = await Driver.find_one(Driver.id == assignment.driver_id)
            if driver and driver.status == DriverStatus.ON_TRIP:
                driver.status = DriverStatus.AVAILABLE
                await driver.save()

    # Reject any active quotations
    from app.models.pricing import Quotation
    from app.models.enums import QuotationStatus
    quotations = await Quotation.find(Quotation.request_id == req.id).to_list()
    for q in quotations:
        if q.status != QuotationStatus.REJECTED:
            q.status = QuotationStatus.REJECTED
            await q.save()

    req.status = DeliveryRequestStatus.REJECTED
    req.cancellation_reason = f"[Admin Cancelled]: {reason.strip()}"
    req.updated_at = now
    await req.save()
    return req


@router.post("/requests/{request_id}/dispatch", response_model=DispatchRead, status_code=status.HTTP_201_CREATED)
async def dispatch_request(
    request_id: uuid.UUID,
    dispatch_in: DispatchRequest,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Dispatches an ACCEPTED delivery request by assigning a vehicle and driver.
    Requires Admin privileges. Employs row-level locking for concurrency safety.
    """
    return await DispatchService.dispatch_request(request_id, dispatch_in, current_admin)

@router.put("/requests/{request_id}/reassign", response_model=DispatchRead)
async def reassign_request(
    request_id: uuid.UUID,
    dispatch_in: DispatchRequest,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Reassigns vehicle and driver for an unstarted trip.
    Preserves audit history on the previous assignment. Requires Admin privileges.
    """
    return await DispatchService.reassign_request(request_id, dispatch_in, current_admin)

@router.get("/trips")
async def list_trips(
    current_admin: User = Depends(get_current_admin),
    ):
    """
    List all trips for admin dashboard.
    """
    trips = await Trip.find_all().sort("-assigned_at").to_list()
    results = []
    for trip in trips:
        req = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
        results.append({
            "id": trip.id,
            "request_id": trip.request_id,
            "assigned_at": trip.assigned_at,
            "current_lat": trip.current_lat,
            "current_lng": trip.current_lng,
            "status": req.status.value if req else None,
            "request": {
                "id": req.id if req else None,
                "request_number": req.request_number if req else None,
                "pickup_company_name": req.pickup_company_name if req else None,
                "pickup_address": req.pickup_address if req else None,
                "destination_company_name": req.destination_company_name if req else None,
                "destination_address": req.destination_address if req else None,
                "weight_tons": req.weight_tons if req else None,
                "goods_type": req.goods_type if req else None,
            } if req else None
        })
    return results

@router.get("/trips/{trip_id}")
async def get_trip_detail(
    trip_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Gets details of a trip and its assignment. Requires Admin privileges.
    """
    trip = await Trip.find_one(Trip.id == trip_id)
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    assignment = await VehicleAssignment.find_one(
        VehicleAssignment.trip_id == trip.id,
        VehicleAssignment.released_at == None
    )
    if not assignment:
        # If trip is completed/delivered and assignment was released, get the latest assignment for this trip
        assignment = await VehicleAssignment.find_one(
            VehicleAssignment.trip_id == trip.id,
            sort=[("assigned_at", -1)]
        )
    # Load full invoice and payment tracking records
    from app.models.finance import Invoice, Payment
    from app.models.company import CustomerCompany
    from app.models.fleet import Driver, Vehicle

    request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
    customer_company = await CustomerCompany.find_one(CustomerCompany.id == request.customer_company_id) if request and request.customer_company_id else None
    invoice = await Invoice.find_one(Invoice.request_id == trip.request_id)

    payments_list = []
    if invoice:
        raw_payments = await Payment.find(Payment.invoice_id == invoice.id).sort("-paid_at").to_list()
        # Collect recording drivers/admins
        recorder_ids = list({p.recorded_by for p in raw_payments if p.recorded_by})
        recorders = await User.find({"_id": {"$in": recorder_ids}}).to_list() if recorder_ids else []
        recorder_by_id = {u.id: u.email for u in recorders}

        for p in raw_payments:
            payments_list.append({
                "payment_id": str(p.id),
                "invoice_id": str(p.invoice_id),
                "amount": float(p.amount),
                "payment_method": p.method.value if hasattr(p.method, "value") else str(p.method),
                "provider_payment_id": p.gateway_payment_id,
                "provider_order_id": p.gateway_order_id,
                "collection_reference": p.reference_number,
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
                "recorded_by_id": str(p.recorded_by) if p.recorded_by else None,
                "recorded_by_email": recorder_by_id.get(p.recorded_by),
                "notes": p.notes,
            })

    # Resolve driver and vehicle details
    vehicle_obj = await Vehicle.find_one(Vehicle.id == assignment.vehicle_id) if assignment else None
    driver_obj = await Driver.find_one(Driver.id == assignment.driver_id) if assignment else None

    # Load Proof of Delivery details
    from app.models.delivery import ProofOfDelivery
    pod_obj = await ProofOfDelivery.find_one(ProofOfDelivery.trip_id == trip.id)
    pod_data = None
    if pod_obj:
        sub_driver = await Driver.find_one(Driver.user_id == pod_obj.submitted_by) if pod_obj.submitted_by else None
        if not sub_driver and pod_obj.submitted_by:
            sub_driver = await Driver.find_one(Driver.id == pod_obj.submitted_by)
        sub_user = await User.find_one(User.id == pod_obj.submitted_by) if pod_obj.submitted_by else None
        sub_name = sub_driver.name if sub_driver else (sub_user.email if sub_user else "Driver")

        ver_user = await User.find_one(User.id == pod_obj.verified_by) if pod_obj.verified_by else None

        pod_data = {
            "id": str(pod_obj.id),
            "trip_id": str(pod_obj.trip_id),
            "receiver_name": pod_obj.receiver_name,
            "receiver_phone": pod_obj.receiver_phone,
            "delivery_confirmed": getattr(pod_obj, "delivery_confirmed", True),
            "status": getattr(pod_obj, "status", "SUBMITTED"),
            "rejection_reason": getattr(pod_obj, "rejection_reason", None),
            "file_url": pod_obj.file_url,
            "pod_signature_url": pod_obj.file_url if "sig" in pod_obj.file_url else None,
            "pod_photo_url": pod_obj.file_url if "sig" not in pod_obj.file_url else None,
            "notes": pod_obj.notes,
            "submitted_at": pod_obj.submitted_at.isoformat() if pod_obj.submitted_at else None,
            "submitted_by": str(pod_obj.submitted_by) if pod_obj.submitted_by else None,
            "submitted_by_name": sub_name,
            "verified_at": pod_obj.verified_at.isoformat() if getattr(pod_obj, "verified_at", None) else None,
            "verified_by": str(pod_obj.verified_by) if getattr(pod_obj, "verified_by", None) else None,
            "verified_by_email": ver_user.email if ver_user else None,
        }

    return {
        "id": trip.id,
        "request_id": trip.request_id,
        "delivery_request_number": request.request_number if request else None,
        "customer_company_name": customer_company.name if customer_company else (request.pickup_company_name if request else None),
        "assigned_at": trip.assigned_at,
        "current_lat": trip.current_lat,
        "current_lng": trip.current_lng,
        "started_at": trip.started_at,
        "arrived_at": trip.arrived_at,
        "delivered_at": trip.delivered_at,
        "completed_at": trip.completed_at,
        "trip_status": request.status.value if request else None,
        "assignment": assignment,
        "vehicle": {
            "id": str(vehicle_obj.id) if vehicle_obj else None,
            "registration_number": vehicle_obj.registration_number if vehicle_obj else None,
            "type": vehicle_obj.type.value if vehicle_obj and hasattr(vehicle_obj.type, "value") else (str(vehicle_obj.type) if vehicle_obj else None),
            "capacity_tons": vehicle_obj.capacity_tons if vehicle_obj else None,
        } if vehicle_obj else None,
        "driver": {
            "id": str(driver_obj.id) if driver_obj else None,
            "name": driver_obj.name if driver_obj else None,
            "phone": driver_obj.phone if driver_obj else None,
        } if driver_obj else None,
        "pod": pod_data,
        "invoice": {
            "invoice_id": str(invoice.id) if invoice else None,
            "invoice_number": invoice.invoice_number if invoice else None,
            "total_amount": float(invoice.total_amount) if invoice else None,
            "amount_paid": float(invoice.amount_paid) if invoice else 0.0,
            "amount_due": float(invoice.amount_due) if invoice else None,
            "invoice_status": invoice.status.value if invoice else None,
            "payment_method": invoice.payment_method.value if invoice and invoice.payment_method and hasattr(invoice.payment_method, "value") else (str(invoice.payment_method) if invoice and invoice.payment_method else None),
            "payment_intent_status": invoice.payment_intent_status if invoice else None,
            "gateway_order_id": invoice.gateway_order_id if invoice else None,
            "gateway_payment_id": invoice.gateway_payment_id if invoice else None,
            "is_fully_paid": (invoice.status == InvoiceStatus.PAID) if invoice else False,
            "payments": payments_list,
        } if invoice else None
    }

@router.get("/trips/{trip_id}/location")
async def get_trip_location_history(
    trip_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Returns GPS breadcrumb location history for an active or completed trip.
    """
    from app.models.delivery import LocationHistory
    trip = await Trip.find_one(Trip.id == trip_id)
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    breadcrumbs = await LocationHistory.find(
        LocationHistory.trip_id == trip.id
    ).sort("-recorded_at").limit(500).to_list()

    return [
        {
            "id": str(b.id),
            "trip_id": str(b.trip_id),
            "lat": b.lat,
            "lng": b.lng,
            "latitude": b.lat,
            "longitude": b.lng,
            "recorded_at": b.recorded_at.isoformat() if b.recorded_at else None
        }
        for b in breadcrumbs
    ]

@router.post("/trips/{trip_id}/verify-pod", response_model=PODRead)
async def verify_pod(
    trip_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Verifies POD for a POD_SUBMITTED trip, transitioning request status to DELIVERED and setting delivered_at timestamp.
    Requires Admin privileges.
    """
    return await TrackingDeliveryService.verify_pod(trip_id, current_admin)

@router.post("/trips/{trip_id}/reject-pod", response_model=PODRead)
async def reject_pod(
    trip_id: uuid.UUID,
    rejection: Optional[dict] = None,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Rejects POD for a POD_SUBMITTED trip, recording rejection reason and returning trip to ARRIVED status
    so the driver can correct and resubmit.
    Requires Admin privileges.
    """
    reason = (rejection or {}).get("rejection_reason", "Proof of delivery document rejected by admin.")
    return await TrackingDeliveryService.reject_pod(trip_id, reason, current_admin)

@router.post("/trips/{trip_id}/complete")
async def complete_trip(
    trip_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Completes a DELIVERED trip, transitioning request status to COMPLETED, setting completed_at timestamp,
    and releasing committed Vehicle and Driver resources back to AVAILABLE.
    Requires Admin privileges.
    """
    trip = await TrackingDeliveryService.complete_trip(trip_id, current_admin)
    return {
        "id": trip.id,
        "request_id": trip.request_id,
        "completed_at": trip.completed_at,
        "status": "COMPLETED"
    }

@router.post("/trips/{trip_id}/admin-force-complete")
async def admin_force_complete(
    trip_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Admin-only: Force-completes any active trip regardless of current status.
    Sets all missing timestamps, releases resources, and auto-generates invoice.
    Bypasses POD requirement for admin convenience.
    """
    from app.models.finance import Invoice
    from app.models.pricing import Quotation
    from app.models.enums import QuotationStatus, InvoiceStatus
    from app.schemas.invoice import InvoiceCreate
    from app.services.invoice_service import InvoiceService
    from decimal import Decimal
    import random

    trip = await Trip.find_one(Trip.id == trip_id)
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

    # Skip if already completed
    if request.status == DeliveryRequestStatus.COMPLETED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trip is already completed")

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Set all missing timestamps so tracking timeline shows correctly
    if not trip.started_at:
        trip.started_at = now
    if not trip.arrived_at:
        trip.arrived_at = now
    if not trip.delivered_at:
        trip.delivered_at = now
    trip.completed_at = now

    # Mark request as COMPLETED
    request.status = DeliveryRequestStatus.COMPLETED
    await trip.save()
    await request.save()

    # Release vehicle and driver
    from app.models.fleet import VehicleAssignment
    from app.models.enums import VehicleStatus, DriverStatus
    from app.models.fleet import Vehicle, Driver
    assignment = await VehicleAssignment.find_one(
        VehicleAssignment.trip_id == trip.id,
        VehicleAssignment.released_at == None
    )
    if assignment:
        assignment.released_at = now
        await assignment.save()
        vehicle = await Vehicle.find_one(Vehicle.id == assignment.vehicle_id)
        if vehicle:
            vehicle.status = VehicleStatus.AVAILABLE
            await vehicle.save()
        driver = await Driver.find_one(Driver.id == assignment.driver_id)
        if driver:
            driver.status = DriverStatus.AVAILABLE
            await driver.save()

    # Auto-generate invoice from the immutable accepted quotation
    try:
        await InvoiceService.generate_invoice(trip.id, InvoiceCreate(), current_admin)
    except Exception as e:
        import logging
        logging.getLogger("cargox").error(f"[admin-force-complete] Invoice generation error for trip {trip.id}: {e}")

    return {
        "id": trip.id,
        "request_id": request.id,
        "status": "COMPLETED",
        "completed_at": trip.completed_at,
        "message": "Trip completed and invoice generated successfully"
    }

@router.post("/trips/{trip_id}/mark-in-transit")
async def mark_in_transit(
    trip_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Admin: Advance trip status to IN_TRANSIT and set started_at timestamp.
    """
    trip = await Trip.find_one(Trip.id == trip_id)
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    trip.started_at = now
    request.status = DeliveryRequestStatus.IN_TRANSIT
    await trip.save()
    await request.save()

    return {"id": trip.id, "status": "IN_TRANSIT", "started_at": now}


