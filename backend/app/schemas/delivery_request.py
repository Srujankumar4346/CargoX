from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Optional
from datetime import datetime
import uuid

class DeliveryRequestCreate(BaseModel):
    # Cargo
    goods_type: str = Field(..., min_length=1)
    goods_description: Optional[str] = None
    weight_tons: float = Field(..., gt=0.0)
    special_instructions: Optional[str] = None
    
    # Pickup
    pickup_company_name: str = Field(..., min_length=1)
    pickup_address: str = Field(..., min_length=1)
    pickup_contact_person: Optional[str] = None
    pickup_phone: Optional[str] = None
    pickup_lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    pickup_lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    
    # Destination (Mutually exclusive: ID or manual fields)
    recipient_company_id: Optional[uuid.UUID] = None
    destination_company_name: Optional[str] = None
    destination_address: Optional[str] = None
    destination_contact_person: Optional[str] = None
    destination_phone: Optional[str] = None
    destination_lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    destination_lng: Optional[float] = Field(None, ge=-180.0, le=180.0)

    @model_validator(mode='after')
    def validate_destination_mode(self):
        # Either we have recipient_company_id, OR we have the required manual fields.
        if self.recipient_company_id is not None:
            # If ID is provided, we MUST NOT accept manual fields
            if any([
                self.destination_company_name,
                self.destination_address,
                self.destination_contact_person,
                self.destination_phone,
                self.destination_lat,
                self.destination_lng
            ]):
                raise ValueError("Cannot provide manual destination fields when recipient_company_id is provided")
        else:
            # If ID is not provided, we MUST have the required manual fields
            if not self.destination_company_name or not self.destination_address:
                raise ValueError("Must provide either recipient_company_id or manual destination_company_name and destination_address")
        
        return self

class DeliveryRequestRead(BaseModel):
    id: uuid.UUID
    request_number: str
    
    goods_type: str
    goods_description: Optional[str]
    weight_tons: float
    special_instructions: Optional[str]
    
    pickup_company_name: str
    pickup_address: str
    pickup_contact_person: Optional[str]
    pickup_phone: Optional[str]
    pickup_lat: Optional[float]
    pickup_lng: Optional[float]
    
    recipient_company_id: Optional[uuid.UUID]
    destination_company_name: str
    destination_address: str
    destination_contact_person: Optional[str]
    destination_phone: Optional[str]
    destination_lat: Optional[float]
    destination_lng: Optional[float]
    
    status: str
    created_at: datetime
    updated_at: datetime
    cancellation_reason: Optional[str] = None
    assigned_driver_name: Optional[str] = None
    assigned_driver_phone: Optional[str] = None
    assigned_vehicle_registration: Optional[str] = None
    assigned_vehicle_type: Optional[str] = None
    assigned_vehicle_capacity_tons: Optional[float] = None
    
    model_config = ConfigDict(from_attributes=True)

class CancelRequestSchema(BaseModel):
    reason: str = Field(..., min_length=1, description="Reason for cancellation")

class DeliveryRequestUpdate(BaseModel):
    # Cargo
    goods_type: Optional[str] = Field(None, min_length=1)
    goods_description: Optional[str] = None
    weight_tons: Optional[float] = Field(None, gt=0.0)
    special_instructions: Optional[str] = None
    
    # Pickup
    pickup_company_name: Optional[str] = Field(None, min_length=1)
    pickup_address: Optional[str] = Field(None, min_length=1)
    pickup_contact_person: Optional[str] = None
    pickup_phone: Optional[str] = None
    
    # Destination
    destination_company_name: Optional[str] = None
    destination_address: Optional[str] = None
    destination_contact_person: Optional[str] = None
    destination_phone: Optional[str] = None
