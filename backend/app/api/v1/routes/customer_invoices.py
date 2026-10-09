from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from decimal import Decimal
from urllib.parse import urlencode
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import get_current_customer_user
from app.models.enums import InvoiceStatus, PaymentMethod
from app.models.user import User
from app.schemas.invoice import (
    CustomerInvoiceRead,
    SelectPaymentMethodRequest,
    PaymentMethodOptionDetail,
    PaymentMethodSelectionResponse,
)
import logging
from app.services.invoice_service import InvoiceService
from app.services.settings_service import SettingsService
from app.services.payment_gateway_service import PaymentGatewayService

logger = logging.getLogger("cargox.customer_invoices")

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


@router.get("/{invoice_id}/payment-options", response_model=List[PaymentMethodOptionDetail])
async def get_payment_options(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user),
):
    """
    Returns the three supported payment options and their operational availability.
    - UPI: Available if cargox_upi_id is configured.
    - Net Banking: Available if payment gateway is configured (disabled with clear explanation otherwise).
    - Pay on Delivery: Always available for collection at delivery point.
    """
    invoice = await InvoiceService.get_invoice_customer(invoice_id, current_user)
    settings = await SettingsService.get_settings()

    upi_available = bool(settings.cargox_upi_id and settings.cargox_upi_id.strip())
    gateway_available = PaymentGatewayService.is_configured()

    return [
        PaymentMethodOptionDetail(
            method=PaymentMethod.UPI,
            title="UPI (Scan & Pay)",
            description="Pay instantly using Google Pay, PhonePe, Paytm, or any UPI app with auto-detection.",
            available=upi_available or gateway_available,
            status_message=None if (upi_available or gateway_available) else "UPI is currently unavailable: receiving account not configured by administrator.",
            action_type="SCAN_AND_PAY"
        ),
        PaymentMethodOptionDetail(
            method=PaymentMethod.NET_BANKING,
            title="Net Banking",
            description="Pay securely through a supported bank gateway (SBI, HDFC, ICICI, Axis, etc.).",
            available=gateway_available,
            status_message=None if gateway_available else "Net Banking is currently unavailable. It will be enabled after payment provider setup.",
            action_type="HOSTED_CHECKOUT"
        ),
        PaymentMethodOptionDetail(
            method=PaymentMethod.PAY_ON_DELIVERY,
            title="Pay on Delivery",
            description="Pay the authorized CargoX driver via cash or UPI upon delivery completion.",
            available=True,
            status_message="Payment due when shipment arrives at delivery destination.",
            action_type="PAY_ON_DELIVERY"
        )
    ]


