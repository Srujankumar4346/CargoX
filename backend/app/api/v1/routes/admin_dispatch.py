from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid

from app.api.deps import get_current_admin
from app.db.database import get_db
from app.models.user import User
from app.models.delivery import Trip
from app.schemas.dispatch import DispatchRequest, DispatchRead
from app.schemas.tracking_delivery import PODRead
from app.services.dispatch_service import DispatchService
from app.services.tracking_delivery_service import TrackingDeliveryService

router = APIRouter()

@router.post("/requests/{request_id}/dispatch", response_model=DispatchRead, status_code=status.HTTP_201_CREATED)
def dispatch_request(
    request_id: uuid.UUID,
    dispatch_in: DispatchRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Dispatches an ACCEPTED delivery request by assigning a vehicle and driver.
    Requires Admin privileges. Employs row-level locking for concurrency safety.
    """
    return DispatchService.dispatch_request(db, request_id, dispatch_in, current_admin)

@router.put("/requests/{request_id}/reassign", response_model=DispatchRead)
def reassign_request(
    request_id: uuid.UUID,
    dispatch_in: DispatchRequest,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Reassigns vehicle and driver for an unstarted trip.
    Preserves audit history on the previous assignment. Requires Admin privileges.
    """
    return DispatchService.reassign_request(db, request_id, dispatch_in, current_admin)

@router.get("/trips/{trip_id}")
def get_trip_detail(
    trip_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Gets details of a trip and its current assignment. Requires Admin privileges.
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    return {
        "id": trip.id,
        "request_id": trip.request_id,
        "assigned_at": trip.assigned_at,
        "current_lat": trip.current_lat,
        "current_lng": trip.current_lng,
        "assignment": trip.assignment
    }

@router.post("/trips/{trip_id}/verify-pod", response_model=PODRead)
def verify_pod(
    trip_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Verifies POD for a POD_SUBMITTED trip, transitioning request status to DELIVERED and setting delivered_at timestamp.
    Requires Admin privileges.
    """
    return TrackingDeliveryService.verify_pod(db, trip_id, current_admin)

@router.post("/trips/{trip_id}/complete")
def complete_trip(
    trip_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Completes a DELIVERED trip, transitioning request status to COMPLETED, setting completed_at timestamp,
    and releasing committed Vehicle and Driver resources back to AVAILABLE.
    Requires Admin privileges.
    """
    trip = TrackingDeliveryService.complete_trip(db, trip_id, current_admin)
    return {
        "id": trip.id,
        "request_id": trip.request_id,
        "completed_at": trip.completed_at,
        "status": "COMPLETED"
    }

