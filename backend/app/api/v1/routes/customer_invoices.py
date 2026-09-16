from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.api.deps import get_current_customer_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.invoice import CustomerInvoiceRead
from app.services.invoice_service import InvoiceService

router = APIRouter()


@router.get("", response_model=List[CustomerInvoiceRead])
def list_customer_invoices(
    current_user: User = Depends(get_current_customer_user),
    db: Session = Depends(get_db)
):
    """
    Lists all invoices belonging to the authenticated customer's company.
    Tenant-scoped: only returns invoices for the customer's own company.
    Excludes internal pricing fields (internal_base_cost, cargox_margin).
    """
    return InvoiceService.list_invoices_customer(db, current_user)


@router.get("/{invoice_id}", response_model=CustomerInvoiceRead)
def get_customer_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user),
    db: Session = Depends(get_db)
):
    """
    Returns customer-facing invoice detail for a specific invoice.
    Enforces tenant isolation: returns 404 if the invoice belongs to a different company.
    Excludes internal pricing fields (internal_base_cost, cargox_margin).
    """
    return InvoiceService.get_invoice_customer(db, invoice_id, current_user)
