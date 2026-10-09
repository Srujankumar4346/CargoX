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
        clerk_user_id="test_admin_recon_clerk_id",
        role=UserRole.ADMIN,
        email="recon_admin@cargox.com"
    )
    await user.insert()
    return user

@pytest.fixture
async def customer_user():
    user = User(
        clerk_user_id="test_customer_recon_clerk_id",
        role=UserRole.CUSTOMER_USER,
        email="customer_recon@cargox.com"
    )
    await user.insert()
    return user

@pytest.mark.anyio
async def test_year_end_and_month_end_boundaries():
    """
    Test transition across year-end (December 2026 to January 2027)
    and leap month boundaries.
    """
    # December 2026
    start_utc, end_utc, bounds = FinancialReportingService.get_period_bounds("monthly", "2026-12-15")
    assert bounds.start_date == "2026-12-01"
    assert bounds.end_date == "2027-01-01"
    assert bounds.prev_period_start == "2026-11-01"
    assert bounds.next_period_start == "2027-01-01"
    assert bounds.display_range == "01 Dec 2026 – 31 Dec 2026"

    # January 2027
    start_utc_jan, end_utc_jan, bounds_jan = FinancialReportingService.get_period_bounds("monthly", "2027-01-01")
    assert bounds_jan.start_date == "2027-01-01"
    assert bounds_jan.end_date == "2027-02-01"
    assert bounds_jan.prev_period_start == "2026-12-01"
    assert bounds_jan.next_period_start == "2027-02-01"

@pytest.mark.anyio
async def test_reconciliation_invoice_issued_w1_paid_w2(async_client, admin_user):
    """
    Scenario 1:
    Invoice issued in Week 1 (2026-10-05 to 2026-10-12) for ₹50,000.
    Payment received in Week 2 (2026-10-12 to 2026-10-19) for ₹50,000.
    
    Expected Reconciliations:
    - In Week 1:
        customer_charges = 50,000
        payments_collected = 0
        outstanding_receivables = 50,000
    - In Week 2:
        customer_charges = 0
        payments_collected = 50,000
        outstanding_receivables = 0
    """
    from app.api.deps import get_current_admin
    from app.main import app
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    company = CustomerCompany(name="Recon Logistics", billing_address="Hyderabad")
    await company.insert()

    # Week 1: 2026-10-06 10:00 IST -> UTC: 2026-10-06 04:30
    w1_dt = datetime(2026, 10, 6, 4, 30)
    # Week 2: 2026-10-13 10:00 IST -> UTC: 2026-10-13 04:30
    w2_dt = datetime(2026, 10, 13, 4, 30)

    inv = Invoice(
        invoice_number="INV-RECON-001",
        request_id=uuid.uuid4(),
        customer_company_id=company.id,
        quotation_id=uuid.uuid4(),
        subtotal=Decimal("41000.00"),
        tax=Decimal("9000.00"),
        discount=Decimal("0.00"),
        total_amount=Decimal("50000.00"),
        amount_paid=Decimal("0.00"),
        amount_due=Decimal("50000.00"),
        status=InvoiceStatus.UNPAID,
        issued_at=w1_dt
    )
    await inv.insert()

    # Check Week 1 before payment
    res_w1 = await async_client.get("/api/v1/admin/finance/reports/summary?period=weekly&reference_date=2026-10-06")
    data_w1 = res_w1.json()["summary"]
    assert Decimal(str(data_w1["period_customer_charges"])) == Decimal("50000.00")
    assert Decimal(str(data_w1["payments_collected"])) == Decimal("0.00")
    assert Decimal(str(data_w1["outstanding_receivables"])) == Decimal("50000.00")

    # Now pay in Week 2
    inv.amount_paid = Decimal("50000.00")
    inv.amount_due = Decimal("0.00")
    inv.status = InvoiceStatus.PAID
    await inv.save()

    pmt = Payment(
        invoice_id=inv.id,
        amount=Decimal("50000.00"),
        method=PaymentMethod.UPI,
        paid_at=w2_dt,
        recorded_by=admin_user.id
    )
    await pmt.insert()

    # Re-check Week 1: Customer charges remains 50,000, payments in W1 remains 0
    res_w1_after = await async_client.get("/api/v1/admin/finance/reports/summary?period=weekly&reference_date=2026-10-06")
    data_w1_after = res_w1_after.json()["summary"]
    assert Decimal(str(data_w1_after["period_customer_charges"])) == Decimal("50000.00")
    assert Decimal(str(data_w1_after["payments_collected"])) == Decimal("0.00")

    # Check Week 2: Period customer charges is 0, Payments collected is 50,000, Outstanding due is 0
    res_w2 = await async_client.get("/api/v1/admin/finance/reports/summary?period=weekly&reference_date=2026-10-13")
    data_w2 = res_w2.json()["summary"]
    assert Decimal(str(data_w2["period_customer_charges"])) == Decimal("0.00")
    assert Decimal(str(data_w2["payments_collected"])) == Decimal("50000.00")
    assert Decimal(str(data_w2["outstanding_receivables"])) == Decimal("0.00")

    app.dependency_overrides.clear()

