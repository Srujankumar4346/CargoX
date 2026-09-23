from fastapi import APIRouter, Depends, HTTPException, status, Query
from decimal import Decimal
import uuid

from app.api.deps import get_current_customer_user
from app.models.user import User
from app.schemas.quotation import CustomerQuotationRead
from app.schemas.pricing import PricingConfigRead, CustomerPriceEstimateRead
from app.services.pricing_engine import PricingEngineService

router = APIRouter()

@router.get("/pricing/estimate", response_model=CustomerPriceEstimateRead)
async def get_customer_pricing_estimate(
    distance_km: Decimal = Query(..., gt=Decimal("0"), description="Distance in km"),
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Returns an informational price estimate for customers based on active PricingConfig.
    Does NOT create a quotation or accept any request.
    Strictly customer-safe: hides internal base cost and CargoX margin details.
    """
    active_config = await PricingEngineService.get_active_pricing_config()
    base_rate = Decimal(str(active_config.base_rate_per_km))
    margin_rate = Decimal(str(active_config.margin_per_km))
    customer_rate = base_rate + margin_rate
    dist = Decimal(str(distance_km))
    estimated_total = (dist * customer_rate).quantize(Decimal("0.01"))

    return CustomerPriceEstimateRead(
        distance_km=dist,
        customer_rate_per_km=customer_rate,
        estimated_total=estimated_total,
        currency="INR"
    )

@router.get("/pricing/active", response_model=PricingConfigRead)
async def get_active_pricing_config(
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Returns the currently active pricing configuration for customers.
    """
    return await PricingEngineService.get_active_pricing_config()

@router.get("/{quotation_id}", response_model=CustomerQuotationRead)
async def get_customer_quotation(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Returns a customer quotation with internal cost/margin fields stripped.
    Enforces customer company tenant isolation (returns 404 if unauthorized).
    """
    return await PricingEngineService.get_customer_quotation(quotation_id, current_user)

@router.post("/{quotation_id}/accept", response_model=CustomerQuotationRead)
async def accept_customer_quotation(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Customer accepts a quotation.
    Atomically updates quotation and delivery request status to ACCEPTED.
    """
    return await PricingEngineService.accept_quotation(quotation_id, current_user)

@router.post("/{quotation_id}/reject", response_model=CustomerQuotationRead)
async def reject_customer_quotation(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Customer rejects a quotation.
    Atomically updates quotation and delivery request status to REJECTED.
    """
    return await PricingEngineService.reject_quotation(quotation_id, current_user)
