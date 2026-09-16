from pydantic import BaseModel, ConfigDict, Field
from decimal import Decimal
from typing import Optional, List
from datetime import datetime, date
import uuid
from app.models.enums import SettlementStatus

class DriverSettlementGenerate(BaseModel):
    driver_id: uuid.UUID
    period_start: datetime
    period_end: datetime
    base_pay: Decimal = Field(..., ge=0)
    deductions: Decimal = Field(default=0, ge=0)
    deduction_reason: Optional[str] = None

class DriverSettlementPay(BaseModel):
    reference_number: str

class DriverSettlementRead(BaseModel):
    id: uuid.UUID
    driver_id: uuid.UUID
    period_start: datetime
    period_end: datetime
    base_pay: Decimal
    reimbursements: Decimal
    deductions: Decimal
    deduction_reason: Optional[str]
    total_payout: Decimal
    status: SettlementStatus
    paid_at: Optional[datetime]
    reference_number: Optional[str]
    generated_by: uuid.UUID
    
    model_config = ConfigDict(from_attributes=True)
