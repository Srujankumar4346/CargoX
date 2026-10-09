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
        indexes = [
            pymongo.IndexModel("registration_number", unique=True),
            pymongo.IndexModel("status"),
        ]

class Driver(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    user_id: Optional[uuid.UUID] = None
    email: str
    username: Optional[str] = None
    password_hash: Optional[str] = None
    aadhaar_number: str
    age: int
    name: str
    phone: str
    license_number: str # type: ignore
    status: DriverStatus = DriverStatus.AVAILABLE
    
    class Settings:
        name = "drivers"
        indexes = [
            pymongo.IndexModel("user_id", sparse=True),
            pymongo.IndexModel("status"),
            pymongo.IndexModel("phone"),
            pymongo.IndexModel("email", unique=True),
        ]

class VehicleAssignment(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    trip_id: uuid.UUID
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID
    assigned_at: datetime
    released_at: Optional[datetime] = None
    
    class Settings:
        name = "vehicle_assignments"
        indexes = [
            pymongo.IndexModel([("trip_id", pymongo.ASCENDING), ("assigned_at", pymongo.DESCENDING)]),
            pymongo.IndexModel([("driver_id", pymongo.ASCENDING), ("released_at", pymongo.ASCENDING)]),
            pymongo.IndexModel("vehicle_id"),
        ]
