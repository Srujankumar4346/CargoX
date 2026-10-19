from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
import uuid
from datetime import datetime, timezone

from app.api.deps import get_current_admin
from app.models.user import User
from app.models.delivery import Trip, DeliveryRequest, TripStop
from app.models.fleet import VehicleAssignment
from app.models.enums import DeliveryRequestStatus, InvoiceStatus
from app.schemas.dispatch import DispatchRequest, DispatchRead, ConsolidatedDispatchRequest, ConsolidatedDispatchRead
from app.schemas.delivery_request import DeliveryRequestRead, CancelRequestSchema
from app.schemas.tracking_delivery import PODRead
from app.schemas.delivery_otp import (
    DeliveryOTPAdminOverrideRequest,
    DeliveryOTPAdminOverrideResponse,
    DeliveryOTPStatusResponse,
)
from app.services.dispatch_service import DispatchService
from app.services.tracking_delivery_service import TrackingDeliveryService
from app.services.delivery_otp_service import DeliveryOTPService

router = APIRouter()

@router.get("/requests", response_model=list[DeliveryRequestRead])
async def list_requests(
    load_type: Optional[str] = None,
    status_filter: Optional[str] = None,
    pickup_city: Optional[str] = None,
    destination_city: Optional[str] = None,
    current_admin: User = Depends(get_current_admin),
):
    """
    List all delivery requests for admin dashboard enriched with authoritative accepted quotation.
    Supports filtering by load_type (e.g. PART_LOAD), status, and geographic areas.
    """
    from app.models.pricing import Quotation
    query: dict = {}
    if load_type:
        query["load_type"] = load_type.upper()
    if status_filter:
        query["status"] = status_filter.upper()
    if pickup_city:
        query["pickup_address"] = {"$regex": pickup_city, "$options": "i"}
    if destination_city:
        query["destination_address"] = {"$regex": destination_city, "$options": "i"}

    requests = await DeliveryRequest.find(query).sort("-created_at").to_list()
    
    # Batch fetch quotations for these requests
    req_ids = [r.id for r in requests]
    quotes = await Quotation.find({"request_id": {"$in": req_ids}}).to_list()
    quote_by_req: dict[uuid.UUID, Quotation] = {}
    for q in quotes:
        # Prefer accepted quote, or latest
        if q.request_id not in quote_by_req or q.status.value == "ACCEPTED":
            quote_by_req[q.request_id] = q

    results = []
    for r in requests:
        q = quote_by_req.get(r.id)
        quote_data = None
        if q:
            quote_data = {
                "id": str(q.id),
                "quotation_number": f"QUO-{q.created_at.year}-{str(q.id)[:8].upper()}",
                "status": q.status.value if hasattr(q.status, "value") else str(q.status),
                "distance_km": float(q.distance_km),
                "base_rate_per_km": float(q.base_rate_per_km),
                "internal_base_cost": float(q.internal_base_cost),
                "cargox_margin": float(q.cargox_margin),
                "base_fare": float(q.base_fare or 0),
                "distance_charge": float(q.distance_charge or 0),
                "capacity_surcharge": float(q.capacity_surcharge or 0),
                "handling_surcharge": float(q.handling_surcharge or 0),
                "customer_total_charge": float(q.customer_total_charge),
                "service_fee_percentage": float(q.service_fee_percentage) if q.service_fee_percentage is not None else None,
                "service_fee_amount": float(q.service_fee_amount) if q.service_fee_amount is not None else None,
                "driver_payable_amount": float(q.driver_payable_amount) if q.driver_payable_amount is not None else None,
                "selected_vehicle_id": q.selected_vehicle_id,
                "created_at": q.created_at.isoformat() if q.created_at else None,
                "accepted_at": q.accepted_at.isoformat() if q.accepted_at else None,
            }

        # Convert to DeliveryRequestRead model with attached quotation
        item = DeliveryRequestRead.model_validate(r)
        item.quotation = quote_data
        if quote_data and "customer_total_charge" in quote_data:
            item.final_price = quote_data["customer_total_charge"]
            item.estimated_price = quote_data["customer_total_charge"]
        elif r.booked_price:
            item.final_price = float(r.booked_price)
            item.estimated_price = float(r.booked_price)
        elif r.customer_booked_price:
            item.final_price = float(r.customer_booked_price)
            item.estimated_price = float(r.customer_booked_price)
        results.append(item)

    return results

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

        # Calculate the snapshot from the approved request distance and cargo requirements
        dist = Decimal(str(req.distance_km))
        base_rate = Decimal(str(active_config.base_rate_per_km))
        margin_rate = Decimal(str(active_config.margin_per_km))
        
        internal_base_cost = (dist * base_rate).quantize(Decimal("0.01"))
        cargox_margin = (dist * margin_rate).quantize(Decimal("0.01"))

        # Calculate surcharges
        base_flat = Decimal(str(getattr(active_config, "base_flat_fare", Decimal("500.00"))))
        distance_charge = ((base_rate + margin_rate) * dist).quantize(Decimal("0.01"))

        # Calculate surcharges if applicable
        capacity_surcharge = Decimal("0.00")
        handling_surcharge = Decimal("0.00")

        # 1. Capacity surcharge based on admin configured threshold & enabled flag
        req_weight = float(req.weight_tons or 0)
        veh_cap = 2.0
        cap_enabled = getattr(active_config, "capacity_surcharge_enabled", True)
        cap_threshold_pct = float(getattr(active_config, "capacity_utilization_threshold_percent", Decimal("85.00")))
        if cap_enabled and (req_weight / veh_cap * 100.0) >= cap_threshold_pct:
            capacity_surcharge = Decimal(str(getattr(active_config, "vehicle_max_capacity_surcharge", Decimal("600.00"))))

        # 2. Handling care surcharge based on admin enabled flags
        special_str = f"{req.special_instructions or ''} {req.goods_description or ''} {req.goods_type or ''}".lower()
        if getattr(active_config, "fragile_surcharge_enabled", True) and ("fragile" in special_str or "delicate" in special_str or "handle with care" in special_str):
            handling_surcharge += Decimal(str(getattr(active_config, "fragile_surcharge", Decimal("400.00"))))
        elif getattr(active_config, "hazardous_surcharge_enabled", True) and ("hazardous" in special_str or "sensitive" in special_str):
            handling_surcharge += Decimal(str(getattr(active_config, "hazardous_surcharge", Decimal("700.00"))))
        elif getattr(active_config, "refrigerated_surcharge_enabled", True) and ("refrigerated" in special_str or "cold" in special_str):
            handling_surcharge += Decimal(str(getattr(active_config, "refrigerated_surcharge", Decimal("800.00"))))

        customer_total_charge = base_flat + distance_charge + capacity_surcharge + handling_surcharge
        
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
            base_fare=base_flat,
            distance_charge=distance_charge,
            capacity_surcharge=capacity_surcharge,
            handling_surcharge=handling_surcharge,
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

