import logging
import json
import uuid
from typing import Dict, Any
from fastapi import APIRouter, Request, Header, HTTPException, status, Depends
from pydantic import BaseModel

from app.services.payment_gateway_service import PaymentGatewayService
from app.models.finance import Invoice
from app.api.deps import get_current_customer_user
from app.models.user import User

logger = logging.getLogger("cargox.payment_webhooks")

router = APIRouter()


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/razorpay/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None, alias="X-Razorpay-Signature"),
) -> Dict[str, Any]:
    """
    Cryptographically verified webhook handler for Razorpay.
    Listens for 'payment.captured' and 'order.paid' events.
    Verifies HMAC-SHA256 signature using RAZORPAY_WEBHOOK_SECRET.
    Idempotently records Payment and reconciles the target Invoice.
    """
    body_bytes = await request.body()

    # 1. Signature Verification
    if not x_razorpay_signature:
        logger.warning("Rejected webhook callback: Missing X-Razorpay-Signature header.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing cryptographic signature header."
        )

    is_valid = PaymentGatewayService.verify_webhook_signature(body_bytes, x_razorpay_signature)
    if not is_valid:
        logger.warning("Rejected webhook callback: Invalid HMAC-SHA256 signature.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid cryptographic webhook signature."
        )

    # 2. Parse payload
    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except Exception as exc:
        logger.error(f"Failed to parse webhook JSON: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed JSON payload.")

    event = payload.get("event")
    logger.info(f"Received verified Razorpay webhook event: {event}")

    # Process payment.captured or order.paid
    if event in ("payment.captured", "payment.authorized"):
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = payment_entity.get("order_id")
        payment_id = payment_entity.get("id")
        amount = payment_entity.get("amount", 0) # in paise
        currency = payment_entity.get("currency", "INR")
        method = payment_entity.get("method", "upi")
        pay_status = payment_entity.get("status", "captured")
        notes = payment_entity.get("notes", {})

        invoice_id_str = notes.get("invoice_id")
        target_invoice = None

        if invoice_id_str:
            try:
                target_invoice = await Invoice.find_one(Invoice.id == uuid.UUID(invoice_id_str))
            except Exception:
                target_invoice = None

        if not target_invoice and order_id:
            target_invoice = await Invoice.find_one(Invoice.gateway_order_id == order_id)

        if not target_invoice:
            logger.error(f"Webhook error: Could not identify invoice for order_id={order_id}, payment_id={payment_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No corresponding invoice found for this payment event."
            )

        result = await PaymentGatewayService.process_verified_transaction(
            invoice_id=target_invoice.id,
            gateway_order_id=order_id,
            gateway_payment_id=payment_id,
            amount_paise=amount,
            currency=currency,
            method_str=method,
            status_str=pay_status,
            raw_metadata=payment_entity
        )
        return {"status": "ok", "result": result}

    elif event in ("payment.failed", "payment.cancelled"):
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        payment_id = payment_entity.get("id")
        notes = payment_entity.get("notes", {})
        invoice_id_str = notes.get("invoice_id")
        logger.info(f"Payment {payment_id} recorded failed/cancelled for invoice {invoice_id_str}. Invoice remains unpaid.")
        return {"status": "recorded_unsuccessful", "event": event}

    return {"status": "event_acknowledged", "event": event}


@router.post("/razorpay/verify-checkout")
async def verify_checkout(
    verification: VerifyPaymentRequest,
    current_user: User = Depends(get_current_customer_user),
) -> Dict[str, Any]:
    """
    Authenticated server-side verification endpoint called by client checkout callback.
    Fetches real payment status directly from Razorpay API. Never trusts client claim alone.
    """
    if not PaymentGatewayService.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment gateway is currently not configured."
        )

    # 1. Fetch real payment from Razorpay
    payment_data = await PaymentGatewayService.fetch_payment_status(verification.razorpay_payment_id)
    payment_order_id = payment_data.get("order_id")

    if payment_order_id != verification.razorpay_order_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mismatched order ID and payment ID."
        )

    # 2. Match Invoice
    invoice = await Invoice.find_one(Invoice.gateway_order_id == verification.razorpay_order_id)
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No invoice matched with the provided order ID."
        )

    # 3. Process Verified Transaction
    result = await PaymentGatewayService.process_verified_transaction(
        invoice_id=invoice.id,
        gateway_order_id=verification.razorpay_order_id,
        gateway_payment_id=verification.razorpay_payment_id,
        amount_paise=payment_data.get("amount", 0),
        currency=payment_data.get("currency", "INR"),
        method_str=payment_data.get("method", "upi"),
        status_str=payment_data.get("status", "captured"),
        raw_metadata=payment_data,
        recorded_by=current_user.id
    )

    return result
