import pymongo
import uuid
from typing import Optional, Literal
from datetime import datetime, timezone
from beanie import Document
from pydantic import Field

class DeliveryOTP(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    request_id: uuid.UUID
    trip_id: uuid.UUID
    purpose: str = "DELIVERY"  # "PICKUP" or "DELIVERY"
    recipient_phone: Optional[str] = None  # Optional customer/recipient phone metadata
    hashed_otp: str       # SHA-256 hash of the 6-digit code for driver verification
    encrypted_otp: Optional[str] = None  # Fernet encrypted 6-digit code for customer retrieval
    expires_at: datetime
    attempts: int = 0
    max_attempts: int = 5
    resend_count: int = 0
    max_resends: int = 3
    is_consumed: bool = False
    consumed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    last_sent_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    
    # Audit info
    verified_by_user_id: Optional[uuid.UUID] = None
    is_admin_override: bool = False
    override_reason: Optional[str] = None
    override_by_user_id: Optional[uuid.UUID] = None
    
    class Settings:
        name = "delivery_otps"
        indexes = [
            pymongo.IndexModel([("request_id", pymongo.ASCENDING), ("purpose", pymongo.ASCENDING), ("is_consumed", pymongo.ASCENDING)]),
            pymongo.IndexModel([("trip_id", pymongo.ASCENDING), ("purpose", pymongo.ASCENDING)]),
            pymongo.IndexModel("expires_at"),
            pymongo.IndexModel("created_at"),
        ]

