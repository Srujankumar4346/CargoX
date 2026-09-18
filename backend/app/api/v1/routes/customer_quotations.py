from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid

from app.api.deps import get_current_customer_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.quotation import CustomerQuotationRead
from app.schemas.pricing import PricingConfigRead
from app.services.pricing_engine import PricingEngineService

router = APIRouter()

@router.get("/pricing/active", response_model=PricingConfigRead)
def get_active_pricing_config(
    current_user: User = Depends(get_current_customer_user),
    db: Session = Depends(get_db)
):
    """
    Returns the currently active pricing configuration for customers.
    """
    return PricingEngineService.get_active_pricing_config(db)

@router.get("/{quotation_id}", response_model=CustomerQuotationRead)
def get_customer_quotation(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user),
    db: Session = Depends(get_db)
):
    """
    Returns a customer quotation with internal cost/margin fields stripped.
    Enforces customer company tenant isolation (returns 404 if unauthorized).
    """
    return PricingEngineService.get_customer_quotation(db, quotation_id, current_user)

@router.post("/{quotation_id}/accept", response_model=CustomerQuotationRead)
def accept_customer_quotation(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user),
    db: Session = Depends(get_db)
):
    """
    Customer accepts a quotation.
    Atomically updates quotation and delivery request status to ACCEPTED.
    """
    return PricingEngineService.accept_quotation(db, quotation_id, current_user)

@router.post("/{quotation_id}/reject", response_model=CustomerQuotationRead)
def reject_customer_quotation(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user),
    db: Session = Depends(get_db)
):
    """
    Customer rejects a quotation.
    Atomically updates quotation and delivery request status to REJECTED.
    """
    return PricingEngineService.reject_quotation(db, quotation_id, current_user)
