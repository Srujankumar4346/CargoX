from typing import Optional, List
from datetime import datetime
import uuid
from pydantic import BaseModel, AnyHttpUrl, field_validator, ConfigDict


class PODSubmission(BaseModel):
    pod_signature_url: Optional[AnyHttpUrl] = None
    pod_photo_url: Optional[AnyHttpUrl] = None
    notes: Optional[str] = None

    @field_validator("pod_signature_url", "pod_photo_url", mode="before")
    @classmethod
    def validate_https(cls, value):
        if value is not None and not str(value).startswith("https://"):
            raise ValueError("URL must use HTTPS scheme")
        return value


class PODRead(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    pod_signature_url: Optional[str] = None
    pod_photo_url: Optional[str] = None
    notes: Optional[str] = None
    submitted_at: datetime
    verified_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

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
