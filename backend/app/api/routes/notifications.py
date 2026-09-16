from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.notification import Notification
from app.api.deps import get_current_active_user

router = APIRouter()

@router.get("/")
def get_notifications(
    skip: int = Query(0, ge=0), 
    limit: int = Query(20, ge=1, le=100), 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    # Users can only query their own notifications, unless admin
    user_type = current_user["role"]
    user_id = current_user["id"]
    
    notifications = db.query(Notification).filter(
        Notification.user_type == user_type,
        Notification.user_id == user_id
    ).order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()
    
    return notifications

@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    if notif.user_type != current_user["role"] or notif.user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this notification")
        
    notif.is_read = True
    db.commit()
    return {"status": "success"}
