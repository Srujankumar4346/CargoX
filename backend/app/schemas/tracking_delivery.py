from typing import Optional, List
from datetime import datetime
import uuid
from pydantic import BaseModel, AnyHttpUrl, field_validator, ConfigDict


class PODSubmission(BaseModel):
    receiver_name: Optional[str] = None # Person who actually received the goods
    delivery_confirmed: bool = True # Driver confirms goods were handed over
    receiver_phone: Optional[str] = None
    pod_signature_url: Optional[AnyHttpUrl] = None
    pod_photo_url: Optional[AnyHttpUrl] = None
    notes: Optional[str] = None

    @field_validator("receiver_name", mode="before")
    @classmethod
    def validate_receiver_name(cls, value):
        if value is not None and not str(value).strip():
            raise ValueError("Recipient name cannot be empty.")
        return str(value).strip() if value else None

    @field_validator("pod_signature_url", "pod_photo_url", mode="before")
    @classmethod
    def validate_https(cls, value):
        if value is not None and not str(value).startswith("https://"):
            raise ValueError("URL must use HTTPS scheme")
        return value


class PODRead(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    receiver_name: Optional[str] = None
    receiver_phone: Optional[str] = None
    delivery_confirmed: bool = True
    status: str = "SUBMITTED" # SUBMITTED, VERIFIED, REJECTED
    rejection_reason: Optional[str] = None
    file_url: Optional[str] = None
    pod_signature_url: Optional[str] = None
    pod_photo_url: Optional[str] = None
    notes: Optional[str] = None
    submitted_at: datetime
    submitted_by: Optional[uuid.UUID] = None
    submitted_by_name: Optional[str] = None
    verified_at: Optional[datetime] = None
    verified_by: Optional[uuid.UUID] = None

    model_config = ConfigDict(from_attributes=True)


class PODRejection(BaseModel):
    rejection_reason: str

    @field_validator("rejection_reason", mode="before")
    @classmethod
    def validate_reason(cls, value):
        if not value or not str(value).strip():
            raise ValueError("A clear rejection reason is required.")
        return str(value).strip()

class LocationBreadcrumbRead(BaseModel):
    lat: float
    lng: float
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CustomerTrackingRead(BaseModel):
    request_id: uuid.UUID
    tracking_number: str
    status: str
    origin_address: str
    destination_address: str
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    last_location_update: Optional[datetime] = None
    is_live: bool
    submitted_at: datetime
    quoted_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    assigned_at: Optional[datetime] = None
    pickup_started_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    vehicle_registration: Optional[str] = None
    vehicle_type: Optional[str] = None
    vehicle_capacity_tons: Optional[float] = None
    breadcrumbs: List[LocationBreadcrumbRead] = []

    model_config = ConfigDict(from_attributes=True)
