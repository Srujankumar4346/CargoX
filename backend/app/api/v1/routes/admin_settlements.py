import uuid
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_admin
from app.models.user import User
from app.schemas.settlement import DriverSettlementGenerate, DriverSettlementRead, DriverSettlementPay
from app.services.settlement_service import SettlementService

router = APIRouter()

@router.post("/settlements/generate", response_model=DriverSettlementRead)
def generate_settlement(
    payload: DriverSettlementGenerate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    return SettlementService.generate_settlement(
        db=db,
        admin_user=current_admin,
        driver_id=payload.driver_id,
        period_start=payload.period_start,
        period_end=payload.period_end,
        base_pay=payload.base_pay,
        deductions=payload.deductions,
        deduction_reason=payload.deduction_reason
    )

@router.get("/settlements", response_model=List[DriverSettlementRead])
def list_settlements(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    return SettlementService.get_settlements(db)

@router.get("/settlements/{id}", response_model=DriverSettlementRead)
def get_settlement(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    return SettlementService.get_settlement(db, id)

@router.post("/settlements/{id}/submit", response_model=DriverSettlementRead)
def submit_settlement(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    return SettlementService.submit_settlement(db, id)

@router.post("/settlements/{id}/pay", response_model=DriverSettlementRead)
def pay_settlement(
    id: uuid.UUID,
    payload: DriverSettlementPay,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    return SettlementService.pay_settlement(db, id, payload.reference_number)

@router.post("/settlements/{id}/cancel", response_model=DriverSettlementRead)
def cancel_settlement(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    return SettlementService.cancel_settlement(db, id)
