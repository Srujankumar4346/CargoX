from fastapi import APIRouter, Depends, HTTPException, status
import uuid

from app.api.deps import get_current_admin
from app.models.user import User
from app.models.delivery import Trip, DeliveryRequest
from app.models.enums import DeliveryRequestStatus
from app.schemas.dispatch import DispatchRequest, DispatchRead
from app.schemas.delivery_request import DeliveryRequestRead
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

@router.post("/requests/{request_id}/approve", response_model=DeliveryRequestRead)
async def approve_request(
    request_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Approves a delivery request, transitioning it from SUBMITTED to ACCEPTED.
    """
    req = await DeliveryRequest.find_one(DeliveryRequest.id == request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.status != DeliveryRequestStatus.SUBMITTED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot approve request in {req.status} status")
    
    req.status = DeliveryRequestStatus.ACCEPTED
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

