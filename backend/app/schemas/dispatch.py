from pydantic import BaseModel, ConfigDict
import uuid
from datetime import datetime
from typing import Optional
from app.models.enums import DeliveryRequestStatus

class DispatchRequest(BaseModel):
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID

class VehicleAssignmentRead(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID
    assigned_at: datetime
    released_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class DispatchRead(BaseModel):
    trip_id: uuid.UUID
    request_id: uuid.UUID
    vehicle_id: uuid.UUID
    driver_id: uuid.UUID
    assigned_at: datetime
    request_status: DeliveryRequestStatus
    assignment: VehicleAssignmentRead

    model_config = ConfigDict(from_attributes=True)
