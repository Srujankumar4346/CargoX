from pydantic import BaseModel, ConfigDict, Field
from decimal import Decimal
import uuid
from typing import Optional
from app.models.enums import VehicleType, VehicleStatus, DriverStatus

class VehicleCreate(BaseModel):
    registration_number: str = Field(..., min_length=1, description="Registration number of the vehicle")
    type: VehicleType
    capacity_tons: Decimal = Field(..., gt=Decimal("0"), description="Capacity of the vehicle in tons")

class VehicleUpdate(BaseModel):
    registration_number: Optional[str] = None
    type: Optional[VehicleType] = None
    capacity_tons: Optional[Decimal] = Field(default=None, gt=Decimal("0"))
    status: Optional[VehicleStatus] = None

class VehicleRead(BaseModel):
    id: uuid.UUID
    registration_number: str
    type: VehicleType
    capacity_tons: Decimal
    status: VehicleStatus

    model_config = ConfigDict(from_attributes=True)

class DriverCreate(BaseModel):
    user_id: uuid.UUID
    name: str = Field(..., min_length=1)
    phone: str = Field(..., min_length=1)
    license_number: str = Field(..., min_length=1)

class DriverUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    license_number: Optional[str] = None
    status: Optional[DriverStatus] = None

class DriverRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    phone: str
    license_number: str
    status: DriverStatus

    model_config = ConfigDict(from_attributes=True)
