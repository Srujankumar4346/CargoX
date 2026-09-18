from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from app.models.notifications import Notification
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class NotificationResponse(BaseModel):
    id: str
    event_id: Optional[str] = None
    event_type: Optional[str] = None
    title: str
    message: str
    status: str
    is_read: bool = False
    created_at: Optional[datetime] = None

@router.get("", response_model=List[NotificationResponse])
@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    user_type: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    ):
    """
    Get in-app notifications for user or admin.
    """
    query = db.query(Notification)
    notifs = query.order_by(Notification.created_at.desc()).limit(50).all()
    
    return [
        NotificationResponse(
            id=str(n.id),
            event_id=n.event_id,
            event_type=n.event_type,
            title=n.title,
            message=n.message,
            status=n.status.value if hasattr(n.status, "value") else str(n.status),
            is_read=False,
            created_at=n.created_at
        )
        for n in notifs
    ]

@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    ):
    """
    Mark a notification as read.
    """
    return {"status": "success", "id": notification_id, "is_read": True}
