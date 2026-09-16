from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True) # E.g., customer_id or admin=0 or driver_id
    user_type = Column(String) # "CUSTOMER", "ADMIN", "DRIVER"
    event_type = Column(String, index=True) # e.g. "BOOKING_CREATED", "TRIP_STARTED"
    title = Column(String)
    message = Column(String)
    channel = Column(String, default="IN_APP") # "IN_APP", "EMAIL", "SMS", "WHATSAPP"
    is_read = Column(Boolean, default=False)
    delivery_status = Column(String, default="PENDING") # "PENDING", "SENT", "FAILED"
    metadata_payload = Column(JSONB, nullable=True) # Renamed from metadata to avoid SQLAlchemy conflicts
    created_at = Column(DateTime(timezone=True), server_default=func.now())
