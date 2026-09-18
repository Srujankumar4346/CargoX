import pymongo
import uuid
from typing import Optional
from datetime import datetime
from decimal import Decimal
from beanie import Document
from pydantic import Field
from app.models.enums import InvoiceStatus, PaymentMethod, SettlementStatus

class Invoice(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    invoice_number: str # type: ignore
    request_id: uuid.UUID # type: ignore
    customer_company_id: uuid.UUID # type: ignore
    quotation_id: uuid.UUID
    
    # Financials
    subtotal: Decimal
    tax: Decimal = Decimal('0.00')
    discount: Decimal = Decimal('0.00')
    total_amount: Decimal
    amount_paid: Decimal = Decimal('0.00')
    amount_due: Decimal
    
    # Status
    status: InvoiceStatus = InvoiceStatus.UNPAID # type: ignore
    
    # Timestamps
    issued_at: datetime
    due_at: Optional[datetime] = None
    
    class Settings:
        name = "invoices"

        indexes = [
            pymongo.IndexModel("status"),
            pymongo.IndexModel("reference_number", unique=True),
            pymongo.IndexModel("status"),
            pymongo.IndexModel("reference_number", unique=True)
        ]
class Payment(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    invoice_id: uuid.UUID
    
    # Payment Details
    amount: Decimal
    method: PaymentMethod
    reference_number: Optional[str] = None # type: ignore
    notes: Optional[str] = None
    
    # Timestamps
    paid_at: datetime
    recorded_by: uuid.UUID
    
    class Settings:
        name = "payments"

        indexes = [
            pymongo.IndexModel("status"),
            pymongo.IndexModel("reference_number", unique=True),
            pymongo.IndexModel("status"),
            pymongo.IndexModel("reference_number", unique=True)
        ]
class DriverSettlement(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    driver_id: uuid.UUID # type: ignore
    
    period_start: datetime
    period_end: datetime
    
    base_pay: Decimal = Decimal('0.00')
    reimbursements: Decimal = Decimal('0.00')
    deductions: Decimal = Decimal('0.00')
    total_payout: Decimal = Decimal('0.00')
    
    deduction_reason: Optional[str] = None
    
    status: SettlementStatus = SettlementStatus.DRAFT # type: ignore
    paid_at: Optional[datetime] = None
    reference_number: Optional[str] = None # type: ignore
    
    generated_by: uuid.UUID
    
    class Settings:
        name = "driver_settlements"
        indexes = [
            pymongo.IndexModel("status"),
            pymongo.IndexModel("reference_number", unique=True),
            pymongo.IndexModel("status"),
            pymongo.IndexModel("reference_number", unique=True)
        ]
