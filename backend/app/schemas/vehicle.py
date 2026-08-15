from pydantic import BaseModel
from typing import Optional
from datetime import date

class VehicleBase(BaseModel):
    vehicle_number: str
    vehicle_type: str
    model: str
    capacity: str
    fuel_type: str
    insurance_expiry: Optional[date] = None
    fitness_expiry: Optional[date] = None
    pollution_expiry: Optional[date] = None
    status: Optional[str] = "AVAILABLE"

class VehicleCreate(VehicleBase):
    pass

class VehicleResponse(VehicleBase):
    id: int
    driver_id: Optional[int] = None

    class Config:
        from_attributes = True
