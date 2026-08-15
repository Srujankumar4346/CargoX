from pydantic import BaseModel
from typing import Optional
from datetime import date

class DriverBase(BaseModel):
    full_name: str
    phone_number: str
    license_number: str
    license_expiry: Optional[date] = None
    status: Optional[str] = "AVAILABLE"

class DriverCreate(DriverBase):
    user_id: int

class DriverResponse(DriverBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True
