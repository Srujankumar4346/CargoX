import uuid
from typing import List
from datetime import datetime, timezone
from pymongo.errors import DuplicateKeyError

from app.models.notifications import Notification, NotificationStatus, NotificationChannel
from app.models.user import User
from app.models.enums import UserRole

class NotificationService:
    @staticmethod
    async def create_notification(
        event_id: str,
        event_type: str,
        recipient_user_id: uuid.UUID,
        channel: NotificationChannel,
        title: str,
        message: str
    ) -> Notification:
        """
        Creates a persistent PENDING notification.
        """
        notification = Notification(
            event_id=event_id,
            event_type=event_type,
            recipient_user_id=recipient_user_id,
            channel=channel,
            title=title,
            message=message,
            status=NotificationStatus.PENDING,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        try:
            await notification.insert()
        except DuplicateKeyError:
            # Event already created
            pass
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
    async def process_pending_notifications():
        """
        Processes all PENDING notifications.
        Designed to be called periodically by a worker, or synchronously after a commit.
        """
        pending_notifications = await Notification.find(
            Notification.status == NotificationStatus.PENDING
        ).to_list()
        
        for notif in pending_notifications:
            success = NotificationService._deliver_mock(notif)
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            if success:
                notif.status = NotificationStatus.SENT
                notif.sent_at = now
            else:
                notif.status = NotificationStatus.FAILED
                notif.error_message = "Mock delivery failed."
            
            await notif.save()

    @staticmethod
    async def resolve_admin_recipients() -> List[User]:
        """Returns all active ADMIN users."""
        return await User.find(
            User.role == UserRole.ADMIN,
            User.is_active == True
        ).to_list()

    @staticmethod
    async def resolve_customer_recipients(company_id: uuid.UUID) -> List[User]:
        """Returns all active CUSTOMER_USER users for the given company."""
        return await User.find(
            User.role == UserRole.CUSTOMER_USER,
            User.customer_company_id == company_id,
            User.is_active == True
        ).to_list()