@router.post("/dispatch/consolidated", response_model=ConsolidatedDispatchRead, status_code=status.HTTP_201_CREATED)
async def dispatch_consolidated_requests(
    dispatch_in: ConsolidatedDispatchRequest,
    current_admin: User = Depends(get_current_admin),
):
    """
    Consolidates multiple Part Load customer delivery requests into a single shared vehicle Trip
    with an ordered sequence of TripStops, verifying combined cargo weight against vehicle capacity.
    """
    return await DispatchService.dispatch_consolidated_requests(dispatch_in, current_admin)

@router.get("/consolidation/smart-groups")
async def get_smart_consolidation_groups(
    current_admin: User = Depends(get_current_admin),
):
    """
    Computes intelligent Part Load consolidation suggestions based on:
    - Same pickup/destination corridors
    - Pickup & delivery geographic proximity
    - Combined payload vs typical fleet vehicle payload (e.g. 2.0 - 5.0 Tons)
    - Delivery window and handling compatibility
    """
    from app.models.delivery import DeliveryRequest, Trip
    from app.models.pricing import Quotation
    import math

    # 1. Fetch all eligible Part Load requests
    eligible_statuses = [
        DeliveryRequestStatus.ACCEPTED,
        DeliveryRequestStatus.SUBMITTED,
        DeliveryRequestStatus.QUOTED,
        DeliveryRequestStatus.UNDER_REVIEW,
    ]
    raw_reqs = await DeliveryRequest.find(
        {"status": {"$in": [s.value for s in eligible_statuses]}}
    ).to_list()

    # Filter by load_type == PART_LOAD (or fallback to <= 2.5 Tons if legacy)
    eligible_requests = []
    for r in raw_reqs:
        is_pl = (r.load_type == "PART_LOAD") or (r.weight_tons is not None and r.weight_tons <= 2.5)
        if is_pl:
            # Exclude if already assigned to a trip
            existing_trip = await Trip.find_one({"$or": [{"request_id": r.id}, {"request_ids": r.id}]})
            if not existing_trip:
                eligible_requests.append(r)

    if not eligible_requests:
        return {"groups": [], "total_eligible": 0}

    # Helper: Normalize city or corridor name from address
    def extract_area(addr: str) -> str:
        if not addr:
            return "General Area"
        parts = [p.strip() for p in addr.split(",") if p.strip()]
        return parts[0] if parts else addr[:20]

    def haversine_km(lat1, lon1, lat2, lon2):
        if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
            return 999.0
        R = 6371.0
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lon2 - lon1)
        a = math.sin(dLat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    # Cluster requests by Corridor (Origin City -> Destination City)
    corridors: dict[str, list] = {}
    for r in eligible_requests:
        p_area = extract_area(r.pickup_address)
        d_area = extract_area(r.destination_address)
        corridor_key = f"{p_area} → {d_area}"
        if corridor_key not in corridors:
            corridors[corridor_key] = []
        corridors[corridor_key].append(r)

    suggested_groups = []
    group_idx = 1

    # Also build spatial clusters if multiple requests have nearby destinations (< 45 km)
    for corridor_name, reqs in corridors.items():
        total_kg = sum(round((r.weight_tons or 0.2) * 1000) for r in reqs)
        # Select recommended vehicle benchmark
        if total_kg <= 750:
            suggested_veh = "Tata Ace (750 kg)"
            capacity_kg = 750
        elif total_kg <= 1700:
            suggested_veh = "Bolero Pickup (1,700 kg)"
            capacity_kg = 1700
        elif total_kg <= 3500:
            suggested_veh = "14ft Truck (3,500 kg)"
            capacity_kg = 3500
        else:
            suggested_veh = "17ft Heavy Truck (6,000 kg)"
            capacity_kg = 6000

        utilization = min(100, round((total_kg / capacity_kg) * 100))

        # Check pickup & drop proximity among requests
        avg_detour_km = 0.0
        if len(reqs) > 1 and reqs[0].pickup_lat and reqs[1].pickup_lat:
            avg_detour_km = round(haversine_km(reqs[0].pickup_lat, reqs[0].pickup_lng, reqs[1].pickup_lat, reqs[1].pickup_lng) * 0.5, 1)

        reasons = [
            f"Matching transport corridor: {corridor_name}",
            f"{len(reqs)} compatible shipment(s) with combined payload {total_kg} kg",
            f"Estimated payload utilization: {utilization}% for {suggested_veh}",
        ]
        if avg_detour_km > 0:
            reasons.append(f"Minimal pickup detour: ~{avg_detour_km} km")

        suggested_groups.append({
            "id": f"group_{group_idx}",
            "group_name": f"Group {chr(64 + group_idx)} — {corridor_name}",
            "corridor": corridor_name,
            "request_ids": [str(r.id) for r in reqs],
            "request_numbers": [r.request_number for r in reqs],
            "shipment_count": len(reqs),
            "combined_weight_kg": total_kg,
            "suggested_vehicle": suggested_veh,
            "suggested_capacity_kg": capacity_kg,
            "utilization_pct": utilization,
            "route_compatibility": "High" if len(reqs) >= 2 else "Compatible",
            "delivery_window_status": "Confirmed (Aligned)",
            "estimated_detour_km": avg_detour_km,
            "reasons": reasons,
        })
        group_idx += 1

    return {
        "groups": suggested_groups,
        "total_eligible": len(eligible_requests),
    }

class RoutePreviewRequest(BaseModel):
    request_ids: list[uuid.UUID]
    vehicle_id: Optional[uuid.UUID] = None

@router.post("/consolidation/preview-route")
async def preview_consolidated_route(
    payload: RoutePreviewRequest,
    current_admin: User = Depends(get_current_admin),
):
    """
    Calculates ordered multi-stop sequence (Pickups -> Drops) with road distance,
    travel time, individual stops, and detour comparison using CargoX Route Engine.
    """
    from app.models.delivery import DeliveryRequest
    from app.models.fleet import Vehicle
    from app.services.intelligence.route_engine import fetch_osrm_routes

    if not payload.request_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No requests provided for preview")

    requests: list[DeliveryRequest] = []
    total_kg = 0
    for r_id in payload.request_ids:
        req = await DeliveryRequest.find_one(DeliveryRequest.id == r_id)
        if not req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Request {r_id} not found")
        requests.append(req)
        total_kg += round((req.weight_tons or 0.2) * 1000)

    # Sequence stops: Pickups first, then Drops
    stops = []
    seq = 1

    # Pickups
    for req in requests:
        stops.append({
            "stop_sequence": seq,
            "stop_type": "PICKUP",
            "request_id": str(req.id),
            "request_number": req.request_number,
            "company_name": req.pickup_company_name or "Sender Pickup",
            "address": req.pickup_address,
            "lat": req.pickup_lat,
            "lng": req.pickup_lng,
            "cargo_weight_kg": round((req.weight_tons or 0.2) * 1000),
            "goods_type": req.goods_type,
        })
        seq += 1

    # Drops
    for req in requests:
        stops.append({
            "stop_sequence": seq,
            "stop_type": "DROP",
            "request_id": str(req.id),
            "request_number": req.request_number,
            "company_name": req.destination_company_name or "Consignee Delivery",
            "address": req.destination_address,
            "lat": req.destination_lat,
            "lng": req.destination_lng,
            "cargo_weight_kg": round((req.weight_tons or 0.2) * 1000),
            "goods_type": req.goods_type,
        })
        seq += 1

    # Calculate road distance across stops if coordinates exist
    total_road_km = 0.0
    estimated_mins = 0
    waypoints = []

    for i in range(len(stops) - 1):
        s_curr = stops[i]
        s_next = stops[i + 1]
        if s_curr["lat"] and s_curr["lng"] and s_next["lat"] and s_next["lng"]:
            leg_routes = fetch_osrm_routes(s_curr["lat"], s_curr["lng"], s_next["lat"], s_next["lng"])
            if leg_routes and len(leg_routes) > 0:
                dist = leg_routes[0].get("distance", 0) / 1000.0
                dur = leg_routes[0].get("duration", 0) / 60.0
                total_road_km += dist
                estimated_mins += int(dur)
            else:
                # Direct fallback
                total_road_km += 25.0
                estimated_mins += 40
        else:
            total_road_km += 20.0
            estimated_mins += 35

    total_road_km = round(total_road_km, 1)

    # Check vehicle capacity if specified
    veh_cap_kg = None
    utilization_pct = None
    is_overloaded = False
    if payload.vehicle_id:
        veh = await Vehicle.find_one(Vehicle.id == payload.vehicle_id)
        if veh:
            veh_cap_kg = round(float(veh.capacity_tons) * 1000)
            utilization_pct = min(100, round((total_kg / veh_cap_kg) * 100))
            is_overloaded = total_kg > veh_cap_kg

    return {
        "stops": stops,
        "total_stops": len(stops),
        "total_payload_kg": total_kg,
        "vehicle_capacity_kg": veh_cap_kg,
        "utilization_pct": utilization_pct,
        "is_overloaded": is_overloaded,
        "estimated_distance_km": total_road_km,
        "estimated_duration_minutes": estimated_mins,
        "route_order_valid": True,
    }

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
        } if invoice else None,
        "trip_type": getattr(trip, "trip_type", "FULL_TRUCK") or "FULL_TRUCK",
        "stops": [
            {
                "id": str(s.id),
                "request_id": str(s.request_id),
                "stop_sequence": s.stop_sequence,
                "stop_type": s.stop_type,
                "company_name": s.company_name,
                "address": s.address,
                "lat": s.lat,
                "lng": s.lng,
                "contact_person": s.contact_person,
                "contact_phone": s.contact_phone,
                "cargo_summary": s.cargo_summary,
                "cargo_weight_kg": s.cargo_weight_kg,
                "status": s.status,
                "otp_verified": s.otp_verified,
            }
            for s in await TripStop.find(TripStop.trip_id == trip.id).sort("stop_sequence").to_list()
        ]
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

