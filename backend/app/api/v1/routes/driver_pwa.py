from fastapi import APIRouter, Depends, HTTPException, status
import uuid
from typing import List

from app.api.deps import get_current_driver
from app.models.user import User
from app.schemas.driver_pwa import (
    LocationUpdate,
    DriverTripRead,
    DriverCollectionCreate,
    DriverCollectionRead,
    DriverPaymentOrderResponse,
    DriverPaymentStatusResponse,
)
from app.schemas.tracking_delivery import PODSubmission, PODRead
from app.schemas.settlement import DriverSettlementSummaryRead
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


@router.post("/trips/{trip_id}/record-collection", response_model=DriverCollectionRead, status_code=status.HTTP_201_CREATED)
async def record_collection(
    trip_id: uuid.UUID,
    collection_in: DriverCollectionCreate,
    current_driver: User = Depends(get_current_driver),
):
    """
    Enables authorized assigned driver to record payment collection (Cash or UPI)
    for trips using Pay on Delivery upon delivery arrival.
    Strictly enforces:
    - Driver must be assigned to this trip.
    - Amount cannot exceed outstanding balance.
    - Duplicate reference checks.
    - Does NOT expose CargoX service fees or driver margins.
    """
    return await DriverService.record_trip_collection(trip_id, collection_in, current_driver)


@router.post("/trips/{trip_id}/pay-cargox-now", response_model=DriverPaymentOrderResponse)
async def pay_cargox_now(
    trip_id: uuid.UUID,
    current_driver: User = Depends(get_current_driver),
):
    """
    Rapido/Uber-style driver destination payment:
    - Driver taps 'Pay CargoX Now' to request immediate payment from customer.
    - Generates dynamic Razorpay order / UPI intent for exact remaining invoice balance.
    - Destination is strictly CargoX corporate merchant account.
    """
    return await DriverService.initiate_destination_payment(trip_id, current_driver)


@router.get("/trips/{trip_id}/payment-status", response_model=DriverPaymentStatusResponse)
async def check_payment_status(
    trip_id: uuid.UUID,
    current_driver: User = Depends(get_current_driver),
):
    """
    Checks real-time payment status and completes trip automatically if delivery is verified and payment is settled.
    """
    return await DriverService.get_payment_status(trip_id, current_driver)


@router.get("/settlements", response_model=List[DriverSettlementSummaryRead])
async def list_driver_settlements(
    current_driver: User = Depends(get_current_driver),
):
    """
    Returns settlement summaries for the authenticated driver.
    Strictly isolated: customer invoice totals and CargoX service fees are never exposed.
    """
    from app.models.fleet import Driver
    from app.models.finance import DriverSettlement

    driver = await Driver.find_one(Driver.user_id == current_driver.id)
    if not driver:
        driver = await Driver.find_one(Driver.email == current_driver.email)
    if not driver:
        return []

    settlements = await DriverSettlement.find(
        DriverSettlement.driver_id == driver.id
    ).sort("-period_start").to_list()
    return settlements

