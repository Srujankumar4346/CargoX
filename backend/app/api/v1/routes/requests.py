import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from app.models.user import User
from app.models.delivery import DeliveryRequest
from app.models.delivery import Trip
from app.models.fleet import VehicleAssignment, Driver, Vehicle
from app.schemas.delivery_request import DeliveryRequestCreate, DeliveryRequestRead, DeliveryRequestUpdate, CancelRequestSchema
from app.api.deps import get_current_customer_user
from app.services.customer_portal import CustomerPortalService

router = APIRouter()

async def _batch_customer_request_responses(requests: List[DeliveryRequest]) -> List[dict]:
    """Batch populate customer operational assignment details in O(1) database queries."""
    if not requests:
        return []
    
    req_ids = [r.id for r in requests]
    trips = await Trip.find({"request_id": {"$in": req_ids}}).to_list()
    trip_by_req = {t.request_id: t for t in trips}
    
    trip_ids = [t.id for t in trips]
    assignments = await VehicleAssignment.find(
        {"trip_id": {"$in": trip_ids}}
    ).sort("-assigned_at").to_list() if trip_ids else []
    
    # Keep latest assignment per trip_id
    latest_assignment_by_trip = {}
    for a in assignments:
        if a.trip_id not in latest_assignment_by_trip:
            latest_assignment_by_trip[a.trip_id] = a
            
    driver_ids = list({a.driver_id for a in latest_assignment_by_trip.values()})
    vehicle_ids = list({a.vehicle_id for a in latest_assignment_by_trip.values()})
    
    drivers = await Driver.find({"_id": {"$in": driver_ids}}).to_list() if driver_ids else []
    vehicles = await Vehicle.find({"_id": {"$in": vehicle_ids}}).to_list() if vehicle_ids else []
    
    driver_by_id = {d.id: d for d in drivers}
    vehicle_by_id = {v.id: v for v in vehicles}
    
    # Batch load quotations and invoices to provide real calculated prices
    from app.models.pricing import Quotation
    from app.models.finance import Invoice
    quotations = await Quotation.find({"request_id": {"$in": req_ids}}).to_list() if req_ids else []
    invoices = await Invoice.find({"request_id": {"$in": req_ids}}).to_list() if req_ids else []
    
    quote_by_req = {q.request_id: q for q in quotations}
    invoice_by_req = {inv.request_id: inv for inv in invoices}
    
    results = []
    for req in requests:
        res = req.model_dump()
        quote = quote_by_req.get(req.id)
        invoice = invoice_by_req.get(req.id)
        
        # Calculate real customer price
        customer_charge = None
        if invoice:
            customer_charge = float(invoice.total_amount)
        elif quote:
            customer_charge = float(quote.customer_total_charge)
            
        res["final_price"] = customer_charge
        res["estimated_price"] = customer_charge
        if quote:
            res["quotation"] = {
                "customer_total_charge": float(quote.customer_total_charge),
                "base_fare": float(quote.base_fare or 0),
                "distance_charge": float(quote.distance_charge or 0),
                "driver_payable_amount": float(quote.driver_payable_amount or 0),
                "service_fee_amount": float(quote.service_fee_amount or 0),
            }
        
        trip = trip_by_req.get(req.id)
        if trip:
            assignment = latest_assignment_by_trip.get(trip.id)
            if assignment:
                driver = driver_by_id.get(assignment.driver_id)
                vehicle = vehicle_by_id.get(assignment.vehicle_id)
                res.update({
                    "assigned_driver_name": driver.name if driver else None,
                    "assigned_driver_phone": driver.phone if driver else None,
                    "assigned_vehicle_registration": vehicle.registration_number if vehicle else None,
                    "assigned_vehicle_type": vehicle.type.value if vehicle and hasattr(vehicle.type, "value") else (str(vehicle.type) if vehicle else None),
                    "assigned_vehicle_capacity_tons": vehicle.capacity_tons if vehicle else None,
                })
        results.append(res)
    return results

async def _customer_request_response(request: DeliveryRequest) -> dict:
    """Return request data plus the minimum operational assignment details customers need."""
    batch_res = await _batch_customer_request_responses([request])
    return batch_res[0]

from pydantic import BaseModel, Field
import math
from decimal import Decimal

class RouteCalculationRequest(BaseModel):
    pickup_lat: float = Field(..., ge=-90.0, le=90.0)
    pickup_lng: float = Field(..., ge=-180.0, le=180.0)
    destination_lat: float = Field(..., ge=-90.0, le=90.0)
    destination_lng: float = Field(..., ge=-180.0, le=180.0)

class RouteCalculationResponse(BaseModel):
    distance_km: Decimal
    estimated_duration_minutes: int
    waypoints: List[List[float]]