@router.post("/requests/{request_id}/otp-override", response_model=DeliveryOTPAdminOverrideResponse)
async def admin_override_delivery_otp(
    request_id: uuid.UUID,
    payload: DeliveryOTPAdminOverrideRequest,
    current_admin: User = Depends(get_current_admin),
):
    """
    Authorized Admin exception workflow for genuine situations where recipient
    cannot provide verification code.
    Requires explicit admin authorization, mandatory audit reason, and logs identity.
    """
    purpose = payload.purpose or "DELIVERY"
    return await DeliveryOTPService.admin_override_otp(request_id, payload.reason, current_admin, purpose)

@router.get("/trips/{trip_id}/otp-status", response_model=DeliveryOTPStatusResponse)
async def admin_get_delivery_otp_status(
    trip_id: uuid.UUID,
    purpose: Optional[str] = None,
    current_admin: User = Depends(get_current_admin),
):
    """
    Inspects OTP verification status (PICKUP or DELIVERY) for admin audit.
    Never exposes plain OTP codes.
    """
    return await DeliveryOTPService.get_otp_status(trip_id, current_admin, purpose)


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

from app.schemas.delivery_otp import AdminEmergencyTransitionRequest, AdminForceCompleteRequest

@router.post("/trips/{trip_id}/admin-force-complete")
async def admin_force_complete(
    trip_id: uuid.UUID,
    payload: Optional[AdminForceCompleteRequest] = None,
    current_admin: User = Depends(get_current_admin),
):
    """
    Admin emergency exception completion:
    Requires explicit admin authorization and a mandatory justification reason if bypassing delivery OTP
    or POD verification. Does not permit silent un-audited completion.
    Creates an immutable audit record and preserves invoicing / resource release invariants.
    """
    from app.models.finance import Invoice
    from app.models.enums import InvoiceStatus
    from app.schemas.invoice import InvoiceCreate
    from app.services.invoice_service import InvoiceService
    from app.models.delivery_otp import DeliveryOTP
    from app.core.config import settings as app_settings

    trip = await Trip.find_one(Trip.id == trip_id)
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

    if request.status == DeliveryRequestStatus.COMPLETED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trip is already completed")

    # Check delivery OTP verification status
    deliv_otp = await DeliveryOTP.find_one(
        DeliveryOTP.request_id == request.id,
        DeliveryOTP.purpose == "DELIVERY",
        DeliveryOTP.is_consumed == True,
        sort=[("consumed_at", -1)]
    )
    has_valid_delivery_otp = bool(deliv_otp and (deliv_otp.verified_by_user_id or deliv_otp.is_admin_override))

    # Check POD status
    from app.models.delivery import ProofOfDelivery
    pod = await ProofOfDelivery.find_one(ProofOfDelivery.trip_id == trip.id)
    has_valid_pod = bool(pod and pod.status in ["SUBMITTED", "VERIFIED"])

    # If delivery OTP or POD missing, enforce that an audited override reason was explicitly provided
    override_reason = payload.override_reason.strip() if (payload and payload.override_reason) else None
    if app_settings.DELIVERY_OTP_REQUIRED and not has_valid_delivery_otp:
        if not override_reason or len(override_reason) < 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Delivery OTP verification required. To perform an emergency admin completion, a mandatory justification reason (min 5 characters) must be provided in override_reason."
            )
        # Record durable audit override record via DeliveryOTPService
        await DeliveryOTPService.admin_override_otp(
            request_id=request.id,
            reason=f"[Force Complete Exception] {override_reason}",
            admin_user=current_admin,
            purpose="DELIVERY"
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Set timestamps
    if not trip.started_at:
        trip.started_at = now
    if not trip.arrived_at:
        trip.arrived_at = now
    if not trip.delivered_at:
        trip.delivered_at = now
    trip.completed_at = now

    request.status = DeliveryRequestStatus.COMPLETED
    await trip.save()
    await request.save()

    # Release vehicle and driver
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
        if vehicle:
            vehicle.status = VehicleStatus.AVAILABLE
            await vehicle.save()
        driver = await Driver.find_one(Driver.id == assignment.driver_id)
        if driver:
            driver.status = DriverStatus.AVAILABLE
            await driver.save()

    # Auto-generate invoice from the immutable accepted quotation if not already generated
    existing_inv = await Invoice.find_one(Invoice.request_id == request.id)
    if not existing_inv:
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
        "is_override": bool(override_reason),
        "message": "Trip completed successfully with audited compliance record."
    }

