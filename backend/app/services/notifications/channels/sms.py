import logging

logger = logging.getLogger(__name__)

def send_sms(user_type: str, user_id: int, event_type: str, title: str, message: str, metadata: dict = None):
    # STUB implementation
    logger.info(f"[SMS STUB] To: {user_type} #{user_id} | Event: {event_type} | Title: {title}")
