from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from datetime import datetime
import uuid

from app.api.deps import get_current_admin
from app.models.user import User
from app.schemas.invoice import (
    InvoiceCreate, InvoiceAdminRead,
    PaymentCreate, PaymentRead
)
from app.services.invoice_service import InvoiceService

router = APIRouter()


@router.post("/trips/{trip_id}/invoice", response_model=InvoiceAdminRead, status_code=201)
async def generate_invoice(
    trip_id: uuid.UUID,
    invoice_in: InvoiceCreate,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Generates an invoice for a COMPLETED trip.
    Derives all financial figures from the frozen accepted Quotation.
    Invoice number is assigned from a concurrency-safe PostgreSQL sequence.
    Returns 409 if an invoice already exists for this trip.
    Requires Admin privileges.
    """
    return await InvoiceService.generate_invoice(trip_id, invoice_in, current_admin)


@router.get("/invoices/{invoice_id}", response_model=InvoiceAdminRead)
async def get_invoice(
    invoice_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Returns full invoice detail including internal pricing fields from the immutable Quotation.
    Requires Admin privileges.
    """
    return await InvoiceService.get_invoice_admin(invoice_id)


@router.get("/invoices", response_model=List[InvoiceAdminRead])
async def list_invoices(
    status: Optional[str] = Query(None, description="Filter by invoice status: UNPAID, PARTIALLY_PAID, PAID"),
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Lists all invoices across all customer companies.
    Optionally filter by status. Requires Admin privileges.
    """
    return await InvoiceService.list_invoices_admin(status)


@router.patch("/invoices/{invoice_id}/due-date", response_model=InvoiceAdminRead)
async def update_due_date(
    invoice_id: uuid.UUID,
    due_at: datetime,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Updates the due date on an UNPAID invoice.
    Returns 400 if the invoice already has payments recorded.
    Requires Admin privileges.
    """
    invoice = await InvoiceService.update_due_date(invoice_id, due_at, current_admin)
    return await InvoiceService.get_invoice_admin(invoice.id)


@router.post("/invoices/{invoice_id}/payments", response_model=PaymentRead, status_code=201)
async def record_payment(
    invoice_id: uuid.UUID,
    payment_in: PaymentCreate,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Records a payment against an invoice.
    Validates: amount > 0 and amount <= amount_due (no overpayment).
    Atomically updates amount_paid, amount_due, and invoice status.
    Requires Admin privileges.
    """
    return await InvoiceService.record_payment(invoice_id, payment_in, current_admin)


@router.get("/invoices/{invoice_id}/payments", response_model=List[PaymentRead])
async def list_payments(
    invoice_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Lists all payments recorded against a specific invoice.
    Requires Admin privileges.
    """
    from app.models.finance import Payment, Invoice
    from fastapi import HTTPException, status
    
    invoice = await Invoice.find_one(Invoice.id == invoice_id)
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
        
    payments = await Payment.find(Payment.invoice_id == invoice_id).to_list()
    return payments
