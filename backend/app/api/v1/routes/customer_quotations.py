from fastapi import APIRouter, Depends, HTTPException, status
import uuid

from app.api.deps import get_current_customer_user
from app.models.user import User
from app.schemas.quotation import CustomerQuotationRead
from app.schemas.pricing import PricingConfigRead
from app.services.pricing_engine import PricingEngineService

router = APIRouter()

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
