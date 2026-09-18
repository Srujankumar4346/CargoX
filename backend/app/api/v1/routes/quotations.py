from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_customer_user, get_current_admin
from app.models.user import User
from app.models.pricing import Quotation
from app.models.delivery import DeliveryRequest
from app.schemas.pricing import CustomerQuotationRead, AdminQuotationRead
from app.services.authorization import AuthorizationService
import uuid

# This is a scaffold route to test Phase 2C authorization and schemas.
router = APIRouter()

@router.get("/{quotation_id}", response_model=CustomerQuotationRead)
async def get_quotation_for_customer(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user),
    ):
    """
    Returns a quotation with internal cost/margin fields hidden.
    """
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
        
    request = db.query(DeliveryRequest).filter(DeliveryRequest.id == quotation.request_id).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
        
    # Enforce isolation at the service boundary using the persisted ownership
    await AuthorizationService.verify_customer_access(current_user, request.customer_company_id)
    
    return quotation

@router.get("/admin/{quotation_id}", response_model=AdminQuotationRead)
async def get_quotation_for_admin(
    quotation_id: uuid.UUID,
    current_user: User = Depends(get_current_admin),
    ):
    """
    Returns a quotation with ALL internal fields visible.
    """
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
        
    return quotation
