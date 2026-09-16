from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import uuid

from app.api.deps import get_current_admin
from app.db.database import get_db
from app.models.user import User
from app.schemas.invoice import (
    InvoiceCreate, InvoiceAdminRead,
    PaymentCreate, PaymentRead
)
from app.services.invoice_service import InvoiceService

router = APIRouter()


@router.post("/trips/{trip_id}/invoice", response_model=InvoiceAdminRead, status_code=201)
def generate_invoice(
    trip_id: uuid.UUID,
    invoice_in: InvoiceCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Generates an invoice for a COMPLETED trip.
    Derives all financial figures from the frozen accepted Quotation.
    Invoice number is assigned from a concurrency-safe PostgreSQL sequence.
    Returns 409 if an invoice already exists for this trip.
    Requires Admin privileges.
    """
    return InvoiceService.generate_invoice(db, trip_id, invoice_in, current_admin)


@router.get("/invoices/{invoice_id}", response_model=InvoiceAdminRead)
def get_invoice(
    invoice_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Returns full invoice detail including internal pricing fields from the immutable Quotation.
    Requires Admin privileges.
    """
    return InvoiceService.get_invoice_admin(db, invoice_id)


@router.get("/invoices", response_model=List[InvoiceAdminRead])
def list_invoices(
    status: Optional[str] = Query(None, description="Filter by invoice status: UNPAID, PARTIALLY_PAID, PAID"),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Lists all invoices across all customer companies.
    Optionally filter by status. Requires Admin privileges.
    """
    return InvoiceService.list_invoices_admin(db, status)


@router.patch("/invoices/{invoice_id}/due-date", response_model=InvoiceAdminRead)
def update_due_date(
    invoice_id: uuid.UUID,
    due_at: datetime,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Updates the due date on an UNPAID invoice.
    Returns 400 if the invoice already has payments recorded.
    Requires Admin privileges.
    """
    invoice = InvoiceService.update_due_date(db, invoice_id, due_at, current_admin)
    return InvoiceService.get_invoice_admin(db, invoice.id)


@router.post("/invoices/{invoice_id}/payments", response_model=PaymentRead, status_code=201)
def record_payment(
    invoice_id: uuid.UUID,
    payment_in: PaymentCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Records a payment against an invoice.
    Validates: amount > 0 and amount <= amount_due (no overpayment).
    Atomically updates amount_paid, amount_due, and invoice status.
    Requires Admin privileges.
    """
    return InvoiceService.record_payment(db, invoice_id, payment_in, current_admin)


@router.get("/invoices/{invoice_id}/payments", response_model=List[PaymentRead])
def list_payments(
    invoice_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Lists all payments recorded against a specific invoice.
    Requires Admin privileges.
    """
    from app.models.finance import Payment, Invoice
    from fastapi import HTTPException, status
    
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
        
    payments = db.query(Payment).filter(Payment.invoice_id == invoice_id).all()
    return payments
