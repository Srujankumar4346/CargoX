import pymongo
import uuid
from typing import Optional, Annotated
from datetime import datetime
from decimal import Decimal
from beanie import Document
from bson import Decimal128
from pydantic import Field, BeforeValidator
from app.models.enums import InvoiceStatus, PaymentMethod, SettlementStatus

def convert_decimal128(v):
    if isinstance(v, Decimal128):
        return str(v)
    return v

DecimalType = Annotated[Decimal, BeforeValidator(convert_decimal128)]

class Invoice(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    invoice_number: str # type: ignore
    request_id: uuid.UUID # type: ignore
    customer_company_id: uuid.UUID # type: ignore
    quotation_id: uuid.UUID
    
    # Financials
    subtotal: DecimalType
    tax: DecimalType = Decimal('0.00')
    discount: DecimalType = Decimal('0.00')
    total_amount: DecimalType
    amount_paid: DecimalType = Decimal('0.00')
    amount_due: DecimalType
    
    # Status
    status: InvoiceStatus = InvoiceStatus.UNPAID # type: ignore
    
    # Timestamps
    issued_at: datetime
    due_at: Optional[datetime] = None
    
    class Settings:
        name = "invoices"
        indexes = [
            pymongo.IndexModel("status"),
            pymongo.IndexModel("invoice_number", unique=True),
            pymongo.IndexModel("request_id", unique=True),
            pymongo.IndexModel("customer_company_id"),
        ]

class Payment(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    invoice_id: uuid.UUID
    
    # Payment Details
    amount: DecimalType
    method: PaymentMethod
    reference_number: Optional[str] = None # type: ignore
    notes: Optional[str] = None
    
    # Timestamps
    paid_at: datetime
    recorded_by: uuid.UUID
    
    class Settings:
        name = "payments"
        indexes = [
            pymongo.IndexModel("invoice_id"),
            pymongo.IndexModel("reference_number", unique=True, sparse=True),
        ]
class DriverSettlement(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    driver_id: uuid.UUID # type: ignore
    
    period_start: datetime
    period_end: datetime
    
    base_pay: DecimalType = Decimal('0.00')
    reimbursements: DecimalType = Decimal('0.00')
    deductions: DecimalType = Decimal('0.00')
    total_payout: DecimalType = Decimal('0.00')
    
    deduction_reason: Optional[str] = None
    
    status: SettlementStatus = SettlementStatus.DRAFT # type: ignore
    paid_at: Optional[datetime] = None
    reference_number: Optional[str] = None # type: ignore
    
    generated_by: uuid.UUID
    
    class Settings:
        name = "driver_settlements"
        indexes = [
            pymongo.IndexModel("status"),
            pymongo.IndexModel("driver_id"),
            pymongo.IndexModel("reference_number", unique=True, sparse=True),
        ]