@pytest.mark.anyio
async def test_settlement_with_reimbursements_and_deductions_reconciliation(async_client, admin_user):
    """
    Scenario:
    Customer amount: ₹20,000
    Service fee 4%: ₹800
    Driver payable base: ₹19,200
    Reimbursements: ₹1,500 (Toll paid by driver)
    Deductions: ₹500 (Delay penalty)
    Total Payout: 19,200 + 1,500 - 500 = ₹20,200
    """
    from app.api.deps import get_current_admin
    from app.main import app
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    driver_id = uuid.uuid4()
    gen_dt = datetime(2026, 10, 8, 4, 30)

    settlement = DriverSettlement(
        driver_id=driver_id,
        period_start=datetime(2026, 10, 1, 0, 0),
        period_end=gen_dt,
        customer_amount=Decimal("20000.00"),
        service_fee_percentage=Decimal("4.00"),
        service_fee_amount=Decimal("800.00"),
        driver_payable_amount=Decimal("19200.00"),
        base_pay=Decimal("0.00"),
        reimbursements=Decimal("1500.00"),
        deductions=Decimal("500.00"),
        deduction_reason="Late penalty",
        total_payout=Decimal("20200.00"),
        status=SettlementStatus.PENDING_PAYMENT,
        generated_by=admin_user.id
    )
    await settlement.insert()

    res = await async_client.get("/api/v1/admin/finance/reports/settlements?period=weekly&reference_date=2026-10-08")
    assert res.status_code == 200
    data = res.json()
    assert Decimal(str(data["driver_payable_generated"])) == Decimal("19200.00")
    assert Decimal(str(data["service_fee_generated"])) == Decimal("800.00")
    assert Decimal(str(data["reimbursements_generated"])) == Decimal("1500.00")
    assert Decimal(str(data["deductions_generated"])) == Decimal("500.00")
    assert Decimal(str(data["total_payout_generated"])) == Decimal("20200.00")
    assert Decimal(str(data["outstanding_settlement_liability"])) == Decimal("20200.00")

    app.dependency_overrides.clear()

@pytest.mark.anyio
async def test_booking_without_invoice_or_settlement_ledger(async_client, admin_user):
    """
    Scenario:
    A booking exists in the period without invoice or trip settlement.
    Ledger must render safely with None / ₹0 defaults without throwing runtime error.
    """
    from app.api.deps import get_current_admin
    from app.main import app
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    company = CustomerCompany(name="Uninvoiced Client", billing_address="Delhi")
    await company.insert()

    booking = DeliveryRequest(
        request_number="REQ-UNINVOICED-001",
        customer_company_id=company.id,
        goods_type="Electronics",
        goods_description="Monitors",
        weight_tons=3.5,
        pickup_company_name="Delhi Hub",
        pickup_address="Okhla Phase 1",
        destination_company_name="Noida Hub",
        destination_address="Sector 62, Noida",
        distance_km=Decimal("35.00"),
        status=DeliveryRequestStatus.SUBMITTED,
        created_at=datetime(2026, 10, 7, 5, 0),
        updated_at=datetime(2026, 10, 7, 5, 0)
    )
    await booking.insert()

    res = await async_client.get("/api/v1/admin/finance/reports/bookings?period=weekly&reference_date=2026-10-07")
    assert res.status_code == 200
    bookings_data = res.json()["bookings"]
    found = next((b for b in bookings_data if b["request_number"] == "REQ-UNINVOICED-001"), None)
    assert found is not None
    assert found["invoice_number"] is None
    assert found["invoice_total"] is None
    assert found["settlement_status"] is None
    assert Decimal(str(found["approved_trip_expenses"])) == Decimal("0.00")

    # Check 360 view
    res_360 = await async_client.get(f"/api/v1/admin/finance/reports/bookings/{booking.id}")
    assert res_360.status_code == 200
    b360 = res_360.json()
    assert b360["invoice_id"] is None
    assert len(b360["expenses"]) == 0

    app.dependency_overrides.clear()
