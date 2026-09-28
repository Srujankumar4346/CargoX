from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from decimal import Decimal
from urllib.parse import urlencode
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import get_current_customer_user
from app.models.enums import InvoiceStatus
from app.models.user import User
from app.schemas.invoice import CustomerInvoiceRead
from app.services.invoice_service import InvoiceService
from app.services.settings_service import SettingsService

router = APIRouter()


class CustomerPaymentQrRead(BaseModel):
    invoice_number: str
    upi_id: str
    amount_due: Decimal
    upi_uri: str
    qr_image_url: str


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


@router.get("/{invoice_id}/payment-qr", response_model=CustomerPaymentQrRead)
async def get_customer_payment_qr(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user),
):
    invoice = await InvoiceService.get_invoice_customer(invoice_id, current_user)
    if invoice.status == InvoiceStatus.PAID or Decimal(str(invoice.amount_due)) <= Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This invoice is already fully paid.",
        )

    settings = await SettingsService.get_settings()
    upi_id = settings.cargox_upi_id.strip() if settings.cargox_upi_id else ""
    if not upi_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "UPI payments are unavailable because CargoX has not configured a receiving UPI ID. "
                "An administrator must set it under Admin Settings > Payment receiving account."
            ),
        )

    amount_due = Decimal(str(invoice.amount_due))
    upi_uri = "upi://pay?" + urlencode({
        "pa": upi_id,
        "pn": "CargoX",
        "tr": invoice.invoice_number,
        "am": format(amount_due, "f"),
        "cu": "INR",
    })
    qr_image_url = "https://api.qrserver.com/v1/create-qr-code/?" + urlencode({
        "size": "256x256",
        "data": upi_uri,
        "color": "0f172a",
        "bgcolor": "ffffff",
    })
    return CustomerPaymentQrRead(
        invoice_number=invoice.invoice_number,
        upi_id=upi_id,
        amount_due=amount_due,
        upi_uri=upi_uri,
        qr_image_url=qr_image_url,
    )


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
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Payments are recorded after CargoX verifies receipt."
    )
