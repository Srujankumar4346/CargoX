from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import List, Optional
import uuid
import re
from datetime import datetime, timezone
from pydantic import BaseModel

from app.models.notifications import Notification
from app.models.delivery import DeliveryRequest, Trip
from app.models.enums import DeliveryRequestStatus

router = APIRouter()

class NotificationResponse(BaseModel):
    id: str
    event_id: Optional[str] = None
    event_type: Optional[str] = None
    title: str
    message: str
    status: str
    is_read: bool = False
    can_delete: bool = False
    created_at: Optional[datetime] = None

async def _check_can_delete(n: Notification) -> bool:
    """
    Checks if a notification can be deleted.
    A notification can only be deleted once the trip / delivery is completed/delivered.
    """
    # 1. Inspect event_id if it contains trip_id (e.g., POD_SUBMITTED:<trip_id>:... or TRIP_DELIVERED:<trip_id>:...)
    if n.event_id:
        parts = n.event_id.split(":")
        if len(parts) >= 2:
            try:
                trip_uuid = uuid.UUID(parts[1])
                trip = await Trip.find_one(Trip.id == trip_uuid)
                if trip:
                    if trip.completed_at is not None or trip.delivered_at is not None:
                        return True
                    req = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
                    if req and req.status in [DeliveryRequestStatus.DELIVERED, DeliveryRequestStatus.COMPLETED]:
                        return True
            except Exception:
                pass

    # 2. Inspect message for request number (e.g. CRG-20261009-7931)
    match = re.search(r'(CRG-\d{8}-\d+)', n.message or "")
    if match:
        req_num = match.group(1)
        req = await DeliveryRequest.find_one(DeliveryRequest.request_number == req_num)
        if req and req.status in [DeliveryRequestStatus.DELIVERED, DeliveryRequestStatus.COMPLETED]:
            return True

    # 3. If it's a general notification that is already marked read and has no active trip linked
    if n.event_type in ["TRIP_DELIVERED", "PAYMENT_RECEIVED", "TRIP_COMPLETED"]:
        return True

    return False

@router.get("", response_model=List[NotificationResponse])
@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    user_type: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
):
    """
    Get in-app notifications with persistent read states and completion check for deletion.
    """
    notifs = await Notification.find_all().sort("-created_at").limit(100).to_list()
    
    responses = []
    for n in notifs:
        can_delete = await _check_can_delete(n)
        responses.append(
            NotificationResponse(
                id=str(n.id),
                event_id=n.event_id,
                event_type=n.event_type,
                title=n.title,
                message=n.message,
                status=n.status.value if hasattr(n.status, "value") else str(n.status),
                is_read=bool(getattr(n, "is_read", False)),
                can_delete=can_delete,
                created_at=n.created_at
            )
        )
    return responses

@router.post("/read-all")
async def mark_all_notifications_read():
    """
    Mark all notifications as read.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    await Notification.find(Notification.is_read == False).update({"$set": {"is_read": True, "read_at": now}})
    return {"status": "success", "message": "All notifications marked as read"}

@router.post("/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """
    Mark a single notification as read.
    """
    try:
        notif_uuid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid notification ID format")

    notif = await Notification.find_one(Notification.id == notif_uuid)
    if not notif:
        # Return success gracefully if id doesn't exist to prevent UI crashes
        return {"status": "success", "id": notification_id, "is_read": True}

    notif.is_read = True
    notif.read_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await notif.save()
    return {"status": "success", "id": notification_id, "is_read": True}

@router.delete("/{notification_id}")
async def delete_notification(notification_id: str):
    """
    Delete a notification after the trip / delivery details are completed.
    """
    try:
        notif_uuid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid notification ID format")

    notif = await Notification.find_one(Notification.id == notif_uuid)
    if not notif:
        return {"status": "success", "id": notification_id, "deleted": True}

    can_delete = await _check_can_delete(notif)
    if not can_delete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete notification while trip details are in progress. Only completed/delivered trip messages can be deleted."
        )

    await notif.delete()
    return {"status": "success", "id": notification_id, "deleted": True}
