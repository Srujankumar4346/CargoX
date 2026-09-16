import uuid
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.operations import TripExpense
from app.models.delivery import Trip
from app.models.enums import ExpenseCategory, ExpenseStatus, DeliveryRequestStatus, UserRole, SettlementStatus, ExpensePayer
from app.models.user import User

VALID_EXPENSE_TRIP_STATES = {
    DeliveryRequestStatus.DRIVER_ASSIGNED,
    DeliveryRequestStatus.PICKUP_IN_PROGRESS,
    DeliveryRequestStatus.IN_TRANSIT,
    DeliveryRequestStatus.ARRIVED,
    DeliveryRequestStatus.POD_SUBMITTED,
    DeliveryRequestStatus.DELIVERED,
    DeliveryRequestStatus.COMPLETED
}

class ExpenseService:
    @staticmethod
    def get_trip_with_validation(db: Session, trip_id: uuid.UUID):
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        
        request = trip.delivery_request
        if request.status not in VALID_EXPENSE_TRIP_STATES:
            raise HTTPException(status_code=400, detail=f"Cannot record expense for trip in {request.status} state")
            
        return trip

    @staticmethod
    def submit_expense(
        db: Session,
        trip_id: uuid.UUID,
        user: User,
        amount: Decimal,
        category: ExpenseCategory,
        description: str = None,
        receipt_url: str = None
    ) -> TripExpense:
        
        if amount <= 0:
            raise HTTPException(status_code=422, detail="Expense amount must be positive")
            
        trip = ExpenseService.get_trip_with_validation(db, trip_id)

        # Check Settlement Immutability
        if trip.settlement and trip.settlement.status in [SettlementStatus.PENDING_PAYMENT, SettlementStatus.PAID]:
            raise HTTPException(status_code=400, detail="Cannot record expense for a trip linked to a frozen settlement")

        # Driver checks
        if user.role == UserRole.DRIVER:
            if trip.delivery_request.status == DeliveryRequestStatus.COMPLETED:
                raise HTTPException(status_code=400, detail="Cannot submit expenses for a completed trip")
            if not trip.assignment or trip.assignment.driver_id != user.driver.id:
                raise HTTPException(status_code=403, detail="Not assigned to this trip")
            status = ExpenseStatus.PENDING_APPROVAL
        elif user.role == UserRole.ADMIN:
            status = ExpenseStatus.APPROVED
        else:
            raise HTTPException(status_code=403, detail="Not authorized to submit expenses")

        expense = TripExpense(
            trip_id=trip_id,
            amount=amount,
            category=category,
            status=status,
            date=datetime.now(timezone.utc),
            description=description,
            receipt_url=receipt_url,
            recorded_by=user.id
        )
        
        db.add(expense)
        db.commit()
        db.refresh(expense)
        return expense

    @staticmethod
    def list_expenses_for_trip(db: Session, trip_id: uuid.UUID, user: User):
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
            
        if user.role == UserRole.DRIVER:
            if not trip.assignment or trip.assignment.driver_id != user.driver.id:
                raise HTTPException(status_code=403, detail="Not assigned to this trip")
        elif user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        return db.query(TripExpense).filter(TripExpense.trip_id == trip_id).all()
        
    @staticmethod
    def change_expense_status(db: Session, expense_id: uuid.UUID, status: ExpenseStatus, admin_user: User):
        if admin_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can change expense status")
            
        expense = db.query(TripExpense).filter(TripExpense.id == expense_id).first()
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
            
        if expense.trip.settlement and expense.trip.settlement.status in [SettlementStatus.PENDING_PAYMENT, SettlementStatus.PAID]:
            raise HTTPException(status_code=400, detail="Cannot mutate expense for a trip linked to a frozen settlement")

        if expense.status == ExpenseStatus.APPROVED:
            raise HTTPException(status_code=400, detail="Cannot mutate an approved expense")
            
        if status == ExpenseStatus.PENDING_APPROVAL:
            raise HTTPException(status_code=400, detail="Cannot change status back to pending")
            
        expense.status = status
        db.commit()
        db.refresh(expense)
        return expense

    @staticmethod
    def update_expense(db: Session, expense_id: uuid.UUID, amount: Decimal = None, payer: ExpensePayer = None, category: ExpenseCategory = None, admin_user: User = None):
        if admin_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can update expenses")
            
        expense = db.query(TripExpense).filter(TripExpense.id == expense_id).first()
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
            
        if expense.trip.settlement and expense.trip.settlement.status in [SettlementStatus.PENDING_PAYMENT, SettlementStatus.PAID]:
            raise HTTPException(status_code=400, detail="Cannot mutate expense for a trip linked to a frozen settlement")

        if amount is not None:
            expense.amount = amount
        if payer is not None:
            expense.paid_by = payer
        if category is not None:
            expense.category = category
            
        db.commit()
        db.refresh(expense)
        return expense

    @staticmethod
    def delete_expense(db: Session, expense_id: uuid.UUID, admin_user: User):
        if admin_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can delete expenses")
            
        expense = db.query(TripExpense).filter(TripExpense.id == expense_id).first()
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
            
        if expense.trip.settlement and expense.trip.settlement.status in [SettlementStatus.PENDING_PAYMENT, SettlementStatus.PAID]:
            raise HTTPException(status_code=400, detail="Cannot mutate expense for a trip linked to a frozen settlement")

        db.delete(expense)
        db.commit()
        return {"ok": True}
