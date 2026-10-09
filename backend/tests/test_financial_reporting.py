import pytest
import uuid
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal

from app.models.company import CustomerCompany
from app.models.user import User
from app.models.enums import (
    UserRole,
    InvoiceStatus,
    PaymentMethod,
    SettlementStatus,
    ExpenseCategory,
    ExpenseStatus,
    MaintenanceType,
    MaintenanceStatus,
    DeliveryRequestStatus
)
from app.models.finance import Invoice, Payment, DriverSettlement
from app.models.operations import TripExpense, VehicleMaintenance
from app.models.delivery import DeliveryRequest, Trip
from app.models.fleet import Driver, Vehicle, VehicleAssignment
from app.models.pricing import Quotation
from app.services.financial_reporting_service import IST_TZ, FinancialReportingService

@pytest.fixture
async def admin_user():
    user = User(
        clerk_user_id="test_admin_finance_clerk_id",
        role=UserRole.ADMIN,
        email="finance_admin@cargox.com"
    )
    await user.insert()
    return user

@pytest.fixture
async def customer_user():
    user = User(
        clerk_user_id="test_customer_finance_clerk_id",
        role=UserRole.CUSTOMER_USER,
        email="customer@cargox.com"
    )
    await user.insert()
    return user

@pytest.fixture
async def driver_user():
    user = User(
        clerk_user_id="test_driver_finance_clerk_id",
        role=UserRole.DRIVER,
        email="driver@cargox.com"
    )
    await user.insert()
    return user

@pytest.mark.anyio
async def test_period_bounds_weekly_monday_to_monday():
    # 2026-10-07 is a Wednesday
    start_utc, end_utc, bounds = FinancialReportingService.get_period_bounds("weekly", "2026-10-07")
    assert bounds.start_date == "2026-10-05" # Monday
    assert bounds.end_date == "2026-10-12"   # Next Monday
    assert bounds.display_range == "05 Oct 2026 – 11 Oct 2026"
    assert bounds.prev_period_start == "2026-09-28"
    assert bounds.next_period_start == "2026-10-12"

@pytest.mark.anyio
async def test_period_bounds_monthly():
    start_utc, end_utc, bounds = FinancialReportingService.get_period_bounds("monthly", "2026-10-15")
    assert bounds.start_date == "2026-10-01"
    assert bounds.end_date == "2026-11-01"
    assert bounds.prev_period_start == "2026-09-01"
    assert bounds.next_period_start == "2026-11-01"

