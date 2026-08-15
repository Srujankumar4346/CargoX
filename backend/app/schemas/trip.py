from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class TripBase(BaseModel):
    booking_id: int
    driver_id: int
    vehicle_id: int

class TripCreate(TripBase):
    pass

class TripStatusHistoryResponse(BaseModel):
    id: int
    status: str
    location: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

class TripResponse(TripBase):
    id: int
    status: str
    created_at: datetime
    status_history: List[TripStatusHistoryResponse] = []

    class Config:
        from_attributes = True
