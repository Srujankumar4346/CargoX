import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from app.models.user import User
from app.models.company import RecipientCompany
from app.schemas.recipient import RecipientCompanyCreate, RecipientCompanyRead, RecipientCompanyUpdate
from app.api.deps import get_current_customer_user

router = APIRouter()

@router.get("", response_model=List[RecipientCompanyRead])
async def list_recipients(
    current_user: User = Depends(get_current_customer_user)
):
    recipients = await RecipientCompany.find(
        RecipientCompany.customer_company_id == current_user.customer_company_id
    ).to_list()
    return recipients

@router.post("", response_model=RecipientCompanyRead, status_code=status.HTTP_201_CREATED)
async def create_recipient(
    payload: RecipientCompanyCreate,
    current_user: User = Depends(get_current_customer_user)
):
    recipient = RecipientCompany(
        customer_company_id=current_user.customer_company_id,
        **payload.model_dump()
    )
    await recipient.insert()
    return recipient

@router.get("/{recipient_id}", response_model=RecipientCompanyRead)
async def get_recipient(
    recipient_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user)
):
    recipient = await RecipientCompany.find_one(RecipientCompany.id == recipient_id)
    if not recipient or recipient.customer_company_id != current_user.customer_company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    return recipient

@router.put("/{recipient_id}", response_model=RecipientCompanyRead)
async def update_recipient(
    recipient_id: uuid.UUID,
    payload: RecipientCompanyUpdate,
    current_user: User = Depends(get_current_customer_user)
):
    recipient = await RecipientCompany.find_one(RecipientCompany.id == recipient_id)
    if not recipient or recipient.customer_company_id != current_user.customer_company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
        
    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(recipient, k, v)
        
    await recipient.save()
    return recipient

@router.delete("/{recipient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipient(
    recipient_id: uuid.UUID,
    current_user: User = Depends(get_current_customer_user)
):
    recipient = await RecipientCompany.find_one(RecipientCompany.id == recipient_id)
    if not recipient or recipient.customer_company_id != current_user.customer_company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
        
    await recipient.delete()
