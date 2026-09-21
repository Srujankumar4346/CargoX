from fastapi import APIRouter, Depends
from typing import List
import uuid

from app.api.deps import get_current_customer_user
from app.models.user import User
from app.schemas.invoice import CustomerInvoiceRead
from app.services.invoice_service import InvoiceService

router = APIRouter()


@router.get("", response_model=List[CustomerInvoiceRead])
async def list_customer_invoices(
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Lists all invoices belonging to the authenticated customer's company.
    Tenant-scoped: only returns invoices for the customer's own company.
    Excludes internal pricing fields (internal_base_cost, cargox_margin).
    """
    return await InvoiceService.list_invoices_customer(current_user)


@router.get("/{invoice_id}", response_model=CustomerInvoiceRead)
async def get_customer_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Returns customer-facing invoice detail for a specific invoice.
    Enforces tenant isolation: returns 404 if the invoice belongs to a different company.
    Excludes internal pricing fields (internal_base_cost, cargox_margin).
    """
    return await InvoiceService.get_invoice_customer(invoice_id, current_user)


@router.post("/{invoice_id}/pay", response_model=CustomerInvoiceRead)
async def pay_customer_invoice(
    invoice_id: uuid.UUID,
    payment_in: dict,
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Allows authenticated customer to pay their own invoice.
    Enforces tenant isolation and records payment.
    """
    from fastapi import HTTPException, status
    from decimal import Decimal
    from app.schemas.invoice import PaymentCreate
    from app.models.enums import PaymentMethod
    from app.services.authorization import AuthorizationService

    invoice = await InvoiceService.get_invoice_customer(invoice_id, current_user)
    
    amount = payment_in.get("amount")
    if amount is None:
        amount = invoice.amount_due
    
    import uuid
    pay_ref = payment_in.get("reference_number")
    if not pay_ref or pay_ref.strip() == "":
        pay_ref = f"PAY-CUST-{uuid.uuid4().hex[:8].upper()}"

    pay_dto = PaymentCreate(
        amount=Decimal(str(amount)),
        method=PaymentMethod.BANK_TRANSFER,
        reference_number=pay_ref,
        notes=payment_in.get("notes", "Paid by Customer online")
    )
    
    await InvoiceService.record_payment(invoice.id, pay_dto, current_user)
    return await InvoiceService.get_invoice_customer(invoice.id, current_user)
