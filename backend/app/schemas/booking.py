from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class BookingBase(BaseModel):
    pickup_address: str
    pickup_latitude: Optional[float] = None
    pickup_longitude: Optional[float] = None
    drop_address: str
    drop_latitude: Optional[float] = None
    drop_longitude: Optional[float] = None
    cargo_type: str
    cargo_weight: float

class BookingCreate(BookingBase):
    customer_id: int

class BookingResponse(BookingBase):
    id: int
    customer_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
