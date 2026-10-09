from app.models.settings import SystemSettings
import uuid
from datetime import datetime, timezone
from decimal import Decimal

class SettingsService:
    @staticmethod
    async def get_settings() -> SystemSettings:
        settings = await SystemSettings.find_one()
        if not settings:
            now = datetime.now(timezone.utc)
            settings = SystemSettings(
                cargox_upi_id=None,
                cargox_service_fee_percentage=Decimal('4.00'),
                updated_at=now,
                updated_by=uuid.uuid4() # System fallback
            )
            await settings.insert()
        return settings

    @staticmethod
    async def update_cargox_upi_id(cargox_upi_id: str | None, updated_by: uuid.UUID) -> SystemSettings:
        settings = await SettingsService.get_settings()
        settings.cargox_upi_id = cargox_upi_id.strip() if cargox_upi_id and cargox_upi_id.strip() else None
        settings.updated_at = datetime.now(timezone.utc)
        settings.updated_by = updated_by
        await settings.save()
        return settings

    @staticmethod
    async def update_settings(
        updated_by: uuid.UUID,
        cargox_upi_id: str | None = None,
        cargox_service_fee_percentage: Decimal | None = None
    ) -> SystemSettings:
        settings = await SettingsService.get_settings()
        if cargox_upi_id is not None:
            settings.cargox_upi_id = cargox_upi_id.strip() if cargox_upi_id.strip() else None
        if cargox_service_fee_percentage is not None:
            settings.cargox_service_fee_percentage = cargox_service_fee_percentage
        settings.updated_at = datetime.now(timezone.utc)
        settings.updated_by = updated_by
        await settings.save()
        return settings
