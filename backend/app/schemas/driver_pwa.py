from pydantic import BaseModel, ConfigDict, Field
from decimal import Decimal
import uuid
from typing import Optional
from datetime import datetime
from app.models.enums import DeliveryRequestStatus, VehicleType

class LocationUpdate(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude coordinate")
    lng: float = Field(..., ge=-180.0, le=180.0, description="Longitude coordinate")

class DriverTripRead(BaseModel):
    trip_id: uuid.UUID
    request_id: uuid.UUID
    request_number: str
    status: DeliveryRequestStatus
    goods_type: str
    goods_description: Optional[str] = None
    weight_tons: Decimal
    distance_km: Optional[Decimal] = None
    special_instructions: Optional[str] = None
    
    pickup_company_name: str
    pickup_address: str
    pickup_contact_person: Optional[str] = None
    pickup_phone: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    
    destination_company_name: str
    destination_address: str
    destination_contact_person: Optional[str] = None
    destination_phone: Optional[str] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    
    vehicle_registration: str
    vehicle_type: VehicleType
    
    assigned_at: datetime
    pickup_started_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None

    # Pay on Delivery & Payment Info (strictly isolated from internal fees/margins)
    payment_method: Optional[str] = None
    collection_status: Optional[str] = None # "DUE", "COLLECTED", "PENDING_VERIFICATION", "NOT_REQUIRED"
    amount_due_for_collection: Optional[Decimal] = None
    invoice_number: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DriverCollectionCreate(BaseModel):
    collection_method: str = Field(..., description="CASH or UPI collected at delivery")
    amount: Decimal = Field(..., gt=Decimal("0.00"), description="Actual amount collected")
    reference_number: Optional[str] = Field(None, description="UPI reference/UTR or cash receipt number")
    notes: Optional[str] = Field(None, description="Driver collection remarks")


class DriverCollectionRead(BaseModel):
    payment_id: uuid.UUID
    invoice_id: uuid.UUID
    invoice_number: str
    trip_id: uuid.UUID
    amount_collected: Decimal
    collection_method: str
    reference_number: Optional[str] = None
    collected_at: datetime
    remaining_balance: Decimal
    invoice_status: str
    message: str