@pytest.mark.anyio
async def test_new_week_starts_at_zero_with_historical_retention(async_client, admin_user, monkeypatch):
    """
    Core Invariant:
    Week 1 (2026-10-05 to 2026-10-12) has activity:
      - Invoice issued: 1,00,000 (Tax 18,000, Subtotal 82,000)
      - Payment collected: 80,000 (Amount due: 20,000)
      - Approved expense: 20,000
    Week 2 (2026-10-12 to 2026-10-19) has NO new activity:
      - Period customer charges: 0
      - Period payments collected: 0
      - Period approved expenses: 0
      - BUT Outstanding Receivables as of end of Week 2 is STILL 20,000!
    """
    from app.api.deps import get_current_admin
    from app.main import app
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    # Create customer company
    company = CustomerCompany(name="Acme Corp", billing_address="Bangalore")
    await company.insert()

    # Incur Week 1 Invoice & Payment (Issued on 2026-10-06 10:00:00 IST -> UTC is 04:30)
    w1_dt = datetime(2026, 10, 6, 4, 30)
    inv1 = Invoice(
        invoice_number="INV-2026-W1",
        request_id=uuid.uuid4(),
        customer_company_id=company.id,
        quotation_id=uuid.uuid4(),
        subtotal=Decimal("82000.00"),
        tax=Decimal("18000.00"),
        discount=Decimal("0.00"),
        total_amount=Decimal("100000.00"),
        amount_paid=Decimal("80000.00"),
        amount_due=Decimal("20000.00"),
        status=InvoiceStatus.PARTIALLY_PAID,
        issued_at=w1_dt
    )
    await inv1.insert()

    pmt1 = Payment(
        invoice_id=inv1.id,
        amount=Decimal("80000.00"),
        method=PaymentMethod.BANK_TRANSFER,
        paid_at=w1_dt,
        recorded_by=admin_user.id
    )
    await pmt1.insert()

    exp1 = TripExpense(
        trip_id=uuid.uuid4(),
        amount=Decimal("20000.00"),
        category=ExpenseCategory.FUEL,
        status=ExpenseStatus.APPROVED,
        date=w1_dt,
        recorded_by=admin_user.id
    )
    await exp1.insert()

    # 1. Query Week 1 Summary
    res_w1 = await async_client.get("/api/v1/admin/finance/reports/summary?period=weekly&reference_date=2026-10-07")
    assert res_w1.status_code == 200
    data_w1 = res_w1.json()["summary"]
    assert Decimal(str(data_w1["period_customer_charges"])) == Decimal("100000.00")
    assert Decimal(str(data_w1["payments_collected"])) == Decimal("80000.00")
    assert Decimal(str(data_w1["approved_operating_expenses"])) == Decimal("20000.00")
    assert Decimal(str(data_w1["outstanding_receivables"])) == Decimal("20000.00")
    assert Decimal(str(data_w1["tax_charged_period"])) == Decimal("18000.00")
    assert Decimal(str(data_w1["cash_operating_profit"])) == Decimal("60000.00") # 80,000 - 20,000

    # 2. Query Week 2 Summary (No activity occurred in Week 2: 2026-10-12 to 2026-10-19)
    res_w2 = await async_client.get("/api/v1/admin/finance/reports/summary?period=weekly&reference_date=2026-10-14")
    assert res_w2.status_code == 200
    data_w2 = res_w2.json()["summary"]
    # NEW WEEK STARTS AT ZERO FOR ACTIVITY:
    assert Decimal(str(data_w2["period_customer_charges"])) == Decimal("0.00")
    assert Decimal(str(data_w2["payments_collected"])) == Decimal("0.00")
    assert Decimal(str(data_w2["approved_operating_expenses"])) == Decimal("0.00")
    assert Decimal(str(data_w2["total_invoices_issued"])) == 0
    assert Decimal(str(data_w2["payment_transactions_count"])) == 0
    # BUT HISTORICAL DEBT PERSISTS:
    assert Decimal(str(data_w2["outstanding_receivables"])) == Decimal("20000.00")
    assert data_w2["partially_paid_invoices_count"] == 1

    app.dependency_overrides.clear()

@pytest.mark.anyio
async def test_expense_categorization_and_rejection_exclusion(async_client, admin_user):
    from app.api.deps import get_current_admin
    from app.main import app
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    w_dt = datetime(2026, 10, 6, 4, 30)
    trip_id = uuid.uuid4()

    # Approved fuel expense
    await TripExpense(
        trip_id=trip_id, amount=Decimal("5000.00"), category=ExpenseCategory.FUEL,
        status=ExpenseStatus.APPROVED, date=w_dt, recorded_by=admin_user.id
    ).insert()

    # Rejected fuel expense
    await TripExpense(
        trip_id=trip_id, amount=Decimal("3000.00"), category=ExpenseCategory.FUEL,
        status=ExpenseStatus.REJECTED, date=w_dt, recorded_by=admin_user.id
    ).insert()

    # Pending toll expense
    await TripExpense(
        trip_id=trip_id, amount=Decimal("1500.00"), category=ExpenseCategory.TOLL,
        status=ExpenseStatus.PENDING_APPROVAL, date=w_dt, recorded_by=admin_user.id
    ).insert()

    # Completed maintenance
    await VehicleMaintenance(
        vehicle_id=uuid.uuid4(), maintenance_type=MaintenanceType.ROUTINE,
        status=MaintenanceStatus.COMPLETED, cost=Decimal("12000.00"),
        scheduled_date=w_dt, completed_date=w_dt, recorded_by=admin_user.id
    ).insert()

    res = await async_client.get("/api/v1/admin/finance/reports/expenses?period=weekly&reference_date=2026-10-07")
    assert res.status_code == 200
    data = res.json()
    assert Decimal(str(data["vehicle_maintenance_completed"])) == Decimal("12000.00")
    # Total approved operating = 5000 (fuel) + 12000 (maintenance) = 17000.00
    assert Decimal(str(data["total_approved_operating_expenses"])) == Decimal("17000.00")

    cats = {c["category"]: c for c in data["categories"]}
    assert Decimal(str(cats["FUEL"]["approved_amount"])) == Decimal("5000.00")
    assert Decimal(str(cats["FUEL"]["rejected_amount"])) == Decimal("3000.00")
    assert Decimal(str(cats["TOLL"]["pending_amount"])) == Decimal("1500.00")
    assert Decimal(str(cats["TOLL"]["approved_amount"])) == Decimal("0.00")

    app.dependency_overrides.clear()

