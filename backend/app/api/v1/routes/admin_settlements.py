import uuid
from typing import List
from fastapi import APIRouter, Depends

from app.api.deps import get_current_admin
from app.models.user import User
from app.schemas.settlement import DriverSettlementGenerate, DriverSettlementRead, DriverSettlementPay
from app.services.settlement_service import SettlementService

router = APIRouter()

@router.post("/settlements/generate", response_model=DriverSettlementRead)
async def generate_settlement(
    payload: DriverSettlementGenerate,
    current_admin: User = Depends(get_current_admin)
):
    return await SettlementService.generate_settlement(
        admin_user=current_admin,
        driver_id=payload.driver_id,
        period_start=payload.period_start,
        period_end=payload.period_end,
        base_pay=payload.base_pay,
        deductions=payload.deductions,
        deduction_reason=payload.deduction_reason
    )

@router.get("/settlements", response_model=List[DriverSettlementRead])
async def list_settlements(
    current_admin: User = Depends(get_current_admin)
):
    return await SettlementService.get_settlements()

@router.get("/settlements/{id}", response_model=DriverSettlementRead)
async def get_settlement(
    id: uuid.UUID,
    current_admin: User = Depends(get_current_admin)
):
    return await SettlementService.get_settlement(id)

@router.post("/settlements/{id}/submit", response_model=DriverSettlementRead)
async def submit_settlement(
    id: uuid.UUID,
    current_admin: User = Depends(get_current_admin)
):
    return await SettlementService.submit_settlement(id)

@router.post("/settlements/{id}/pay", response_model=DriverSettlementRead)
async def pay_settlement(
    id: uuid.UUID,
    payload: DriverSettlementPay,
    current_admin: User = Depends(get_current_admin)
):
    return await SettlementService.pay_settlement(id, payload.reference_number)

@router.post("/settlements/{id}/cancel", response_model=DriverSettlementRead)
async def cancel_settlement(
    id: uuid.UUID,
    current_admin: User = Depends(get_current_admin)
):
    return await SettlementService.cancel_settlement(id)
