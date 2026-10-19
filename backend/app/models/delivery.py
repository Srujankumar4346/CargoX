import pymongo
import uuid
from typing import Optional, List
from datetime import datetime
from beanie import Document
from pydantic import Field
from app.models.enums import DeliveryRequestStatus
from app.models.pricing import DecimalType

class DeliveryRequest(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    request_number: str # type: ignore
    customer_company_id: uuid.UUID
    
    # Cargo Snapshot
    goods_type: str
    goods_description: Optional[str] = None
    weight_tons: float
    special_instructions: Optional[str] = None
    load_type: str = "PART_LOAD" # "PART_LOAD" or "FULL_TRUCK"
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    package_count: Optional[int] = None
    
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
    distance_km: Optional[DecimalType] = None
    vehicle_capacity_tons: Optional[float] = None
    selected_vehicle_id: Optional[str] = None
    status: DeliveryRequestStatus = DeliveryRequestStatus.DRAFT
    cancellation_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Settings:
        name = "delivery_requests"
        indexes = [
            pymongo.IndexModel([("customer_company_id", pymongo.ASCENDING), ("created_at", pymongo.DESCENDING)]),
            pymongo.IndexModel([("created_at", pymongo.DESCENDING)]),
            pymongo.IndexModel("status"),
            pymongo.IndexModel("load_type"),
            pymongo.IndexModel("request_number", unique=True),
        ]

class TripStop(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    trip_id: uuid.UUID
    request_id: uuid.UUID
    stop_sequence: int # 1, 2, 3...
    stop_type: str # "PICKUP" or "DROP"
    company_name: str
    address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    cargo_summary: Optional[str] = None
    cargo_weight_kg: Optional[float] = None
    status: str = "PENDING" # "PENDING", "ARRIVED", "COMPLETED", "FAILED"
    otp_verified: bool = False
    otp_verified_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None

    class Settings:
        name = "trip_stops"
        indexes = [
            pymongo.IndexModel([("trip_id", pymongo.ASCENDING), ("stop_sequence", pymongo.ASCENDING)]),
            pymongo.IndexModel("request_id"),
            pymongo.IndexModel("status"),
        ]

class Trip(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    # For single-request / legacy trips, request_id is retained.
    # For consolidated Part Load trips, request_id points to primary request and request_ids holds all requests.
    request_id: uuid.UUID # type: ignore
    request_ids: List[uuid.UUID] = Field(default_factory=list)
    trip_type: str = "FULL_TRUCK" # "FULL_TRUCK" or "CONSOLIDATED_PART_LOAD"
    total_weight_tons: Optional[float] = None
    
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
    
    # Settlement & Payout
    settlement_id: Optional[uuid.UUID] = None # type: ignore
    driver_payout: Optional[DecimalType] = None
    commission_percentage: Optional[DecimalType] = None
    commission_amount: Optional[DecimalType] = None

    class Settings:
        name = "trips"
        indexes = [
            pymongo.IndexModel("request_id"),
            pymongo.IndexModel("request_ids"),
            pymongo.IndexModel("trip_type"),
            pymongo.IndexModel("settlement_id", sparse=True),
        ]
class ProofOfDelivery(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    trip_id: uuid.UUID
    file_url: str
    receiver_name: Optional[str] = None
    receiver_phone: Optional[str] = None
    notes: Optional[str] = None
    delivery_confirmed: bool = True
    status: str = "SUBMITTED" # "SUBMITTED", "VERIFIED", "REJECTED"
    rejection_reason: Optional[str] = None
    verified_by: Optional[uuid.UUID] = None
    verified_at: Optional[datetime] = None
    submitted_at: datetime
    submitted_by: uuid.UUID
    
    # Secure Handover OTP Verification Audit
    otp_verified: bool = False
    otp_verified_at: Optional[datetime] = None
    otp_is_override: bool = False
    otp_override_reason: Optional[str] = None
    
    class Settings:
        name = "proof_of_deliveries"
        indexes = [
            pymongo.IndexModel("trip_id"),
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
            pymongo.IndexModel([("trip_id", pymongo.ASCENDING), ("recorded_at", pymongo.DESCENDING)]),
        ]
