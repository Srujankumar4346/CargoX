from decimal import Decimal
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import get_current_admin
from app.models.user import User
from app.services.settings_service import SettingsService

router = APIRouter()


class PaymentSettingsRead(BaseModel):
    cargox_upi_id: str | None
    cargox_service_fee_percentage: Decimal = Field(default=Decimal("4.00"))
    gateway_configured: bool = False
    webhook_configured: bool = False
    razorpay_key_id: str | None = None
    settlement_destination: str = "Merchant linked Razorpay Bank Account"


class PaymentSettingsUpdate(BaseModel):
    cargox_upi_id: str | None = Field(None, max_length=255)
    cargox_service_fee_percentage: Decimal | None = Field(None, ge=Decimal("0.00"), le=Decimal("100.00"))


@router.get("/settings/payment", response_model=PaymentSettingsRead)
async def get_payment_settings(current_admin: User = Depends(get_current_admin)):
    from app.services.payment_gateway_service import PaymentGatewayService
    from app.core.config import settings as app_settings
    settings = await SettingsService.get_settings()
    gw_configured = PaymentGatewayService.is_configured()
    wh_configured = bool(app_settings.RAZORPAY_WEBHOOK_SECRET and app_settings.RAZORPAY_WEBHOOK_SECRET.strip())
    public_key = PaymentGatewayService.get_public_key_id()

    return PaymentSettingsRead(
        cargox_upi_id=settings.cargox_upi_id,
        cargox_service_fee_percentage=settings.cargox_service_fee_percentage,
        gateway_configured=gw_configured,
        webhook_configured=wh_configured,
        razorpay_key_id=public_key,
        settlement_destination="Merchant linked Razorpay Bank Account (Settled via Razorpay Dashboard)"
    )


@router.put("/settings/payment", response_model=PaymentSettingsRead)
async def update_payment_settings(
    payment_settings: PaymentSettingsUpdate,
    current_admin: User = Depends(get_current_admin),
):
    from app.services.payment_gateway_service import PaymentGatewayService
    from app.core.config import settings as app_settings
    settings = await SettingsService.update_settings(
        updated_by=current_admin.id,
        cargox_upi_id=payment_settings.cargox_upi_id,
        cargox_service_fee_percentage=payment_settings.cargox_service_fee_percentage,
    )
    return PaymentSettingsRead(
        cargox_upi_id=settings.cargox_upi_id,
        cargox_service_fee_percentage=settings.cargox_service_fee_percentage,
        gateway_configured=PaymentGatewayService.is_configured(),
        webhook_configured=bool(app_settings.RAZORPAY_WEBHOOK_SECRET and app_settings.RAZORPAY_WEBHOOK_SECRET.strip()),
        razorpay_key_id=PaymentGatewayService.get_public_key_id(),
        settlement_destination="Merchant linked Razorpay Bank Account (Settled via Razorpay Dashboard)"
    )