import uuid
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_driver
from app.models.user import User
from app.schemas.operations import TripExpenseCreate, TripExpenseRead
from app.services.expense_service import ExpenseService

router = APIRouter(tags=["Driver Expenses"])

@router.post("/trips/{trip_id}/expenses", response_model=TripExpenseRead)
def submit_expense(
    trip_id: uuid.UUID,
    expense_in: TripExpenseCreate,
    db: Session = Depends(get_db),
    current_driver: User = Depends(get_current_driver)
):
    return ExpenseService.submit_expense(
        db=db,
        trip_id=trip_id,
        user=current_driver,
        amount=expense_in.amount,
        category=expense_in.category,
        description=expense_in.description,
        receipt_url=expense_in.receipt_url
    )

@router.get("/trips/{trip_id}/expenses", response_model=List[TripExpenseRead])
def get_trip_expenses(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_driver: User = Depends(get_current_driver)
):
    return ExpenseService.list_expenses_for_trip(db, trip_id, current_driver)
