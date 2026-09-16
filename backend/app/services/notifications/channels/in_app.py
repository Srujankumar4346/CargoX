from sqlalchemy.orm import Session
from app.models.notification import Notification
import logging

logger = logging.getLogger(__name__)

def send_in_app(db: Session, user_type: str, user_id: int, event_type: str, title: str, message: str, metadata: dict = None):
    # The deduplication is handled by NotificationManager
    notif = Notification(
        user_type=user_type,
        user_id=user_id,
        event_type=event_type,
        title=title,
        message=message,
        channel="IN_APP",
        delivery_status="SENT",
        metadata_payload=metadata
    )
    db.add(notif)
    db.commit()
    logger.info(f"[IN_APP] Created notification for {user_type} #{user_id} | Event: {event_type}")
