import uuid
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_admin
from app.models.user import User
from app.schemas.operations import TripExpenseCreate, TripExpenseRead, ExpenseStatusUpdate
from app.services.expense_service import ExpenseService

router = APIRouter(tags=["Admin Expenses"])

@router.post("/trips/{trip_id}/expenses", response_model=TripExpenseRead)
def create_expense(
    trip_id: uuid.UUID,
    expense_in: TripExpenseCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    return ExpenseService.submit_expense(
        db=db,
        trip_id=trip_id,
        user=current_admin,
        amount=expense_in.amount,
        category=expense_in.category,
        description=expense_in.description,
        receipt_url=expense_in.receipt_url
    )

@router.get("/trips/{trip_id}/expenses", response_model=List[TripExpenseRead])
def get_expenses_for_trip(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    return ExpenseService.list_expenses_for_trip(db, trip_id, current_admin)

@router.patch("/expenses/{expense_id}/status", response_model=TripExpenseRead)
def update_expense_status(
    expense_id: uuid.UUID,
    status_in: ExpenseStatusUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    return ExpenseService.change_expense_status(db, expense_id, status_in.status, current_admin)
