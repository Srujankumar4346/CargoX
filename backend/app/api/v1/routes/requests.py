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

async def _customer_request_response(request: DeliveryRequest) -> dict:
    """Return request data plus the minimum operational assignment details customers need."""
    response = request.model_dump()
    trip = await Trip.find_one(Trip.request_id == request.id)
    if not trip:
        return response

    assignment = await VehicleAssignment.find_one(
        VehicleAssignment.trip_id == trip.id,
        sort=[("assigned_at", -1)],
    )
    if not assignment:
        return response

    driver = await Driver.find_one(Driver.id == assignment.driver_id)
    vehicle = await Vehicle.find_one(Vehicle.id == assignment.vehicle_id)
    response.update({
        "assigned_driver_name": driver.name if driver else None,
        "assigned_driver_phone": driver.phone if driver else None,
        "assigned_vehicle_registration": vehicle.registration_number if vehicle else None,
        "assigned_vehicle_type": vehicle.type.value if vehicle and hasattr(vehicle.type, "value") else (str(vehicle.type) if vehicle else None),
        "assigned_vehicle_capacity_tons": vehicle.capacity_tons if vehicle else None,
    })
    return response

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
    """
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
        dist_km = Decimal(str(round(primary_route.get("distance", 0) / 1000.0, 2)))
        duration_s = primary_route.get("duration", 0)
        duration_mins = max(int(duration_s // 60), 10)
        
        # Extract waypoints if coordinates overview is returned
        geometry = primary_route.get("geometry")
        waypoints = []
        if isinstance(geometry, dict) and "coordinates" in geometry:
            # GeoJSON coordinates are [lon, lat] -> convert to [lat, lon]
            waypoints = [[round(coord[1], 6), round(coord[0], 6)] for coord in geometry["coordinates"][:20]]
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

    # 2. Resilient fallback: Mathematical Haversine with 1.25x road factor
    dist = _haversine_road_distance(
        payload.pickup_lat, payload.pickup_lng,
        payload.destination_lat, payload.destination_lng
    )
    duration_mins = max(int((float(dist) / 45.0) * 60), 10)
    steps = 10
    waypoints = []
    for i in range(steps + 1):
        frac = i / float(steps)
        lat = payload.pickup_lat + (payload.destination_lat - payload.pickup_lat) * frac
        lng = payload.pickup_lng + (payload.destination_lng - payload.pickup_lng) * frac
        waypoints.append([round(lat, 6), round(lng, 6)])

    return RouteCalculationResponse(
        distance_km=dist,
        estimated_duration_minutes=duration_mins,
        waypoints=waypoints
    )


@router.get("", response_model=List[DeliveryRequestRead])
async def list_requests(
    current_user: User = Depends(get_current_customer_user)
):
    requests = await DeliveryRequest.find(
        DeliveryRequest.customer_company_id == current_user.customer_company_id
    ).sort("-created_at").to_list()
    return [await _customer_request_response(request) for request in requests]

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
