from fastapi import APIRouter, Depends, HTTPException, status
import uuid

from app.api.deps import get_current_customer_user
from app.models.user import User
from app.schemas.tracking_delivery import CustomerTrackingRead
from app.services.tracking_delivery_service import TrackingDeliveryService

router = APIRouter()

@router.get("/{request_id}/tracking", response_model=CustomerTrackingRead)
async def get_customer_tracking(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Returns public customer tracking view for a delivery request.
    Includes current location, live status flag, operational timestamps, and breadcrumb history capped at 500 points.
    Enforces customer tenant isolation.
    """
    return await TrackingDeliveryService.get_customer_tracking(request_id, current_user)
