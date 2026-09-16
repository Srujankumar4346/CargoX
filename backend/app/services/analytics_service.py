from sqlalchemy.orm import Session
from sqlalchemy import func
from decimal import Decimal

from app.models.finance import Invoice
from app.models.delivery import DeliveryRequest
from app.models.fleet import Vehicle
from app.models.enums import DeliveryRequestStatus, VehicleStatus, ExpenseStatus, MaintenanceStatus, SettlementStatus
from app.schemas.analytics import AdminDashboardRead
from app.models.operations import TripExpense, VehicleMaintenance
from app.models.finance import DriverSettlement

class AnalyticsService:
    @staticmethod
    def get_dashboard(db: Session) -> AdminDashboardRead:
        # Finance metrics
        finance_metrics = db.query(
            func.coalesce(func.sum(Invoice.total_amount), 0).label('total_invoiced'),
            func.coalesce(func.sum(Invoice.amount_paid), 0).label('total_collected')
        ).first()

        total_invoiced = Decimal(str(finance_metrics.total_invoiced))
        total_collected = Decimal(str(finance_metrics.total_collected))
        outstanding_balance = total_invoiced - total_collected

        # Operating Expenses
        approved_trip_expenses = db.query(func.coalesce(func.sum(TripExpense.amount), 0)).filter(
            TripExpense.status == ExpenseStatus.APPROVED
        ).scalar()
        
        completed_maintenance_cost = db.query(func.coalesce(func.sum(VehicleMaintenance.cost), 0)).filter(
            VehicleMaintenance.status == MaintenanceStatus.COMPLETED
        ).scalar()
        
        total_operating_expenses = Decimal(str(approved_trip_expenses)) + Decimal(str(completed_maintenance_cost))
        
        operating_profit = total_collected - total_operating_expenses
        collected_cash_profit = total_collected - total_operating_expenses

        # Active Deliveries
        active_statuses = [
            DeliveryRequestStatus.DRIVER_ASSIGNED,
            DeliveryRequestStatus.PICKUP_IN_PROGRESS,
            DeliveryRequestStatus.IN_TRANSIT,
            DeliveryRequestStatus.ARRIVED,
            DeliveryRequestStatus.POD_SUBMITTED
        ]
        active_deliveries = db.query(DeliveryRequest).filter(
            DeliveryRequest.status.in_(active_statuses)
        ).count()

        # Fleet Utilization
        # (ASSIGNED / (AVAILABLE + ASSIGNED + MAINTENANCE)) * 100
        assigned_vehicles = db.query(Vehicle).filter(Vehicle.status == VehicleStatus.ASSIGNED).count()
        total_vehicles = db.query(Vehicle).filter(
            Vehicle.status.in_([
                VehicleStatus.AVAILABLE,
                VehicleStatus.ASSIGNED,
                VehicleStatus.MAINTENANCE
            ])
        ).count()

        fleet_utilization = 0.0
        if total_vehicles > 0:
            fleet_utilization = (assigned_vehicles / total_vehicles) * 100.0

        # Driver Settlements
        pending_payables = db.query(func.coalesce(func.sum(DriverSettlement.total_payout), 0)).filter(
            DriverSettlement.status == SettlementStatus.PENDING_PAYMENT
        ).scalar()
        
        draft_value = db.query(func.coalesce(func.sum(DriverSettlement.total_payout), 0)).filter(
            DriverSettlement.status == SettlementStatus.DRAFT
        ).scalar()
        
        pending_driver_payables = Decimal(str(pending_payables))
        draft_settlement_value = Decimal(str(draft_value))

        return AdminDashboardRead(
            total_invoiced=total_invoiced,
            total_collected=total_collected,
            outstanding_balance=outstanding_balance,
            total_operating_expenses=total_operating_expenses,
            operating_profit=operating_profit,
            collected_cash_profit=collected_cash_profit,
            fleet_utilization_percent=fleet_utilization,
            active_deliveries=active_deliveries,
            pending_driver_payables=pending_driver_payables,
            draft_settlement_value=draft_settlement_value
        )
