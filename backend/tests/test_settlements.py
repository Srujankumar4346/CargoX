import pytest
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from app.models.enums import UserRole, DeliveryRequestStatus, ExpensePayer, ExpenseCategory, ExpenseStatus, SettlementStatus, QuotationStatus
from app.models.user import User
from app.models.company import CustomerCompany
from app.models.fleet import Driver, VehicleAssignment, Vehicle
from app.models.delivery import DeliveryRequest, Trip
from app.models.operations import TripExpense
from app.models.pricing import Quotation, PricingConfig
from app.models.finance import DriverSettlement
from app.models.settings import SystemSettings
from app.services.settlement_service import SettlementService

@pytest.fixture
async def setup_data():
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    admin = User(id=uuid.uuid4(), email="admin@cargox.com", role=UserRole.ADMIN, is_active=True, clerk_user_id="clerk1")
    await admin.insert()

    settings = SystemSettings(cargox_service_fee_percentage=Decimal('4.00'), updated_at=now, updated_by=admin.id)
    await settings.insert()

    company = CustomerCompany(id=uuid.uuid4(), name="Test Corp", billing_address="Addr", status="ACTIVE")
    await company.insert()

    driver_user = User(id=uuid.uuid4(), email="driver@cargox.com", role=UserRole.DRIVER, is_active=True, clerk_user_id="clerk2")
    await driver_user.insert()

    driver = Driver(
        id=uuid.uuid4(), 
        user_id=driver_user.id, 
        name="Test Driver", 
        phone="123", 
        license_number="DL1",
        email="driver@cargox.com",
        aadhaar_number="123412341234",
        age=30
    )
    await driver.insert()

    veh = Vehicle(id=uuid.uuid4(), registration_number="V1", type="OPEN", capacity_tons=10, status="AVAILABLE")
    await veh.insert()

    config = PricingConfig(id=uuid.uuid4(), base_rate_per_km=Decimal("20.00"), margin_per_km=Decimal("5.00"), effective_from=now, active=True, created_by=admin.id, created_at=now)
    await config.insert()

    req = DeliveryRequest(
        id=uuid.uuid4(),
        request_number="REQ-1",
        customer_company_id=company.id,
        goods_type="TEST",
        weight_tons=1.0,
        pickup_company_name="A", pickup_address="A",
        destination_company_name="B", destination_address="B",
        distance_km=100.0,
        status=DeliveryRequestStatus.COMPLETED,
        created_at=now, updated_at=now
    )
    await req.insert()

    # quotation total = 100 * (20 + 5) = 2500
    # Customer Amount = 2500, wait user prompt says test with 10000. Let's make distance 400.
    req.distance_km = 400.0
    await req.save()
    
    # 400 * 25 = 10000
    quotation = Quotation(
        id=uuid.uuid4(),
        request_id=req.id,
        pricing_config_id=config.id,
        distance_km=Decimal("400.0"),
        base_rate_per_km=Decimal("20.00"),
        internal_base_cost=Decimal("8000.00"),
        cargox_margin=Decimal("2000.00"),
        customer_total_charge=Decimal("10000.00"),
        service_fee_percentage=Decimal("4.00"),
        service_fee_amount=Decimal("400.00"),
        driver_payable_amount=Decimal("9600.00"),
        status=QuotationStatus.ACCEPTED,
        created_at=now, accepted_at=now, expires_at=now + timedelta(days=30)
    )
    await quotation.insert()

    trip = Trip(id=uuid.uuid4(), request_id=req.id, assigned_at=now, completed_at=now)
    await trip.insert()

    assignment = VehicleAssignment(id=uuid.uuid4(), trip_id=trip.id, vehicle_id=veh.id, driver_id=driver.id, assigned_at=now)
    await assignment.insert()

    return {
        "admin": admin,
        "driver": driver,
        "req": req,
        "quotation": quotation,
        "trip": trip
    }

@pytest.mark.anyio
async def test_settlement_immutable_allocation_and_payout(setup_data):
    # Setup data generates a 10000 customer amount, 400 fee, 9600 driver payable.
    admin = setup_data["admin"]
    driver = setup_data["driver"]
    trip = setup_data["trip"]

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    exp1 = TripExpense(trip_id=trip.id, amount=Decimal("500.00"), category=ExpenseCategory.TOLL, status=ExpenseStatus.APPROVED, date=now, paid_by=ExpensePayer.DRIVER, recorded_by=admin.id)
    await exp1.insert()

    # Create settlement
    s = await SettlementService.generate_settlement(
        admin_user=admin,
        driver_id=driver.id,
        period_start=now - timedelta(days=1),
        period_end=now + timedelta(days=1),
        base_pay=None,
        deductions=Decimal("100.00"),
        deduction_reason="Penalty"
    )

    # total payout should be 9600 + 500 - 100 = 10000
    assert s.total_payout == Decimal("10000.00")
    assert s.driver_payable_amount == Decimal("9600.00")
    assert s.service_fee_amount == Decimal("400.00")
    assert s.customer_amount == Decimal("10000.00")
    assert s.reimbursements == Decimal("500.00")
    assert s.deductions == Decimal("100.00")
    
@pytest.mark.anyio
async def test_change_system_settings_does_not_change_settlement(setup_data):
    admin = setup_data["admin"]
    driver = setup_data["driver"]
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Change system setting to 3%
    settings = await SystemSettings.find_one()
    settings.cargox_service_fee_percentage = Decimal("3.00")
    await settings.save()

    s = await SettlementService.generate_settlement(
        admin_user=admin,
        driver_id=driver.id,
        period_start=now - timedelta(days=1),
        period_end=now + timedelta(days=1),
        base_pay=None,
        deductions=Decimal("0.00")
    )
    # the quotation snapshot is 4%, 400, 9600. changing settings should NOT change existing quotation allocation
    assert s.service_fee_amount == Decimal("400.00")
    assert s.driver_payable_amount == Decimal("9600.00")
    assert s.total_payout == Decimal("9600.00")

@pytest.mark.anyio
async def test_missing_historical_allocation_causes_safe_stop(setup_data):
    admin = setup_data["admin"]
    driver = setup_data["driver"]
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    quote = setup_data["quotation"]
    quote.driver_payable_amount = None
    await quote.save()

    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        await SettlementService.generate_settlement(
            admin_user=admin, driver_id=driver.id,
            period_start=now - timedelta(days=1), period_end=now + timedelta(days=1),
            base_pay=None, deductions=Decimal("0.00")
        )
    assert exc.value.status_code == 400
    assert "no immutable financial allocation snapshot" in exc.value.detail

@pytest.mark.anyio
async def test_existing_historical_settlements_unchanged(setup_data):
    # Verify legacy base_pay behavior
    admin = setup_data["admin"]
    driver = setup_data["driver"]
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    s = DriverSettlement(
        driver_id=driver.id,
        period_start=now, period_end=now,
        base_pay=Decimal("5000.00"),
        reimbursements=Decimal("0.00"),
        deductions=Decimal("0.00"),
        total_payout=Decimal("5000.00"),
        status=SettlementStatus.DRAFT,
        generated_by=admin.id
    )
    await s.insert()

    # Update settlement
    s_updated = await SettlementService.update_settlement(settlement_id=s.id, base_pay=Decimal("5500.00"))
    
    assert s_updated.base_pay == Decimal("5500.00")
    assert s_updated.total_payout == Decimal("5500.00")