@router.post("/{invoice_id}/select-payment-method", response_model=PaymentMethodSelectionResponse)
async def select_payment_method(
    invoice_id: uuid.UUID,
    selection: SelectPaymentMethodRequest,
    current_user: User = Depends(get_current_customer_user),
):
    """
    Records customer's chosen payment method on the invoice without marking it paid.
    - Pay on Delivery: records intent; invoice remains UNPAID/PARTIALLY_PAID until driver/admin collects.
    - UPI: records intent; provides dynamic QR details with amount due. If gateway is configured, creates gateway order for auto-detection.
    - Net Banking: validates gateway configuration. Creates gateway order if active; rejects with 503 otherwise.
    """
    invoice = await InvoiceService.get_invoice_customer(invoice_id, current_user)
    if invoice.status == InvoiceStatus.PAID or Decimal(str(invoice.amount_due)) <= Decimal("0"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This invoice is already fully paid.",
        )

    settings = await SettingsService.get_settings()
    amount_due = Decimal(str(invoice.amount_due))

    if selection.payment_method == PaymentMethod.PAY_ON_DELIVERY:
        invoice.payment_method = PaymentMethod.PAY_ON_DELIVERY
        invoice.payment_intent_status = "AWAITING_DELIVERY"
        invoice.payment_notes = selection.notes or "Customer selected Pay on Delivery at checkout"
        await invoice.save()

        return PaymentMethodSelectionResponse(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            amount_due=amount_due,
            selected_method=PaymentMethod.PAY_ON_DELIVERY,
            intent_status="AWAITING_DELIVERY",
            message="Payment method set to Pay on Delivery. Payment will be collected by the authorized driver upon delivery.",
            qr_details=None,
            gateway_available=False
        )

    elif selection.payment_method == PaymentMethod.UPI:
        # Check if gateway is configured for real auto-detection
        if PaymentGatewayService.is_configured():
            try:
                order_info = await PaymentGatewayService.create_order(
                    invoice=invoice,
                    payment_method=PaymentMethod.UPI,
                    notes={"customer_id": str(current_user.id)}
                )
                return PaymentMethodSelectionResponse(
                    invoice_id=invoice.id,
                    invoice_number=invoice.invoice_number,
                    amount_due=amount_due,
                    selected_method=PaymentMethod.UPI,
                    intent_status="PENDING_CONFIRMATION",
                    message="UPI checkout initiated with automatic payment confirmation.",
                    qr_details=None,
                    gateway_available=True,
                    gateway_order_id=order_info["order_id"],
                    gateway_key_id=order_info["key_id"]
                )
            except Exception as err:
                logger.warning(f"Gateway order creation failed, falling back to static QR: {err}")

        # Fallback to configured merchant UPI ID
        upi_id = settings.cargox_upi_id.strip() if settings.cargox_upi_id else ""
        if not upi_id:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="UPI payment is currently unavailable because CargoX has not configured a receiving UPI ID."
            )
        invoice.payment_method = PaymentMethod.UPI
        invoice.payment_intent_status = "PENDING_CONFIRMATION"
        invoice.payment_notes = selection.notes or "Customer initiated UPI checkout"
        await invoice.save()

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

        return PaymentMethodSelectionResponse(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            amount_due=amount_due,
            selected_method=PaymentMethod.UPI,
            intent_status="PENDING_CONFIRMATION",
            message="UPI checkout initiated. Scan the QR code or copy the UPI ID. Payment will be confirmed after verified receipt.",
            qr_details={
                "upi_id": upi_id,
                "upi_uri": upi_uri,
                "qr_image_url": qr_image_url,
                "amount_due": str(amount_due),
                "invoice_number": invoice.invoice_number
            },
            gateway_available=False
        )

    elif selection.payment_method == PaymentMethod.NET_BANKING:
        if not PaymentGatewayService.is_configured():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Net Banking is currently unavailable. It will be enabled after payment provider setup."
            )

        order_info = await PaymentGatewayService.create_order(
            invoice=invoice,
            payment_method=PaymentMethod.NET_BANKING,
            notes={"customer_id": str(current_user.id)}
        )
        return PaymentMethodSelectionResponse(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            amount_due=amount_due,
            selected_method=PaymentMethod.NET_BANKING,
            intent_status="PENDING_CONFIRMATION",
            message="Net Banking checkout initiated via secure bank gateway.",
            qr_details=None,
            gateway_available=True,
            gateway_order_id=order_info["order_id"],
            gateway_key_id=order_info["key_id"]
        )

    else:
        # Other or Bank Transfer
        invoice.payment_method = selection.payment_method
        invoice.payment_intent_status = "PENDING_CONFIRMATION"
        invoice.payment_notes = selection.notes
        await invoice.save()

        return PaymentMethodSelectionResponse(
            invoice_id=invoice.id,
            invoice_number=invoice.invoice_number,
            amount_due=amount_due,
            selected_method=selection.payment_method,
            intent_status="PENDING_CONFIRMATION",
            message=f"Payment method recorded as {selection.payment_method.value}. Awaiting verification.",
            qr_details=None,
            gateway_available=False
        )


@router.post("/{invoice_id}/pay", response_model=CustomerInvoiceRead)
async def pay_customer_invoice(
    invoice_id: uuid.UUID,
    payment_in: dict,
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Customer payment confirmation endpoint.
    Strict Invariant: Selecting or submitting payment from customer side never automatically marks invoice PAID.
    All payments must be verified by provider webhook or authorized driver/admin.
    """
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Payments are recorded after CargoX verifies receipt. Never simulated or self-settled."
    )