@pytest.mark.anyio
async def test_driver_settlement_creation_vs_payment_date(async_client, admin_user):
    from app.api.deps import get_current_admin
    from app.main import app
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    driver_id = uuid.uuid4()
    # Generated in Week 1 (period_end: 2026-10-08)
    gen_dt = datetime(2026, 10, 8, 4, 30)
    # Paid in Week 2 (paid_at: 2026-10-15)
    paid_dt = datetime(2026, 10, 15, 4, 30)

    settlement = DriverSettlement(
        driver_id=driver_id,
        period_start=datetime(2026, 10, 1, 0, 0),
        period_end=gen_dt,
        customer_amount=Decimal("50000.00"),
        service_fee_percentage=Decimal("4.00"),
        service_fee_amount=Decimal("2000.00"),
        driver_payable_amount=Decimal("48000.00"),
        total_payout=Decimal("48000.00"),
        status=SettlementStatus.PAID,
        paid_at=paid_dt,
        generated_by=admin_user.id
    )
    await settlement.insert()

    # In Week 1: Generated = 48,000, Paid = 0
    res_w1 = await async_client.get("/api/v1/admin/finance/reports/settlements?period=weekly&reference_date=2026-10-07")
    assert res_w1.status_code == 200
    data_w1 = res_w1.json()
    assert Decimal(str(data_w1["driver_payable_generated"])) == Decimal("48000.00")
    assert Decimal(str(data_w1["service_fee_generated"])) == Decimal("2000.00")
    assert Decimal(str(data_w1["total_payout_paid"])) == Decimal("0.00")

    # In Week 2: Generated = 0, Paid = 48,000
    res_w2 = await async_client.get("/api/v1/admin/finance/reports/settlements?period=weekly&reference_date=2026-10-14")
    assert res_w2.status_code == 200
    data_w2 = res_w2.json()
    assert Decimal(str(data_w2["driver_payable_generated"])) == Decimal("0.00")
    assert Decimal(str(data_w2["total_payout_paid"])) == Decimal("48000.00")

    app.dependency_overrides.clear()

@pytest.mark.anyio
async def test_customer_and_driver_role_cannot_access_finance_reports(async_client, customer_user, driver_user):
    from app.api.deps import get_current_user
    from app.main import app

    # Try accessing as Customer
    app.dependency_overrides[get_current_user] = lambda: customer_user
    res_cust = await async_client.get("/api/v1/admin/finance/reports/summary")
    assert res_cust.status_code in [401, 403]

    # Try accessing as Driver
    app.dependency_overrides[get_current_user] = lambda: driver_user
    res_drv = await async_client.get("/api/v1/admin/finance/reports/summary")
    assert res_drv.status_code in [401, 403]

    app.dependency_overrides.clear()

@pytest.mark.anyio
async def test_csv_export_endpoint(async_client, admin_user):
    from app.api.deps import get_current_admin
    from app.main import app
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    res = await async_client.get("/api/v1/admin/finance/reports/export/csv?period=weekly&reference_date=2026-10-07")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "CargoX_Weekly_Financial_Report" in res.headers["content-disposition"]
    text = res.text
    assert "=== FINANCIAL SUMMARY OVERVIEW ===" in text
    assert "=== BOOKING-WISE FINANCIAL LEDGER ===" in text

    app.dependency_overrides.clear()
