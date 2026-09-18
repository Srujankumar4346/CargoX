from fastapi import HTTPException, status
from decimal import Decimal
from datetime import datetime, timezone, timedelta
import uuid
from typing import Optional, List

from app.models.pricing import PricingConfig, Quotation
from app.models.delivery import DeliveryRequest
from app.models.enums import DeliveryRequestStatus, QuotationStatus
from app.models.user import User
from app.schemas.pricing import PricingConfigCreate
from app.schemas.quotation import QuotationGenerate
from app.services.authorization import AuthorizationService

class PricingEngineService:
    @staticmethod
    async def create_pricing_config(config_in: PricingConfigCreate, admin_user: User) -> PricingConfig:
        """
        Creates a new pricing configuration and sets it as active.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        effective_from = config_in.effective_from.replace(tzinfo=None) if config_in.effective_from else now

        # Deactivate all active configs
        active_configs = await PricingConfig.find(PricingConfig.active == True).to_list()
        for conf in active_configs:
            conf.active = False
            await conf.save()

        new_config = PricingConfig(
            base_rate_per_km=config_in.base_rate_per_km,
            margin_per_km=config_in.margin_per_km,
            effective_from=effective_from,
            active=True,
            created_by=admin_user.id,
            created_at=now
        )
        await new_config.insert()
        return new_config

    @staticmethod
    async def get_active_pricing_config() -> PricingConfig:
        """
        Retrieves the currently active pricing config.
        Raises 400 if no active pricing config exists.
        """
        config = await PricingConfig.find_one(PricingConfig.active == True)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active pricing configuration found. Please create a pricing config first."
            )
        return config

    @staticmethod
    async def generate_quotation(
        request_id: uuid.UUID,
        quote_in: QuotationGenerate,
        admin_user: User
    ) -> Quotation:
        """
        Generates an immutable quotation for a delivery request.
        """
        request = await DeliveryRequest.find_one(DeliveryRequest.id == request_id)
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

        # Check delivery request status
        allowed_statuses = [DeliveryRequestStatus.SUBMITTED.value, DeliveryRequestStatus.UNDER_REVIEW.value]
        if request.status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot generate quotation for delivery request in status '{request.status}'"
            )

        # Mutex check: max 1 PENDING quotation per request
        existing_pending = await Quotation.find_one(
            Quotation.request_id == request_id,
            Quotation.status == QuotationStatus.PENDING
        )
        
        if existing_pending:
            # Check if existing pending is actually expired
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            if existing_pending.expires_at <= now:
                existing_pending.status = QuotationStatus.EXPIRED
                await existing_pending.save()
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A pending quotation already exists for this delivery request"
                )

        active_config = await PricingEngineService.get_active_pricing_config()

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        distance = Decimal(str(quote_in.distance_km))
        base_rate = Decimal(str(active_config.base_rate_per_km))
        margin_rate = Decimal(str(active_config.margin_per_km))

        internal_base_cost = (distance * base_rate).quantize(Decimal("0.01"))
        cargox_margin = (distance * margin_rate).quantize(Decimal("0.01"))
        customer_total_charge = internal_base_cost + cargox_margin

        validity_hours = quote_in.validity_hours or 24
        expires_at = now + timedelta(hours=validity_hours)

        quotation = Quotation(
            request_id=request_id,
            pricing_config_id=active_config.id,
            distance_km=distance,
            base_rate_per_km=base_rate,
            internal_base_cost=internal_base_cost,
            cargox_margin=cargox_margin,
            customer_total_charge=customer_total_charge,
            status=QuotationStatus.PENDING,
            created_at=now,
            expires_at=expires_at
        )

        request.status = DeliveryRequestStatus.QUOTED
        await quotation.insert()
        await request.save()

        return quotation

    @staticmethod
    async def get_customer_quotation(quotation_id: uuid.UUID, customer_user: User) -> Quotation:
        """
        Retrieves a quotation for a customer with tenant isolation and lazy expiration.
        """
        quotation = await Quotation.find_one(Quotation.id == quotation_id)
        if not quotation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        request = await DeliveryRequest.find_one(DeliveryRequest.id == quotation.request_id)
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        AuthorizationService.verify_customer_access(customer_user, request.customer_company_id)

        # Lazy expiration check
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        expires_at = quotation.expires_at
        if isinstance(expires_at, str):
            from dateutil.parser import parse
            expires_at = parse(expires_at).replace(tzinfo=None)

        if quotation.status == QuotationStatus.PENDING and expires_at <= now:
            quotation.status = QuotationStatus.EXPIRED
            await quotation.save()

        return quotation

    @staticmethod
    async def get_admin_quotation(quotation_id: uuid.UUID, admin_user: User) -> Quotation:
        """
        Retrieves a quotation for an admin.
        """
        quotation = await Quotation.find_one(Quotation.id == quotation_id)
        if not quotation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        # Lazy expiration check
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        expires_at = quotation.expires_at
        if isinstance(expires_at, str):
            from dateutil.parser import parse
            expires_at = parse(expires_at).replace(tzinfo=None)

        if quotation.status == QuotationStatus.PENDING and expires_at <= now:
            quotation.status = QuotationStatus.EXPIRED
            await quotation.save()

        return quotation

    @staticmethod
    async def accept_quotation(quotation_id: uuid.UUID, customer_user: User) -> Quotation:
        """
        Customer accepts a quotation.
        """
        quotation = await Quotation.find_one(Quotation.id == quotation_id)
        if not quotation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        request = await DeliveryRequest.find_one(DeliveryRequest.id == quotation.request_id)
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        AuthorizationService.verify_customer_access(customer_user, request.customer_company_id)

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        expires_at = quotation.expires_at
        if isinstance(expires_at, str):
            from dateutil.parser import parse
            expires_at = parse(expires_at).replace(tzinfo=None)

        # Expiration check
        if quotation.status == QuotationStatus.EXPIRED or (expires_at <= now and quotation.status == QuotationStatus.PENDING):
            if quotation.status == QuotationStatus.PENDING:
                quotation.status = QuotationStatus.EXPIRED
                await quotation.save()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Quotation has expired and cannot be accepted"
            )

        if quotation.status != QuotationStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot accept quotation in status '{quotation.status.value}'"
            )

        # Atomic state transition
        quotation.status = QuotationStatus.ACCEPTED
        quotation.accepted_at = now
        request.status = DeliveryRequestStatus.ACCEPTED

        await quotation.save()
        await request.save()
        return quotation

    @staticmethod
    async def reject_quotation(quotation_id: uuid.UUID, customer_user: User) -> Quotation:
        """
        Customer rejects a quotation.
        """
        quotation = await Quotation.find_one(Quotation.id == quotation_id)
        if not quotation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        request = await DeliveryRequest.find_one(DeliveryRequest.id == quotation.request_id)
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        AuthorizationService.verify_customer_access(customer_user, request.customer_company_id)

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # Expiration check
        if quotation.status == QuotationStatus.EXPIRED or (quotation.expires_at <= now and quotation.status == QuotationStatus.PENDING):
            if quotation.status == QuotationStatus.PENDING:
                quotation.status = QuotationStatus.EXPIRED
                await quotation.save()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Quotation has expired and cannot be rejected"
            )

        if quotation.status != QuotationStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reject quotation in status '{quotation.status.value}'"
            )

        # Atomic state transition
        quotation.status = QuotationStatus.REJECTED
        request.status = DeliveryRequestStatus.REJECTED

        await quotation.save()
        await request.save()
        return quotation
