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
    async def _get_sum(model_class, match_query, sum_field: str) -> Decimal:
        pipeline = [
            {"$match": match_query},
            {"$group": {"_id": None, "total": {"$sum": {"$toDecimal": f"${sum_field}"}}}}
        ]
        result = await model_class.aggregate(pipeline).to_list()
        if result:
            # result[0]['total'] will be a Decimal128, we convert to python Decimal
            return Decimal(str(result[0]["total"]))
        return Decimal("0.0")

    @staticmethod
    async def get_dashboard() -> AdminDashboardRead:
        # Finance metrics
        total_invoiced = await AnalyticsService._get_sum(Invoice, {}, "total_amount")
        total_collected = await AnalyticsService._get_sum(Invoice, {}, "amount_paid")
        outstanding_balance = total_invoiced - total_collected

        # Operating Expenses
        approved_trip_expenses = await AnalyticsService._get_sum(
            TripExpense, 
            {"status": ExpenseStatus.APPROVED.value}, 
            "amount"
        )
        
        completed_maintenance_cost = await AnalyticsService._get_sum(
            VehicleMaintenance,
            {"status": MaintenanceStatus.COMPLETED.value},
            "cost"
        )
        
        total_operating_expenses = approved_trip_expenses + completed_maintenance_cost
        
        operating_profit = total_collected - total_operating_expenses
        collected_cash_profit = total_collected - total_operating_expenses

        # Active Deliveries
        active_statuses = [
            DeliveryRequestStatus.DRIVER_ASSIGNED.value,
            DeliveryRequestStatus.PICKUP_IN_PROGRESS.value,
            DeliveryRequestStatus.IN_TRANSIT.value,
            DeliveryRequestStatus.ARRIVED.value,
            DeliveryRequestStatus.POD_SUBMITTED.value
        ]
        active_deliveries = await DeliveryRequest.find({"status": {"$in": active_statuses}}).count()

        # Fleet Utilization
        # (ASSIGNED / (AVAILABLE + ASSIGNED + MAINTENANCE)) * 100
        assigned_vehicles = await Vehicle.find({"status": VehicleStatus.ASSIGNED.value}).count()
        total_vehicles = await Vehicle.find({"status": {"$in": [
                VehicleStatus.AVAILABLE.value,
                VehicleStatus.ASSIGNED.value,
                VehicleStatus.MAINTENANCE.value
            ]}}).count()

        fleet_utilization = 0.0
        if total_vehicles > 0:
            fleet_utilization = (assigned_vehicles / total_vehicles) * 100.0

        # Driver Settlements
        pending_driver_payables = await AnalyticsService._get_sum(
            DriverSettlement,
            {"status": SettlementStatus.PENDING_PAYMENT.value},
            "total_payout"
        )
        
        draft_settlement_value = await AnalyticsService._get_sum(
            DriverSettlement,
            {"status": SettlementStatus.DRAFT.value},
            "total_payout"
        )

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
