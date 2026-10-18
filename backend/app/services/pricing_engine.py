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
            base_flat_fare=config_in.base_flat_fare if config_in.base_flat_fare is not None else Decimal("200.00"),
            base_distance_km=config_in.base_distance_km if config_in.base_distance_km is not None else Decimal("0.00"),
            capacity_surcharge_enabled=config_in.capacity_surcharge_enabled if config_in.capacity_surcharge_enabled is not None else True,
            capacity_utilization_threshold_percent=config_in.capacity_utilization_threshold_percent if config_in.capacity_utilization_threshold_percent is not None else Decimal("85.00"),
            vehicle_max_capacity_surcharge=config_in.vehicle_max_capacity_surcharge if config_in.vehicle_max_capacity_surcharge is not None else Decimal("150.00"),
            fragile_surcharge_enabled=config_in.fragile_surcharge_enabled if config_in.fragile_surcharge_enabled is not None else True,
            fragile_surcharge=config_in.fragile_surcharge if config_in.fragile_surcharge is not None else Decimal("100.00"),
            hazardous_surcharge_enabled=config_in.hazardous_surcharge_enabled if config_in.hazardous_surcharge_enabled is not None else True,
            hazardous_surcharge=config_in.hazardous_surcharge if config_in.hazardous_surcharge is not None else Decimal("200.00"),
            refrigerated_surcharge_enabled=config_in.refrigerated_surcharge_enabled if config_in.refrigerated_surcharge_enabled is not None else True,
            refrigerated_surcharge=config_in.refrigerated_surcharge if config_in.refrigerated_surcharge is not None else Decimal("250.00"),
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
            # Auto-provision default pricing config if database was newly created
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            config = PricingConfig(
                base_rate_per_km=Decimal("20.00"),
                margin_per_km=Decimal("0.00"),
                base_flat_fare=Decimal("200.00"),
                base_distance_km=Decimal("0.00"),
                capacity_surcharge_enabled=True,
                capacity_utilization_threshold_percent=Decimal("85.00"),
                vehicle_max_capacity_surcharge=Decimal("150.00"),
                fragile_surcharge_enabled=True,
                fragile_surcharge=Decimal("100.00"),
                hazardous_surcharge_enabled=True,
                hazardous_surcharge=Decimal("200.00"),
                refrigerated_surcharge_enabled=True,
                refrigerated_surcharge=Decimal("250.00"),
                effective_from=now,
                active=True,
                created_by=uuid.uuid4(),
                created_at=now
            )
            await config.insert()
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

        # Validate vehicle overload
        req_weight = float(quote_in.weight_tons or request.weight_tons or 0)
        veh_cap = float(quote_in.vehicle_capacity_tons or 0)
        if veh_cap > 0 and req_weight > veh_cap:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cargo weight ({req_weight} Tons) exceeds vehicle maximum capacity ({veh_cap} Tons). Overloaded vehicles are strictly ineligible."
            )

        active_config = await PricingEngineService.get_active_pricing_config()
        from app.services.settings_service import SettingsService
        system_settings = await SettingsService.get_settings()

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        distance = Decimal(str(quote_in.distance_km))
        base_rate = Decimal(str(active_config.base_rate_per_km))
        margin_rate = Decimal(str(active_config.margin_per_km))

        internal_base_cost = (distance * base_rate).quantize(Decimal("0.01"))
        cargox_margin = (distance * margin_rate).quantize(Decimal("0.01"))

        base_flat = Decimal(str(getattr(active_config, "base_flat_fare", Decimal("500.00"))))
        distance_charge = ((base_rate + margin_rate) * distance).quantize(Decimal("0.01"))

        # Calculate surcharges if applicable
        capacity_surcharge = Decimal("0.00")
        handling_surcharge = Decimal("0.00")

        # 1. Capacity surcharge (Rule: Admin configured threshold & enabled flag)
        cap_enabled = getattr(active_config, "capacity_surcharge_enabled", True)
        cap_threshold_pct = float(getattr(active_config, "capacity_utilization_threshold_percent", Decimal("85.00")))
        if cap_enabled and veh_cap > 0 and (req_weight / veh_cap * 100.0) >= cap_threshold_pct:
            capacity_surcharge = Decimal(str(getattr(active_config, "vehicle_max_capacity_surcharge", Decimal("600.00"))))

        # 2. Delicate / Fragile / Handling Care surcharge (Checked once without double counting)
        special_str = (quote_in.special_handling or request.special_instructions or request.goods_description or "").lower()
        if getattr(active_config, "fragile_surcharge_enabled", True) and ("fragile" in special_str or "delicate" in special_str or "handle with care" in special_str):
            handling_surcharge += Decimal(str(getattr(active_config, "fragile_surcharge", Decimal("400.00"))))
        elif getattr(active_config, "hazardous_surcharge_enabled", True) and ("hazardous" in special_str or "sensitive" in special_str):
            handling_surcharge += Decimal(str(getattr(active_config, "hazardous_surcharge", Decimal("700.00"))))
        elif getattr(active_config, "refrigerated_surcharge_enabled", True) and ("refrigerated" in special_str or "cold" in special_str):
            handling_surcharge += Decimal(str(getattr(active_config, "refrigerated_surcharge", Decimal("800.00"))))

        customer_total_charge = base_flat + distance_charge + capacity_surcharge + handling_surcharge

        fee_pct = system_settings.cargox_service_fee_percentage
        service_fee = (customer_total_charge * fee_pct / Decimal("100")).quantize(Decimal("0.01"))
        driver_payable = customer_total_charge - service_fee

        validity_hours = quote_in.validity_hours or 24
        expires_at = now + timedelta(hours=validity_hours)

        quotation = Quotation(
            request_id=request_id,
            pricing_config_id=active_config.id,
            distance_km=distance,
            base_rate_per_km=base_rate,
            internal_base_cost=internal_base_cost,
            cargox_margin=cargox_margin,
            base_fare=base_flat,
            distance_charge=distance_charge,
            capacity_surcharge=capacity_surcharge,
            handling_surcharge=handling_surcharge,
            customer_total_charge=customer_total_charge,
            service_fee_percentage=fee_pct,
            service_fee_amount=service_fee,
            driver_payable_amount=driver_payable,
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

        # Enforce capacity verification before accepting quote
        veh_capacity = 0.0
        if getattr(quotation, "vehicle_capacity_tons", None):
            veh_capacity = float(quotation.vehicle_capacity_tons)
        elif getattr(request, "vehicle_capacity_tons", None):
            veh_capacity = float(request.vehicle_capacity_tons)

        req_weight = float(request.weight_tons or 0.0)
        if veh_capacity > 0 and req_weight > veh_capacity:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot accept quotation: cargo weight ({req_weight}T) exceeds vehicle capacity ({veh_capacity}T)"
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
