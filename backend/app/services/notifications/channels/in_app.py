from sqlalchemy.orm import Session
from app.models.notification import Notification

def send_in_app(db: Session, user_type: str, user_id: int, title: str, message: str):
    notif = Notification(
        user_type=user_type,
        user_id=user_id,
        title=title,
        message=message
    )
    db.add(notif)
    db.commit()
