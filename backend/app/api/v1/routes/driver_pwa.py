from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid
from typing import List

from app.api.deps import get_current_driver
from app.db.database import get_db
from app.models.user import User
from app.schemas.driver_pwa import LocationUpdate, DriverTripRead
from app.schemas.tracking_delivery import PODSubmission, PODRead
from app.services.driver_service import DriverService
from app.services.tracking_delivery_service import TrackingDeliveryService

router = APIRouter()

@router.get("/trips/active", response_model=DriverTripRead)
def get_active_trip(
    current_driver: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """
    Returns the currently assigned active trip for the authenticated driver.
    """
    return DriverService.get_active_trip(db, current_driver)

@router.get("/trips/history", response_model=List[DriverTripRead])
def list_trip_history(
    current_driver: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """
    Lists past historical trips assigned to the driver.
    """
    return DriverService.list_trip_history(db, current_driver)

@router.post("/trips/{trip_id}/location")
def update_location(
    trip_id: uuid.UUID,
    loc_in: LocationUpdate,
    current_driver: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """
    Transmits GPS coordinate updates for the active trip.
    """
    return DriverService.update_location(db, trip_id, loc_in, current_driver)

@router.post("/trips/{trip_id}/start-pickup", response_model=DriverTripRead)
def start_pickup(
    trip_id: uuid.UUID,
    current_driver: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """
    Transitions trip execution status from DRIVER_ASSIGNED to PICKUP_IN_PROGRESS.
    """
    return DriverService.start_pickup(db, trip_id, current_driver)

@router.post("/trips/{trip_id}/start-transit", response_model=DriverTripRead)
def start_transit(
    trip_id: uuid.UUID,
    current_driver: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """
    Transitions trip execution status from PICKUP_IN_PROGRESS to IN_TRANSIT.
    """
    return DriverService.start_transit(db, trip_id, current_driver)

@router.post("/trips/{trip_id}/arrive", response_model=DriverTripRead)
def arrive(
    trip_id: uuid.UUID,
    current_driver: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """
    Transitions trip execution status from IN_TRANSIT to ARRIVED.
    """
    return DriverService.arrive(db, trip_id, current_driver)

@router.post("/trips/{trip_id}/pod", response_model=PODRead, status_code=status.HTTP_201_CREATED)
def submit_pod(
    trip_id: uuid.UUID,
    pod_in: PODSubmission,
    current_driver: User = Depends(get_current_driver),
    db: Session = Depends(get_db)
):
    """
    Submits Proof of Delivery for an ARRIVED trip, transitioning status to POD_SUBMITTED.
    """
    return TrackingDeliveryService.submit_pod(db, trip_id, pod_in, current_driver)

