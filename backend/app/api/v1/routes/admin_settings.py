from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.deps import get_current_admin
from app.models.user import User
from app.services.settings_service import SettingsService

router = APIRouter()


class PaymentSettingsRead(BaseModel):
    cargox_upi_id: str | None


class PaymentSettingsUpdate(BaseModel):
    cargox_upi_id: str | None = Field(max_length=255)


@router.get("/settings/payment", response_model=PaymentSettingsRead)
async def get_payment_settings(current_admin: User = Depends(get_current_admin)):
    settings = await SettingsService.get_settings()
    return PaymentSettingsRead(cargox_upi_id=settings.cargox_upi_id)


@router.put("/settings/payment", response_model=PaymentSettingsRead)
async def update_payment_settings(
    payment_settings: PaymentSettingsUpdate,
    current_admin: User = Depends(get_current_admin),
):
    settings = await SettingsService.update_cargox_upi_id(
        payment_settings.cargox_upi_id,
        current_admin.id,
    )
    return PaymentSettingsRead(cargox_upi_id=settings.cargox_upi_id)