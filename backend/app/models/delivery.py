import pymongo
import uuid
from typing import Optional, List
from datetime import datetime
from beanie import Document
from pydantic import Field
from app.models.enums import DeliveryRequestStatus

class DeliveryRequest(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    request_number: str # type: ignore
    customer_company_id: uuid.UUID
    
    # Cargo Snapshot
    goods_type: str
    goods_description: Optional[str] = None
    weight_tons: float
    special_instructions: Optional[str] = None
    
    # Pickup Snapshot
    pickup_company_name: str
    pickup_address: str
    pickup_contact_person: Optional[str] = None
    pickup_phone: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    
    # Destination Snapshot
    recipient_company_id: Optional[uuid.UUID] = None
    destination_company_name: str
    destination_address: str
    destination_contact_person: Optional[str] = None
    destination_phone: Optional[str] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    
    # Metrics
    distance_km: Optional[float] = None
    status: DeliveryRequestStatus = DeliveryRequestStatus.DRAFT
    cancellation_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Settings:
        name = "delivery_requests"

        indexes = [
            pymongo.IndexModel("settlement_id")
        ]
class Trip(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    request_id: uuid.UUID # type: ignore
    
    # Execution Timestamps
    assigned_at: datetime
    pickup_started_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Tracking
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    
    # Settlement
    settlement_id: Optional[uuid.UUID] = None # type: ignore

    class Settings:
        name = "trips"

        indexes = [
            pymongo.IndexModel("settlement_id")
        ]
class ProofOfDelivery(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    trip_id: uuid.UUID
    file_url: str
    receiver_name: Optional[str] = None
    receiver_phone: Optional[str] = None
    notes: Optional[str] = None
    submitted_at: datetime
    submitted_by: uuid.UUID
    
    class Settings:
        name = "proof_of_deliveries"

        indexes = [
            pymongo.IndexModel("settlement_id")
        ]
class LocationHistory(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    trip_id: uuid.UUID # type: ignore
    lat: float
    lng: float
    recorded_at: datetime # type: ignore

    class Settings:
        name = "location_histories"
        indexes = [
            pymongo.IndexModel("settlement_id")
        ]
