import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from typing import List, Optional
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
    async def generate_settlement(
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
        driver = await Driver.find_one(Driver.id == driver_id)
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")

        # Exclusive end date logic
        end_date_exclusive = period_end + timedelta(days=1)
        
        # Fetch eligible trips
        # Eligibility: Trip.request.status == COMPLETED, Trip.settlement_id IS NULL, Trip.completed_at >= period_start and < end_date_exclusive
        # Driver assignment released_at is None
        
        completed_requests = await DeliveryRequest.find(DeliveryRequest.status == DeliveryRequestStatus.COMPLETED).to_list()
        completed_req_ids = [req.id for req in completed_requests]
        
        eligible_trips = await Trip.find(
            Trip.request_id.in_(completed_req_ids),
            Trip.settlement_id == None,
            Trip.completed_at >= period_start,
            Trip.completed_at < end_date_exclusive
        ).to_list()
        
        trips = []
        for trip in eligible_trips:
            assignment = await VehicleAssignment.find_one(
                VehicleAssignment.trip_id == trip.id,
                VehicleAssignment.driver_id == driver_id,
                VehicleAssignment.released_at == None
            )
            if assignment:
                trips.append(trip)

        if not trips:
            raise HTTPException(status_code=400, detail="No eligible trips found for this driver in the specified period")

        trip_ids = [t.id for t in trips]

        # Calculate reimbursements
        # Only APPROVED TripExpenses paid_by DRIVER
        reimb_expenses = await TripExpense.find(
            TripExpense.trip_id.in_(trip_ids),
            TripExpense.status == ExpenseStatus.APPROVED,
            TripExpense.paid_by == ExpensePayer.DRIVER
        ).to_list()
        
        reimbursements = sum([e.amount for e in reimb_expenses])
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

        await settlement.insert()

        # Link trips
        for trip in trips:
            trip.settlement_id = settlement.id
            await trip.save()

        return settlement

    @staticmethod
    async def get_settlements() -> List[DriverSettlement]:
        return await DriverSettlement.find_all().to_list()

    @staticmethod
    async def get_settlement(settlement_id: uuid.UUID) -> DriverSettlement:
        settlement = await DriverSettlement.find_one(DriverSettlement.id == settlement_id)
        if not settlement:
            raise HTTPException(status_code=404, detail="Settlement not found")
        return settlement

    @staticmethod
    async def update_settlement(
        settlement_id: uuid.UUID,
        base_pay: Decimal = None,
        deductions: Decimal = None,
        deduction_reason: str = None
    ) -> DriverSettlement:
        settlement = await DriverSettlement.find_one(DriverSettlement.id == settlement_id)
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

        await settlement.save()
        return settlement

    @staticmethod
    async def submit_settlement(settlement_id: uuid.UUID) -> DriverSettlement:
        settlement = await SettlementService.get_settlement(settlement_id)
        if settlement.status != SettlementStatus.DRAFT:
            raise HTTPException(status_code=400, detail="Only DRAFT settlements can be submitted")
        
        settlement.status = SettlementStatus.PENDING_PAYMENT
        await settlement.save()
        return settlement

    @staticmethod
    async def pay_settlement(settlement_id: uuid.UUID, reference_number: str) -> DriverSettlement:
        if not reference_number:
            raise HTTPException(status_code=400, detail="Payment reference number is required")

        settlement = await DriverSettlement.find_one(DriverSettlement.id == settlement_id)

        if not settlement:
            raise HTTPException(status_code=404, detail="Settlement not found")

        if settlement.status != SettlementStatus.PENDING_PAYMENT:
            raise HTTPException(status_code=400, detail="Only PENDING_PAYMENT settlements can be paid")

        settlement.status = SettlementStatus.PAID
        settlement.paid_at = datetime.now(timezone.utc)
        settlement.reference_number = reference_number
        await settlement.save()
        return settlement

    @staticmethod
    async def cancel_settlement(settlement_id: uuid.UUID) -> DriverSettlement:
        settlement = await SettlementService.get_settlement(settlement_id)
        if settlement.status != SettlementStatus.DRAFT:
            raise HTTPException(status_code=400, detail="Only DRAFT settlements can be cancelled")

        settlement.status = SettlementStatus.CANCELLED
        
        # Unlink trips
        trips = await Trip.find(Trip.settlement_id == settlement.id).to_list()
        for trip in trips:
            trip.settlement_id = None
            await trip.save()

        await settlement.save()
        return settlement
