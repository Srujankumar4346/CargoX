import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.models.delivery import DeliveryRequest
from app.schemas.delivery_request import DeliveryRequestCreate, DeliveryRequestRead
from app.api.deps import get_current_customer_user
from app.services.customer_portal import CustomerPortalService

router = APIRouter()

@router.get("", response_model=List[DeliveryRequestRead])
def list_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_customer_user)
):
    requests = db.query(DeliveryRequest).filter(
        DeliveryRequest.customer_company_id == current_user.customer_company_id
    ).all()
    return requests

@router.post("", response_model=DeliveryRequestRead, status_code=status.HTTP_201_CREATED)
def create_request(
    payload: DeliveryRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_customer_user)
):
    req = CustomerPortalService.create_delivery_request(db, current_user, payload)
    return req

@router.get("/{request_id}", response_model=DeliveryRequestRead)
def get_request(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_customer_user)
):
    req = db.query(DeliveryRequest).filter(DeliveryRequest.id == request_id).first()
    if not req or req.customer_company_id != current_user.customer_company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    return req

@router.post("/{request_id}/cancel", response_model=DeliveryRequestRead)
def cancel_request(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_customer_user)
):
    req = CustomerPortalService.cancel_delivery_request(db, current_user, request_id)
    return req
