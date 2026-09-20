import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from app.models.user import User
from app.models.delivery import DeliveryRequest
from app.schemas.delivery_request import DeliveryRequestCreate, DeliveryRequestRead, DeliveryRequestUpdate, CancelRequestSchema
from app.api.deps import get_current_customer_user
from app.services.customer_portal import CustomerPortalService

router = APIRouter()

@router.get("", response_model=List[DeliveryRequestRead])
async def list_requests(
    current_user: User = Depends(get_current_customer_user)
):
    requests = await DeliveryRequest.find(
        DeliveryRequest.customer_company_id == current_user.customer_company_id
    ).sort("-created_at").to_list()
    return requests

@router.post("", response_model=DeliveryRequestRead, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: DeliveryRequestCreate,
    current_user: User = Depends(get_current_customer_user)
):
    req = await CustomerPortalService.create_delivery_request(current_user, payload)
    return req

@router.get("/{request_id}", response_model=DeliveryRequestRead)
async def get_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user)
):
    req = await DeliveryRequest.find_one(DeliveryRequest.id == request_id)
    if not req or req.customer_company_id != current_user.customer_company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    return req

@router.post("/{request_id}/cancel", response_model=DeliveryRequestRead)
async def cancel_request(
    request_id: uuid.UUID,
    payload: CancelRequestSchema = None,
    current_user: User = Depends(get_current_customer_user)
):
    reason = payload.reason if payload else None
    req = await CustomerPortalService.cancel_delivery_request(current_user, request_id, reason)
    return req

@router.put("/{request_id}", response_model=DeliveryRequestRead)
async def update_request(
    request_id: uuid.UUID,
    payload: DeliveryRequestUpdate,
    current_user: User = Depends(get_current_customer_user)
):
    req = await CustomerPortalService.update_delivery_request(current_user, request_id, payload)
    return req