def _haversine_road_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> Decimal:
    R = 6371.0 # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    direct_km = R * c
    # Road routing curvature multiplier (typically 1.25x for road transport networks)
    road_km = max(direct_km * 1.25, 1.0)
    return Decimal(str(round(road_km, 2)))

@router.post("/calculate-route", response_model=RouteCalculationResponse)
async def calculate_route(
    payload: RouteCalculationRequest,
    current_user: User = Depends(get_current_customer_user),
):
    """
    Authoritative calculation of road distance and duration.
    Uses CargoX OSRM route engine (true road topography) with resilient fallback.
    Validates pickup and destination coordinates are distinct.
    """
    # Validate distinct locations
    if abs(payload.pickup_lat - payload.destination_lat) < 0.0001 and abs(payload.pickup_lng - payload.destination_lng) < 0.0001:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Pickup and destination locations cannot be identical."
        )

    from app.services.intelligence.route_engine import fetch_osrm_routes

    # 1. Attempt true road network calculation via OSRM
    routes = fetch_osrm_routes(
        pickup_lat=payload.pickup_lat,
        pickup_lng=payload.pickup_lng,
        drop_lat=payload.destination_lat,
        drop_lng=payload.destination_lng
    )

    if routes and len(routes) > 0:
        primary_route = routes[0]
        # Actual road-network driving distance from OSRM meters -> km
        dist_km = Decimal(str(round(primary_route.get("distance", 0) / 1000.0, 2)))
        duration_s = primary_route.get("duration", 0)
        duration_mins = max(int(duration_s // 60), 1)
        
        # Extract full road-following geometry waypoints
        geometry = primary_route.get("geometry")
        waypoints = []
        if isinstance(geometry, dict) and "coordinates" in geometry:
            # GeoJSON coordinates are [lon, lat] -> convert to [lat, lon] for Leaflet
            waypoints = [[round(coord[1], 6), round(coord[0], 6)] for coord in geometry["coordinates"]]
        elif isinstance(geometry, list):
            waypoints = [[round(coord[1], 6), round(coord[0], 6)] for coord in geometry]

        if not waypoints:
            waypoints = [
                [payload.pickup_lat, payload.pickup_lng],
                [payload.destination_lat, payload.destination_lng]
            ]

        return RouteCalculationResponse(
            distance_km=dist_km,
            estimated_duration_minutes=duration_mins,
            waypoints=waypoints
        )

    # If OSRM driving route cannot be calculated, do not fabricate a straight-line fallback
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Unable to calculate a valid road-network driving route between the selected locations. Please select reachable road points and try again."
    )


@router.get("", response_model=List[DeliveryRequestRead])
async def list_requests(
    current_user: User = Depends(get_current_customer_user)
):
    requests = await DeliveryRequest.find(
        DeliveryRequest.customer_company_id == current_user.customer_company_id
    ).sort("-created_at").to_list()
    return await _batch_customer_request_responses(requests)

@router.post("", response_model=DeliveryRequestRead, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: DeliveryRequestCreate,
    current_user: User = Depends(get_current_customer_user)
):
    req = await CustomerPortalService.create_delivery_request(current_user, payload)
    return await _customer_request_response(req)

@router.get("/{request_id}", response_model=DeliveryRequestRead)
async def get_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user)
):
    req = await DeliveryRequest.find_one(DeliveryRequest.id == request_id)
    if not req or req.customer_company_id != current_user.customer_company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    return await _customer_request_response(req)

@router.post("/{request_id}/cancel", response_model=DeliveryRequestRead)
async def cancel_request(
    request_id: uuid.UUID,
    payload: CancelRequestSchema = None,
    current_user: User = Depends(get_current_customer_user)
):
    reason = payload.reason if payload else None
    req = await CustomerPortalService.cancel_delivery_request(current_user, request_id, reason)
    return await _customer_request_response(req)

@router.put("/{request_id}", response_model=DeliveryRequestRead)
async def update_request(
    request_id: uuid.UUID,
    payload: DeliveryRequestUpdate,
    current_user: User = Depends(get_current_customer_user)
):
    req = await CustomerPortalService.update_delivery_request(current_user, request_id, payload)
    return await _customer_request_response(req)

from app.schemas.delivery_otp import CustomerActiveOTPResponse
from app.services.delivery_otp_service import DeliveryOTPService

@router.get("/{request_id}/otp", response_model=CustomerActiveOTPResponse)
async def get_customer_active_otp(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user)
):
    """
    Returns the active 6-digit verification code (Pickup or Delivery) strictly to the
    authenticated customer who owns this booking.
    Code is encrypted at rest and only returned in this endpoint for the active stage.
    """
    return await DeliveryOTPService.get_or_create_customer_otp(request_id, current_user)

