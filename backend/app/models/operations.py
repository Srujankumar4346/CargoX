import pymongo
import uuid
from typing import Optional, Annotated
from datetime import datetime
from decimal import Decimal
from beanie import Document
from bson import Decimal128
from pydantic import Field, BeforeValidator

def convert_decimal128(v):
    if isinstance(v, Decimal128):
        return str(v)
    return v

DecimalType = Annotated[Decimal, BeforeValidator(convert_decimal128)]
from app.models.enums import ExpenseCategory, ExpenseStatus, MaintenanceType, MaintenanceStatus, ExpensePayer

class TripExpense(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    trip_id: uuid.UUID # type: ignore
    
    amount: DecimalType
    category: ExpenseCategory # type: ignore
    status: ExpenseStatus = ExpenseStatus.PENDING_APPROVAL # type: ignore
    date: datetime
    description: Optional[str] = None
    receipt_url: Optional[str] = None
    paid_by: ExpensePayer = ExpensePayer.CARGOX
    
    recorded_by: uuid.UUID
    
    class Settings:
        name = "trip_expenses"

        indexes = [
            pymongo.IndexModel("status"),
            pymongo.IndexModel("status")
        ]
class VehicleMaintenance(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    vehicle_id: uuid.UUID # type: ignore
    
    maintenance_type: MaintenanceType # type: ignore
    status: MaintenanceStatus = MaintenanceStatus.SCHEDULED # type: ignore
    cost: Optional[DecimalType] = None
    
    scheduled_date: datetime
    completed_date: Optional[datetime] = None
    
    description: Optional[str] = None
    mechanic_notes: Optional[str] = None
    recorded_by: uuid.UUID
    
    class Settings:
        name = "vehicle_maintenance"
        indexes = [
            pymongo.IndexModel("status"),
            pymongo.IndexModel("status")
        ]