@router.post("/trips/{trip_id}/mark-in-transit")
async def mark_in_transit(
    trip_id: uuid.UUID,
    payload: Optional[AdminEmergencyTransitionRequest] = None,
    current_admin: User = Depends(get_current_admin),
):
    """
    Admin: Advance trip status to IN_TRANSIT.
    Requires Pickup OTP verification. If bypassing in an emergency, requires a mandatory justification
    reason (min 5 characters) and records an immutable audit record.
    """
    trip = await Trip.find_one(Trip.id == trip_id)
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

    from app.models.delivery_otp import DeliveryOTP
    from app.core.config import settings as app_settings

    # Verify Pickup OTP status
    pickup_record = await DeliveryOTP.find_one(
        DeliveryOTP.request_id == request.id,
        DeliveryOTP.purpose == "PICKUP",
        DeliveryOTP.is_consumed == True,
        sort=[("consumed_at", -1)]
    )
    has_valid_pickup = bool(
        pickup_record and (pickup_record.verified_by_user_id is not None or pickup_record.is_admin_override)
    )

    override_reason = payload.override_reason.strip() if (payload and payload.override_reason) else None

    if app_settings.DELIVERY_OTP_REQUIRED and not has_valid_pickup:
        if not override_reason or len(override_reason) < 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pickup OTP verification required before marking in transit. For emergency admin override, specify a mandatory justification reason (min 5 characters) in override_reason."
            )
        # Record durable audit override record via DeliveryOTPService
        await DeliveryOTPService.admin_override_otp(
            request_id=request.id,
            reason=f"[Mark In Transit Exception] {override_reason}",
            admin_user=current_admin,
            purpose="PICKUP"
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    trip.started_at = now
    if not trip.picked_up_at:
        trip.picked_up_at = now
    request.status = DeliveryRequestStatus.IN_TRANSIT
    await trip.save()
    await request.save()

    return {"id": trip.id, "status": "IN_TRANSIT", "started_at": now}


@router.post("/requests/{request_id}/unassign")
async def unassign_request_assignment(
    request_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
):
    """
    Admin: Revokes driver/vehicle assignment for a request that has not started transit yet.
    - Transitions request status back to ACCEPTED so it can be reassigned or consolidated.
    - Releases the assigned vehicle and driver back to AVAILABLE.
    - Deletes or unlinks the pending Trip and TripStops.
    """
    req = await DeliveryRequest.find_one(DeliveryRequest.id == request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

    if req.status not in [DeliveryRequestStatus.DRIVER_ASSIGNED, DeliveryRequestStatus.VEHICLE_ASSIGNED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot unassign request in '{req.status.value}' status. Only assigned requests prior to transit departure can be reassigned."
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Find trip
    trip = await Trip.find_one({
        "$or": [
            {"request_id": req.id},
            {"request_ids": req.id}
        ]
    })

    if trip:
        # Check if trip is in multi-request consolidated trip
        if trip.request_ids and len(trip.request_ids) > 1:
            # Remove this request from the trip
            trip.request_ids = [r_id for r_id in trip.request_ids if r_id != req.id]
            from app.models.delivery import TripStop
            # Delete stops belonging to this request
            stops_to_del = await TripStop.find(TripStop.trip_id == trip.id, TripStop.request_id == req.id).to_list()
            for s in stops_to_del:
                await s.delete()
            await trip.save()
        else:
            # Single trip: release fleet resources and delete trip
            from app.models.fleet import VehicleAssignment, Vehicle, Driver
            from app.models.enums import VehicleStatus, DriverStatus
            from app.models.delivery import TripStop

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

            # Delete TripStops and Trip
            stops = await TripStop.find(TripStop.trip_id == trip.id).to_list()
            for s in stops:
                await s.delete()
            await trip.delete()

    req.status = DeliveryRequestStatus.ACCEPTED
    await req.save()

    return {
        "success": True,
        "message": f"Assignment for request {req.request_number} has been revoked. Status reset to ACCEPTED for re-assignment.",
        "request_id": req.id,
        "status": req.status.value,
    }



