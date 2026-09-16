import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException

from app.models.finance import DriverSettlement
from app.models.delivery import Trip, DeliveryRequest
from app.models.operations import TripExpense
from app.models.fleet import VehicleAssignment
from app.models.enums import SettlementStatus, ExpenseStatus, ExpensePayer, DeliveryRequestStatus
from app.models.user import User
from app.models.fleet import Driver

class SettlementService:
    @staticmethod
    def generate_settlement(
        db: Session,
        admin_user: User,
        driver_id: uuid.UUID,
        period_start: datetime,
        period_end: datetime,
        base_pay: Decimal,
        deductions: Decimal,
        deduction_reason: str = None
    ) -> DriverSettlement:
        if base_pay < 0:
            raise HTTPException(status_code=400, detail="Base pay must be non-negative")
        if deductions < 0:
            raise HTTPException(status_code=400, detail="Deductions must be non-negative")
        if deductions > 0 and not deduction_reason:
            raise HTTPException(status_code=400, detail="Deduction reason is required if deductions > 0")

        # Verify driver exists
        driver = db.query(Driver).filter(Driver.id == driver_id).first()
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")

        # Exclusive end date logic
        end_date_exclusive = period_end + timedelta(days=1)

        # We must lock the eligible trips to prevent concurrent settlements from claiming them.
        # Eligibility: 
        # 1. Trip.request.status == COMPLETED
        # 2. Trip.settlement_id IS NULL
        # 3. Trip.completed_at >= period_start and < end_date_exclusive
        
        # Subquery or join for locking: We lock trips
        # We also need to check historical VehicleAssignment to ensure this driver actually completed it.
        # The trip must have an assignment matching this driver where assignment was completed.
        
        # Fetch eligible trips
        trips = db.query(Trip).join(DeliveryRequest).join(VehicleAssignment).filter(
            DeliveryRequest.status == DeliveryRequestStatus.COMPLETED,
            Trip.settlement_id.is_(None),
            Trip.completed_at >= period_start,
            Trip.completed_at < end_date_exclusive,
            VehicleAssignment.driver_id == driver_id,
            VehicleAssignment.released_at.is_(None)
        ).with_for_update().all()

        if not trips:
            raise HTTPException(status_code=400, detail="No eligible trips found for this driver in the specified period")

        trip_ids = [t.id for t in trips]

        # Calculate reimbursements
        # Only APPROVED TripExpenses paid_by DRIVER
        reimbursements = db.query(func.coalesce(func.sum(TripExpense.amount), 0)).filter(
            TripExpense.trip_id.in_(trip_ids),
            TripExpense.status == ExpenseStatus.APPROVED,
            TripExpense.paid_by == ExpensePayer.DRIVER
        ).scalar()
        
        reimbursements = Decimal(str(reimbursements))
        
        total_payout = base_pay + reimbursements - deductions
        if total_payout < 0:
            raise HTTPException(status_code=400, detail="Deductions cannot exceed total compensation (base_pay + reimbursements)")

        settlement = DriverSettlement(
            driver_id=driver_id,
            period_start=period_start,
            period_end=period_end,
            base_pay=base_pay,
            reimbursements=reimbursements,
            deductions=deductions,
            deduction_reason=deduction_reason,
            total_payout=total_payout,
            status=SettlementStatus.DRAFT,
            generated_by=admin_user.id
        )

        db.add(settlement)
        db.flush() # Get settlement ID

        # Link trips
        for trip in trips:
            trip.settlement_id = settlement.id

        db.commit()
        db.refresh(settlement)

        return settlement

    @staticmethod
    def get_settlements(db: Session) -> List[DriverSettlement]:
        return db.query(DriverSettlement).order_by(DriverSettlement.period_start.desc()).all()

    @staticmethod
    def get_settlement(db: Session, settlement_id: uuid.UUID) -> DriverSettlement:
        settlement = db.query(DriverSettlement).filter(DriverSettlement.id == settlement_id).first()
        if not settlement:
            raise HTTPException(status_code=404, detail="Settlement not found")
        return settlement

    @staticmethod
    def update_settlement(
        db: Session,
        settlement_id: uuid.UUID,
        base_pay: Decimal = None,
        deductions: Decimal = None,
        deduction_reason: str = None
    ) -> DriverSettlement:
        settlement = db.query(DriverSettlement).filter(DriverSettlement.id == settlement_id).with_for_update().first()
        if not settlement:
            raise HTTPException(status_code=404, detail="Settlement not found")
            
        if settlement.status != SettlementStatus.DRAFT:
            raise HTTPException(status_code=400, detail="Cannot modify a settlement that is not in DRAFT status")

        if base_pay is not None:
            if base_pay < 0:
                raise HTTPException(status_code=400, detail="Base pay must be non-negative")
            settlement.base_pay = base_pay
            
        if deductions is not None:
            if deductions < 0:
                raise HTTPException(status_code=400, detail="Deductions must be non-negative")
            if deductions > 0 and not deduction_reason and not settlement.deduction_reason:
                raise HTTPException(status_code=400, detail="Deduction reason is required if deductions > 0")
            settlement.deductions = deductions
            
        if deduction_reason is not None:
            settlement.deduction_reason = deduction_reason

        total_payout = settlement.base_pay + settlement.reimbursements - settlement.deductions
        if total_payout < 0:
            raise HTTPException(status_code=400, detail="Deductions cannot exceed total compensation (base_pay + reimbursements)")

        settlement.total_payout = total_payout

        db.commit()
        db.refresh(settlement)
        return settlement

    @staticmethod
    def submit_settlement(db: Session, settlement_id: uuid.UUID) -> DriverSettlement:
        settlement = SettlementService.get_settlement(db, settlement_id)
        if settlement.status != SettlementStatus.DRAFT:
            raise HTTPException(status_code=400, detail="Only DRAFT settlements can be submitted")
        
        settlement.status = SettlementStatus.PENDING_PAYMENT
        db.commit()
        db.refresh(settlement)
        return settlement

    @staticmethod
    def pay_settlement(db: Session, settlement_id: uuid.UUID, reference_number: str) -> DriverSettlement:
        if not reference_number:
            raise HTTPException(status_code=400, detail="Payment reference number is required")

        # Lock the settlement for safety during payment
        settlement = db.query(DriverSettlement).filter(
            DriverSettlement.id == settlement_id
        ).with_for_update().first()

        if not settlement:
            raise HTTPException(status_code=404, detail="Settlement not found")

        if settlement.status != SettlementStatus.PENDING_PAYMENT:
            raise HTTPException(status_code=400, detail="Only PENDING_PAYMENT settlements can be paid")

        settlement.status = SettlementStatus.PAID
        settlement.paid_at = datetime.now(timezone.utc)
        settlement.reference_number = reference_number
        db.commit()
        db.refresh(settlement)
        return settlement

    @staticmethod
    def cancel_settlement(db: Session, settlement_id: uuid.UUID) -> DriverSettlement:
        settlement = SettlementService.get_settlement(db, settlement_id)
        if settlement.status != SettlementStatus.DRAFT:
            raise HTTPException(status_code=400, detail="Only DRAFT settlements can be cancelled")

        settlement.status = SettlementStatus.CANCELLED
        
        # Unlink trips
        for trip in settlement.trips:
            trip.settlement_id = None

        db.commit()
        db.refresh(settlement)
        return settlement
