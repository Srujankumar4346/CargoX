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
