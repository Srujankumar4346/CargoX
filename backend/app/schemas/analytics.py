from pydantic import BaseModel, ConfigDict
from decimal import Decimal

class AdminDashboardRead(BaseModel):
    total_invoiced: Decimal
    total_collected: Decimal
    outstanding_balance: Decimal
    total_operating_expenses: Decimal
    operating_profit: Decimal
    collected_cash_profit: Decimal
    fleet_utilization_percent: float
    active_deliveries: int
    pending_driver_payables: Decimal
    draft_settlement_value: Decimal

    model_config = ConfigDict(from_attributes=True)
