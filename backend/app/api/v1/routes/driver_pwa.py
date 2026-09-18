from fastapi import APIRouter, Depends, HTTPException, status
import uuid
from typing import List

from app.api.deps import get_current_driver
from app.models.user import User
from app.schemas.driver_pwa import LocationUpdate, DriverTripRead
from app.schemas.tracking_delivery import PODSubmission, PODRead
from app.services.driver_service import DriverService
from app.services.tracking_delivery_service import TrackingDeliveryService

router = APIRouter()

@router.get("/trips/active", response_model=DriverTripRead)
async def get_active_trip(
    current_driver: User = Depends(get_current_driver),
    ):
    """
    Returns the currently assigned active trip for the authenticated driver.
    """
    return await DriverService.get_active_trip(current_driver)

@router.get("/trips/history", response_model=List[DriverTripRead])
async def list_trip_history(
    current_driver: User = Depends(get_current_driver),
    ):
    """
    Lists past historical trips assigned to the driver.
    """
    return await DriverService.list_trip_history(current_driver)

@router.post("/trips/{trip_id}/location")
async def update_location(
    trip_id: uuid.UUID,
    loc_in: LocationUpdate,
    current_driver: User = Depends(get_current_driver),
    ):
    """
    Transmits GPS coordinate updates for the active trip.
    """
    return await DriverService.update_location(trip_id, loc_in, current_driver)

@router.post("/trips/{trip_id}/start-pickup", response_model=DriverTripRead)
async def start_pickup(
    trip_id: uuid.UUID,
    current_driver: User = Depends(get_current_driver),
    ):
    """
    Transitions trip execution status from DRIVER_ASSIGNED to PICKUP_IN_PROGRESS.
    """
    return await DriverService.start_pickup(trip_id, current_driver)

@router.post("/trips/{trip_id}/start-transit", response_model=DriverTripRead)
async def start_transit(
    trip_id: uuid.UUID,
    current_driver: User = Depends(get_current_driver),
    ):
    """
    Transitions trip execution status from PICKUP_IN_PROGRESS to IN_TRANSIT.
    """
    return await DriverService.start_transit(trip_id, current_driver)

@router.post("/trips/{trip_id}/arrive", response_model=DriverTripRead)
async def arrive(
    trip_id: uuid.UUID,
    current_driver: User = Depends(get_current_driver),
    ):
    """
    Transitions trip execution status from IN_TRANSIT to ARRIVED.
    """
    return await DriverService.arrive(trip_id, current_driver)

@router.post("/trips/{trip_id}/pod", response_model=PODRead, status_code=status.HTTP_201_CREATED)
async def submit_pod(
    trip_id: uuid.UUID,
    pod_in: PODSubmission,
    current_driver: User = Depends(get_current_driver),
    ):
    """
    Submits Proof of Delivery for an ARRIVED trip, transitioning status to POD_SUBMITTED.
    """
    return await TrackingDeliveryService.submit_pod(trip_id, pod_in, current_driver)

