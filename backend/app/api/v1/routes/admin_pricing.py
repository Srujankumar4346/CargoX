from fastapi import APIRouter, Depends, HTTPException, status
import uuid

from app.api.deps import get_current_admin
from app.models.user import User
from app.schemas.pricing import PricingConfigCreate, PricingConfigRead
from app.schemas.quotation import QuotationGenerate, AdminQuotationRead
from app.services.pricing_engine import PricingEngineService

router = APIRouter()

@router.post("/pricing-configs", response_model=PricingConfigRead, status_code=status.HTTP_201_CREATED)
async def create_pricing_config(
    config_in: PricingConfigCreate,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Creates a new pricing configuration and sets it active.
    All previous pricing configs are automatically deactivated.
    """
    return await PricingEngineService.create_pricing_config(config_in, current_admin)

@router.get("/pricing-configs/active", response_model=PricingConfigRead)
async def get_active_pricing_config(
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Returns the currently active pricing configuration.
    """
    return await PricingEngineService.get_active_pricing_config(db)

@router.post("/requests/{request_id}/quote", response_model=AdminQuotationRead, status_code=status.HTTP_201_CREATED)
async def generate_quotation(
    request_id: uuid.UUID,
    quote_in: QuotationGenerate,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Generates a quotation for a delivery request.
    Requires delivery request to be in SUBMITTED or UNDER_REVIEW status.
    """
    return await PricingEngineService.generate_quotation(request_id, quote_in, current_admin)

@router.get("/quotations/{quotation_id}", response_model=AdminQuotationRead)
async def get_admin_quotation(
    quotation_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Returns full quotation details including internal cost and margin for admins.
    """
    return await PricingEngineService.get_admin_quotation(quotation_id, current_admin)
