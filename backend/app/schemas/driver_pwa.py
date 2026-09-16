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
    special_instructions: Optional[str] = None
    
    pickup_company_name: str
    pickup_address: str
    pickup_contact_person: Optional[str] = None
    pickup_phone: Optional[str] = None
    
    destination_company_name: str
    destination_address: str
    destination_contact_person: Optional[str] = None
    destination_phone: Optional[str] = None
    
    vehicle_registration: str
    vehicle_type: VehicleType
    
    assigned_at: datetime
    pickup_started_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)
