from pydantic import BaseModel, ConfigDict, Field
import uuid
from typing import Optional
from datetime import datetime
from decimal import Decimal

from app.models.enums import ExpenseCategory, ExpenseStatus, MaintenanceType, MaintenanceStatus

# --- Trip Expense Schemas ---

class TripExpenseCreateBase(BaseModel):
    amount: Decimal = Field(..., gt=0)
    category: ExpenseCategory
    description: Optional[str] = None
    receipt_url: Optional[str] = None

class TripExpenseCreate(TripExpenseCreateBase):
    pass

class TripExpenseRead(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    amount: Decimal
    category: ExpenseCategory
    status: ExpenseStatus
    date: datetime
    description: Optional[str]
    receipt_url: Optional[str]
    recorded_by: uuid.UUID

    model_config = ConfigDict(from_attributes=True)

class ExpenseStatusUpdate(BaseModel):
    status: ExpenseStatus

# --- Vehicle Maintenance Schemas ---

class VehicleMaintenanceCreate(BaseModel):
    maintenance_type: MaintenanceType
    scheduled_date: datetime
    description: Optional[str] = None

class VehicleMaintenanceComplete(BaseModel):
    cost: Decimal = Field(..., gt=0)
    mechanic_notes: Optional[str] = None

class VehicleMaintenanceRead(BaseModel):
    id: uuid.UUID
    vehicle_id: uuid.UUID
    maintenance_type: MaintenanceType
    status: MaintenanceStatus
    cost: Optional[Decimal]
    scheduled_date: datetime
    completed_date: Optional[datetime]
    description: Optional[str]
    mechanic_notes: Optional[str]
    recorded_by: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
