import pymongo
import uuid
from typing import Optional
from datetime import datetime
from beanie import Document
from pydantic import Field
from app.models.enums import VehicleType, VehicleStatus, DriverStatus

class Vehicle(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    registration_number: str # type: ignore
    type: VehicleType
    capacity_tons: float
    status: VehicleStatus = VehicleStatus.AVAILABLE
    
    class Settings:
        name = "vehicles"

class Driver(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    user_id: uuid.UUID # type: ignore
    name: str
    phone: str
    license_number: str # type: ignore
    status: DriverStatus = DriverStatus.AVAILABLE
    
    class Settings:
        name = "drivers"

class VehicleAssignment(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    trip_id: uuid.UUID
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID
    assigned_at: datetime
    released_at: Optional[datetime] = None
    
    class Settings:
        name = "vehicle_assignments"
