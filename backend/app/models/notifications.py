import pymongo
from typing import Optional
from datetime import datetime
from beanie import Document
from pydantic import Field
import uuid
import enum

class NotificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"

class NotificationChannel(str, enum.Enum):
    IN_APP = "IN_APP"
    MOCK_EMAIL = "MOCK_EMAIL"

class Notification(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    event_id: str # type: ignore
    event_type: str
    recipient_user_id: uuid.UUID
    channel: NotificationChannel
    title: str
    message: str
    status: NotificationStatus = NotificationStatus.PENDING
    created_at: datetime
    sent_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Settings:
        name = "notifications"
