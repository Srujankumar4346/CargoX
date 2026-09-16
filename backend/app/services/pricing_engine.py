from sqlalchemy.orm import Session
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
    def create_pricing_config(db: Session, config_in: PricingConfigCreate, admin_user: User) -> PricingConfig:
        """
        Creates a new pricing configuration and sets it as active.
        Deactivates all previously active pricing configurations in a single transaction.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        effective_from = config_in.effective_from.replace(tzinfo=None) if config_in.effective_from else now

        # Deactivate all active configs
        db.query(PricingConfig).filter(PricingConfig.active == True).update({"active": False}, synchronize_session=False)

        new_config = PricingConfig(
            id=uuid.uuid4(),
            base_rate_per_km=config_in.base_rate_per_km,
            margin_per_km=config_in.margin_per_km,
            effective_from=effective_from,
            active=True,
            created_by=admin_user.id,
            created_at=now
        )
        db.add(new_config)
        db.commit()
        db.refresh(new_config)
        return new_config

    @staticmethod
    def get_active_pricing_config(db: Session) -> PricingConfig:
        """
        Retrieves the currently active pricing config.
        Raises 400 if no active pricing config exists.
        """
        config = db.query(PricingConfig).filter(PricingConfig.active == True).first()
        if not config:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active pricing configuration found. Please create a pricing config first."
            )
        return config

    @staticmethod
    def generate_quotation(
        db: Session,
        request_id: uuid.UUID,
        quote_in: QuotationGenerate,
        admin_user: User
    ) -> Quotation:
        """
        Generates an immutable quotation for a delivery request.
        Validates request state and pending quotation mutex.
        Atomically updates request status to QUOTED.
        """
        request = db.query(DeliveryRequest).filter(DeliveryRequest.id == request_id).first()
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery request not found")

        # Check delivery request status
        allowed_statuses = [DeliveryRequestStatus.SUBMITTED, DeliveryRequestStatus.UNDER_REVIEW]
        if request.status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot generate quotation for delivery request in status '{request.status.value}'"
            )

        # Mutex check: max 1 PENDING quotation per request
        existing_pending = db.query(Quotation).filter(
            Quotation.request_id == request_id,
            Quotation.status == QuotationStatus.PENDING
        ).first()
        
        if existing_pending:
            # Check if existing pending is actually expired
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            if existing_pending.expires_at <= now:
                existing_pending.status = QuotationStatus.EXPIRED
                db.commit()
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A pending quotation already exists for this delivery request"
                )

        active_config = PricingEngineService.get_active_pricing_config(db)

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
            id=uuid.uuid4(),
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

        # Atomic transaction: insert quotation, update request status
        request.status = DeliveryRequestStatus.QUOTED
        db.add(quotation)
        db.commit()
        db.refresh(quotation)

        return quotation

    @staticmethod
    def get_customer_quotation(db: Session, quotation_id: uuid.UUID, customer_user: User) -> Quotation:
        """
        Retrieves a quotation for a customer with tenant isolation and lazy expiration.
        """
        quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
        if not quotation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        request = db.query(DeliveryRequest).filter(DeliveryRequest.id == quotation.request_id).first()
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        # Verify tenant isolation (raises 404 on mismatch)
        AuthorizationService.verify_customer_access(customer_user, request.customer_company_id)

        # Lazy expiration check
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        expires_at = quotation.expires_at
        if isinstance(expires_at, str):
            from dateutil.parser import parse
            expires_at = parse(expires_at).replace(tzinfo=None)

        if quotation.status == QuotationStatus.PENDING and expires_at <= now:
            quotation.status = QuotationStatus.EXPIRED
            db.commit()
            db.refresh(quotation)

        return quotation

    @staticmethod
    def get_admin_quotation(db: Session, quotation_id: uuid.UUID, admin_user: User) -> Quotation:
        """
        Retrieves a quotation for an admin.
        """
        quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
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
            db.commit()
            db.refresh(quotation)

        return quotation

    @staticmethod
    def accept_quotation(db: Session, quotation_id: uuid.UUID, customer_user: User) -> Quotation:
        """
        Customer accepts a quotation.
        Validates tenant isolation, lazy expiration, and state.
        Atomically updates quotation status to ACCEPTED and request status to ACCEPTED.
        """
        quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
        if not quotation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        request = db.query(DeliveryRequest).filter(DeliveryRequest.id == quotation.request_id).first()
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        # Verify tenant isolation (raises 404 on mismatch)
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
                db.commit()
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

        db.commit()
        db.refresh(quotation)
        return quotation

    @staticmethod
    def reject_quotation(db: Session, quotation_id: uuid.UUID, customer_user: User) -> Quotation:
        """
        Customer rejects a quotation.
        Validates tenant isolation and state.
        Atomically updates quotation status to REJECTED and request status to REJECTED.
        """
        quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
        if not quotation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        request = db.query(DeliveryRequest).filter(DeliveryRequest.id == quotation.request_id).first()
        if not request:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        # Verify tenant isolation (raises 404 on mismatch)
        AuthorizationService.verify_customer_access(customer_user, request.customer_company_id)

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # Expiration check
        if quotation.status == QuotationStatus.EXPIRED or (quotation.expires_at <= now and quotation.status == QuotationStatus.PENDING):
            if quotation.status == QuotationStatus.PENDING:
                quotation.status = QuotationStatus.EXPIRED
                db.commit()
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

        db.commit()
        db.refresh(quotation)
        return quotation
