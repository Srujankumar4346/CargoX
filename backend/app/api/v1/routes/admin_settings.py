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


class PaymentSettingsUpdate(BaseModel):
    cargox_upi_id: str | None = Field(None, max_length=255)
    cargox_service_fee_percentage: Decimal | None = Field(None, ge=Decimal("0.00"), le=Decimal("100.00"))


@router.get("/settings/payment", response_model=PaymentSettingsRead)
async def get_payment_settings(current_admin: User = Depends(get_current_admin)):
    settings = await SettingsService.get_settings()
    return PaymentSettingsRead(
        cargox_upi_id=settings.cargox_upi_id,
        cargox_service_fee_percentage=settings.cargox_service_fee_percentage,
    )


@router.put("/settings/payment", response_model=PaymentSettingsRead)
async def update_payment_settings(
    payment_settings: PaymentSettingsUpdate,
    current_admin: User = Depends(get_current_admin),
):
    settings = await SettingsService.update_settings(
        updated_by=current_admin.id,
        cargox_upi_id=payment_settings.cargox_upi_id,
        cargox_service_fee_percentage=payment_settings.cargox_service_fee_percentage,
    )
    return PaymentSettingsRead(
        cargox_upi_id=settings.cargox_upi_id,
        cargox_service_fee_percentage=settings.cargox_service_fee_percentage,
    )