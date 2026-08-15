from sqlalchemy.orm import Session
from app.services.notifications.channels.in_app import send_in_app
from app.services.notifications.channels.email import send_email
from app.services.notifications.channels.sms import send_sms

class NotificationService:
    @staticmethod
    def notify(db: Session, user_type: str, user_id: int, title: str, message: str, channels: list = ["IN_APP"]):
        """
        Dispatches notifications to the requested channels.
        Channels can be: IN_APP, EMAIL, SMS
        """
        if "IN_APP" in channels:
            send_in_app(db, user_type, user_id, title, message)
            
        if "EMAIL" in channels:
            send_email(user_type, user_id, title, message)
            
        if "SMS" in channels:
            send_sms(user_type, user_id, title, message)
