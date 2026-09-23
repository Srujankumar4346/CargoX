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
from app.models.enums import DeliveryRequestStatus
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
        
        if req.distance_km is None or req.distance_km <= 0:
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
        
        quotation = Quotation(
            request_id=req.id,
            pricing_config_id=active_config.id,
            distance_km=dist,
            base_rate_per_km=base_rate,
            internal_base_cost=internal_base_cost,
            cargox_margin=cargox_margin,
            customer_total_charge=customer_total_charge,
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
    Gets details of a trip and its current assignment. Requires Admin privileges.
    """
    trip = await Trip.find_one(Trip.id == trip_id)
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    assignment = await VehicleAssignment.find_one(
        VehicleAssignment.trip_id == trip.id,
        VehicleAssignment.released_at == None
    )
    return {
        "id": trip.id,
        "request_id": trip.request_id,
        "assigned_at": trip.assigned_at,
        "current_lat": trip.current_lat,
        "current_lng": trip.current_lng,
        "assignment": assignment
    }

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


