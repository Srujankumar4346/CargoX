from typing import Optional, List
from pydantic import BaseModel, ConfigDict, field_validator
from decimal import Decimal
from datetime import datetime
import uuid

from app.models.enums import InvoiceStatus, PaymentMethod


class InvoiceCreate(BaseModel):
    """Admin input for invoice generation. trip_id comes from path parameter."""
    due_at: Optional[datetime] = None


class PaymentCreate(BaseModel):
    """Admin input for recording a payment against an invoice."""
    amount: Decimal
    method: PaymentMethod
    reference_number: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v):
        if v <= Decimal("0"):
            raise ValueError("Payment amount must be greater than zero")
        return v


class PaymentRead(BaseModel):
    """Serialized payment record."""
    id: uuid.UUID
    invoice_id: uuid.UUID
    amount: Decimal
    method: PaymentMethod
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    paid_at: datetime
    recorded_by: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


class InvoiceAdminRead(BaseModel):
    """
    Full invoice view for Admin.
    Includes internal pricing fields joined from the immutable Quotation.
    """
    id: uuid.UUID
    invoice_number: str
    request_id: uuid.UUID
    quotation_id: uuid.UUID
    customer_company_id: uuid.UUID

    # Invoice financials (from Invoice model)
    subtotal: Decimal
    tax: Decimal
    discount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    amount_due: Decimal
    status: InvoiceStatus

    # Timestamps
    issued_at: datetime
    due_at: Optional[datetime] = None

    # Pricing internals (joined from immutable Quotation — NOT stored on Invoice)
    distance_km: Optional[Decimal] = None
    base_rate_per_km: Optional[Decimal] = None
    internal_base_cost: Optional[Decimal] = None
    cargox_margin: Optional[Decimal] = None
    customer_total_charge: Optional[Decimal] = None

    # Payments
    payments: List[PaymentRead] = []

    model_config = ConfigDict(from_attributes=True)


class CustomerInvoiceRead(BaseModel):
    """
    Customer-facing invoice view.
    Deliberately excludes internal_base_cost, cargox_margin, and all pricing internals.
    """
    id: uuid.UUID
    invoice_number: str
    request_id: uuid.UUID

    # Only what the customer needs
    total_amount: Decimal
    amount_paid: Decimal
    amount_due: Decimal
    status: InvoiceStatus

    issued_at: datetime
    due_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
