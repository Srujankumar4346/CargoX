from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.notification import Notification

router = APIRouter()

@router.get("/")
def get_notifications(user_type: str, user_id: int, limit: int = 20, db: Session = Depends(get_db)):
    notifications = db.query(Notification).filter(
        Notification.user_type == user_type,
        Notification.user_id == user_id
    ).order_by(Notification.created_at.desc()).limit(limit).all()
    
    return notifications

@router.post("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"status": "success"}
