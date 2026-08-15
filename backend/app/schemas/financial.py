from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from decimal import Decimal

# -----------------
# INVOICES
# -----------------
class InvoiceBase(BaseModel):
    booking_id: int
    customer_id: int
    base_charge: Decimal
    taxes: Decimal
    discount: Decimal = Decimal('0.0')
    total_amount: Decimal
    amount_paid: Decimal = Decimal('0.0')
    amount_due: Decimal
    currency: str = "INR"
    due_date: Optional[date] = None
    status: str = "PENDING"

class InvoiceCreate(InvoiceBase):
    pass

class InvoiceResponse(InvoiceBase):
    id: int
    invoice_number: str
    issue_date: date

    class Config:
        from_attributes = True

# -----------------
# PAYMENTS
# -----------------
class PaymentBase(BaseModel):
    invoice_id: int
    amount: Decimal
    payment_method: str
    payment_type: str
    payment_reference: Optional[str] = None
    recorded_by: str
    notes: Optional[str] = None

class PaymentCreate(PaymentBase):
    pass

class PaymentResponse(PaymentBase):
    id: int
    transaction_date: datetime

    class Config:
        from_attributes = True

# -----------------
# EXPENSES
# -----------------
class ExpenseBase(BaseModel):
    trip_id: int
    expense_type: str
    amount: Decimal
    description: Optional[str] = None
    recorded_by: str
    status: str = "PENDING"

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseResponse(ExpenseBase):
    id: int
    expense_date: date

    class Config:
        from_attributes = True
