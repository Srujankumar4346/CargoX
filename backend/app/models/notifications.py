from sqlalchemy import Column, String, DateTime, Enum, ForeignKey, Text
from app.db.base import Base
import uuid
from sqlalchemy.dialects.postgresql import UUID
import enum

class NotificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"

class NotificationChannel(str, enum.Enum):
    IN_APP = "IN_APP"
    MOCK_EMAIL = "MOCK_EMAIL"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    event_id = Column(String, unique=True, index=True, nullable=False)
    event_type = Column(String, nullable=False)
    recipient_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    channel = Column(Enum(NotificationChannel), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(Enum(NotificationStatus), default=NotificationStatus.PENDING, nullable=False)
    created_at = Column(DateTime, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
