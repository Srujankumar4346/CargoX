import uuid
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import HTTPException

from app.models.operations import TripExpense
from app.models.delivery import Trip, DeliveryRequest
from app.models.fleet import VehicleAssignment, Driver
from app.models.finance import DriverSettlement
from app.models.enums import ExpenseCategory, ExpenseStatus, DeliveryRequestStatus, UserRole, SettlementStatus, ExpensePayer
from app.models.user import User

VALID_EXPENSE_TRIP_STATES = {
    DeliveryRequestStatus.DRIVER_ASSIGNED.value,
    DeliveryRequestStatus.PICKUP_IN_PROGRESS.value,
    DeliveryRequestStatus.IN_TRANSIT.value,
    DeliveryRequestStatus.ARRIVED.value,
    DeliveryRequestStatus.POD_SUBMITTED.value,
    DeliveryRequestStatus.DELIVERED.value,
    DeliveryRequestStatus.COMPLETED.value
}

class ExpenseService:
    @staticmethod
    async def get_trip_with_validation(trip_id: uuid.UUID):
        trip = await Trip.find_one(Trip.id == trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        
        request = await DeliveryRequest.find_one(DeliveryRequest.id == trip.request_id)
        if request.status not in VALID_EXPENSE_TRIP_STATES:
            raise HTTPException(status_code=400, detail=f"Cannot record expense for trip in {request.status} state")
            
        return trip, request

    @staticmethod
    async def submit_expense(
        trip_id: uuid.UUID,
        user: User,
        amount: Decimal,
        category: ExpenseCategory,
        description: str = None,
        receipt_url: str = None
    ) -> TripExpense:
        
        if amount <= 0:
            raise HTTPException(status_code=422, detail="Expense amount must be positive")
            
        trip, request = await ExpenseService.get_trip_with_validation(trip_id)

        # Check Settlement Immutability
        if trip.settlement_id:
            settlement = await DriverSettlement.find_one(DriverSettlement.id == trip.settlement_id)
            if settlement and settlement.status in [SettlementStatus.PENDING_PAYMENT, SettlementStatus.PAID]:
                raise HTTPException(status_code=400, detail="Cannot record expense for a trip linked to a frozen settlement")

        # Driver checks
        if user.role == UserRole.DRIVER:
            if request.status == DeliveryRequestStatus.COMPLETED:
                raise HTTPException(status_code=400, detail="Cannot submit expenses for a completed trip")
            
            driver = await Driver.find_one(Driver.user_id == user.id)
            if not driver:
                raise HTTPException(status_code=403, detail="Driver profile not found")
                
            assignment = await VehicleAssignment.find_one(
                VehicleAssignment.trip_id == trip.id,
                VehicleAssignment.driver_id == driver.id,
                VehicleAssignment.released_at == None
            )
            if not assignment:
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
        
        await expense.insert()
        return expense

    @staticmethod
    async def list_expenses_for_trip(trip_id: uuid.UUID, user: User):
        trip = await Trip.find_one(Trip.id == trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
            
        if user.role == UserRole.DRIVER:
            driver = await Driver.find_one(Driver.user_id == user.id)
            if not driver:
                raise HTTPException(status_code=403, detail="Driver profile not found")
            assignment = await VehicleAssignment.find_one(
                VehicleAssignment.trip_id == trip.id,
                VehicleAssignment.driver_id == driver.id,
                VehicleAssignment.released_at == None
            )
            if not assignment:
                raise HTTPException(status_code=403, detail="Not assigned to this trip")
        elif user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        return await TripExpense.find(TripExpense.trip_id == trip_id).to_list()
        
    @staticmethod
    async def change_expense_status(expense_id: uuid.UUID, status: ExpenseStatus, admin_user: User):
        if admin_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can change expense status")
            
        expense = await TripExpense.find_one(TripExpense.id == expense_id)
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
            
        trip = await Trip.find_one(Trip.id == expense.trip_id)
        if trip and trip.settlement_id:
            settlement = await DriverSettlement.find_one(DriverSettlement.id == trip.settlement_id)
            if settlement and settlement.status in [SettlementStatus.PENDING_PAYMENT, SettlementStatus.PAID]:
                raise HTTPException(status_code=400, detail="Cannot mutate expense for a trip linked to a frozen settlement")

        if expense.status == ExpenseStatus.APPROVED:
            raise HTTPException(status_code=400, detail="Cannot mutate an approved expense")
            
        if status == ExpenseStatus.PENDING_APPROVAL:
            raise HTTPException(status_code=400, detail="Cannot change status back to pending")
            
        expense.status = status
        await expense.save()
        return expense

    @staticmethod
    async def update_expense(expense_id: uuid.UUID, amount: Decimal = None, payer: ExpensePayer = None, category: ExpenseCategory = None, admin_user: User = None):
        if admin_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can update expenses")
            
        expense = await TripExpense.find_one(TripExpense.id == expense_id)
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
            
        trip = await Trip.find_one(Trip.id == expense.trip_id)
        if trip and trip.settlement_id:
            settlement = await DriverSettlement.find_one(DriverSettlement.id == trip.settlement_id)
            if settlement and settlement.status in [SettlementStatus.PENDING_PAYMENT, SettlementStatus.PAID]:
                raise HTTPException(status_code=400, detail="Cannot mutate expense for a trip linked to a frozen settlement")

        if amount is not None:
            expense.amount = amount
        if payer is not None:
            expense.paid_by = payer
        if category is not None:
            expense.category = category
            
        await expense.save()
        return expense

    @staticmethod
    async def delete_expense(expense_id: uuid.UUID, admin_user: User):
        if admin_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can delete expenses")
            
        expense = await TripExpense.find_one(TripExpense.id == expense_id)
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
            
        trip = await Trip.find_one(Trip.id == expense.trip_id)
        if trip and trip.settlement_id:
            settlement = await DriverSettlement.find_one(DriverSettlement.id == trip.settlement_id)
            if settlement and settlement.status in [SettlementStatus.PENDING_PAYMENT, SettlementStatus.PAID]:
                raise HTTPException(status_code=400, detail="Cannot mutate expense for a trip linked to a frozen settlement")

        await expense.delete()
        return {"ok": True}
