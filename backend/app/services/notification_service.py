import uuid
from typing import List
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.models.notifications import Notification, NotificationStatus, NotificationChannel
from app.models.user import User
from app.models.enums import UserRole

class NotificationService:
    @staticmethod
    def create_notification(
        db: Session,
        event_id: str,
        event_type: str,
        recipient_user_id: uuid.UUID,
        channel: NotificationChannel,
        title: str,
        message: str
    ) -> Notification:
        """
        Creates a persistent PENDING notification as part of the business transaction.
        The caller must commit the transaction.
        If a duplicate event_id is created, it will raise an IntegrityError upon flush/commit.
        """
        notification = Notification(
            id=uuid.uuid4(),
            event_id=event_id,
            event_type=event_type,
            recipient_user_id=recipient_user_id,
            channel=channel,
            title=title,
            message=message,
            status=NotificationStatus.PENDING,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.add(notification)
        return notification

    @staticmethod
    def _deliver_mock(notification: Notification) -> bool:
        """
        Mock delivery adapter. Always succeeds.
        In a real scenario, this would call an external API (e.g., SendGrid/Twilio).
        """
        if "SIMULATE_FAILURE" in notification.message:
            return False
        return True

    @staticmethod
    def process_pending_notifications(db: Session):
        """
        Processes all PENDING notifications.
        Designed to be called periodically by a worker, or synchronously after a commit.
        """
        pending_notifications = db.query(Notification).filter(
            Notification.status == NotificationStatus.PENDING
        ).with_for_update(skip_locked=True).all()
        
        for notif in pending_notifications:
            success = NotificationService._deliver_mock(notif)
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            if success:
                notif.status = NotificationStatus.SENT
                notif.sent_at = now
            else:
                notif.status = NotificationStatus.FAILED
                notif.error_message = "Mock delivery failed."
            
            db.commit()

    @staticmethod
    def resolve_admin_recipients(db: Session) -> List[User]:
        """Returns all active ADMIN users."""
        return db.query(User).filter(
            User.role == UserRole.ADMIN,
            User.is_active == True
        ).all()

    @staticmethod
    def resolve_customer_recipients(db: Session, company_id: uuid.UUID) -> List[User]:
        """Returns all active CUSTOMER_USER users for the given company."""
        return db.query(User).filter(
            User.role == UserRole.CUSTOMER_USER,
            User.customer_company_id == company_id,
            User.is_active == True
        ).all()
