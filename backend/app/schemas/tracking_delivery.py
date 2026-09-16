from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

class PODSubmission(BaseModel):
    pod_signature_url: Optional[str] = None
    pod_photo_url: Optional[str] = None
    notes: Optional[str] = None

class PODRead(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    pod_signature_url: Optional[str] = None
    pod_photo_url: Optional[str] = None
    notes: Optional[str] = None
    submitted_at: datetime
    verified_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class LocationBreadcrumbRead(BaseModel):
    lat: float
    lng: float
    recorded_at: datetime

    class Config:
        from_attributes = True

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
    breadcrumbs: List[LocationBreadcrumbRead] = []

    class Config:
        from_attributes = True
