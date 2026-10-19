import pytest
from httpx import AsyncClient
from datetime import datetime, timezone
from decimal import Decimal
import uuid

from app.main import app
from app.api.deps import get_current_admin, get_current_customer_user
from app.models.user import User
from app.models.company import CustomerCompany, RecipientCompany
from app.models.delivery import DeliveryRequest, Trip, TripStop
from app.models.fleet import Vehicle, Driver
from app.models.pricing import PricingConfig, Quotation
from app.models.enums import UserRole, CompanyStatus, DeliveryRequestStatus, QuotationStatus, VehicleStatus, DriverStatus

@pytest.fixture(autouse=True)
def cleanup_database():
    yield
    app.dependency_overrides.clear()

@pytest.fixture
async def admin_user():
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_admin_{uid}",
        email=f"admin_{uid}@cargox.com",
        role=UserRole.ADMIN,
        is_active=True
    )
    await user.insert()
    return user

@pytest.fixture
async def customer_company_a():
    company = CustomerCompany(
        id=uuid.uuid4(),
        name=f"Company A {uuid.uuid4().hex[:6]}",
        billing_address="123 Alpha St, Hyderabad",
        status=CompanyStatus.ACTIVE
    )
    await company.insert()
    return company

@pytest.fixture
async def customer_company_b():
    company = CustomerCompany(
        id=uuid.uuid4(),
        name=f"Company B {uuid.uuid4().hex[:6]}",
        billing_address="456 Beta St, Hyderabad",
        status=CompanyStatus.ACTIVE
    )
    await company.insert()
    return company

@pytest.fixture
async def recipient_a(customer_company_a):
    rec = RecipientCompany(
        id=uuid.uuid4(),
        customer_company_id=customer_company_a.id,
        name="Recipient Warangal",
        phone="9876543210",
        address="Warangal Industrial Area, Warangal"
    )
    await rec.insert()
    return rec

@pytest.fixture
async def recipient_b(customer_company_b):
    rec = RecipientCompany(
        id=uuid.uuid4(),
        customer_company_id=customer_company_b.id,
        name="Recipient Vijayawada",
        phone="9876543211",
        address="Autonagar, Vijayawada"
    )
    await rec.insert()
    return rec

@pytest.fixture
async def part_load_pricing_config(admin_user):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    config = PricingConfig(
        id=uuid.uuid4(),
        base_rate_per_km=Decimal("15.00"),
        margin_per_km=Decimal("2.00"),
        part_load_min_freight=Decimal("350.00"),
        part_load_base_weight_kg=Decimal("250.00"),
        part_load_rate_per_kg=Decimal("7.00"),
        part_load_rate_per_km=Decimal("12.00"),
        part_load_volumetric_ratio=Decimal("5000.00"),
        active=True,
        created_by=admin_user.id,
        created_at=now
    )
    await config.insert()
    return config

@pytest.fixture
async def test_fleet(admin_user):
    v = Vehicle(
        id=uuid.uuid4(),
        registration_number=f"TS09-PL-{uuid.uuid4().hex[:4].upper()}",
        type="14ft Truck",
        capacity_tons=3.5,
        status=VehicleStatus.AVAILABLE
    )
    await v.insert()

    d = Driver(
        id=uuid.uuid4(),
        name="Ramesh Kumar",
        phone="9848022338",
        license_number="DL-TS-2022-8819",
        status=DriverStatus.AVAILABLE
    )
    await d.insert()
    return v, d

@pytest.mark.anyio
async def test_consolidated_dispatch_workflow(async_client: AsyncClient, admin_user, customer_company_a, customer_company_b, recipient_a, recipient_b, part_load_pricing_config, test_fleet):
    """
    End-to-End Test for Part Load Consolidation:
    1. Customer A submits 400 kg order (Hyderabad -> Warangal)
    2. Customer B submits 600 kg order (Hyderabad -> Vijayawada)
    3. Admin consolidates both onto 1 shared vehicle
    4. Verify Trip has 2 requests and ordered TripStops
    5. Verify payload rejection if total weight exceeds vehicle capacity
    """
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    vehicle, driver = test_fleet
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    req_a = DeliveryRequest(
        id=uuid.uuid4(),
        request_number=f"REQ-PL-A-{uuid.uuid4().hex[:4].upper()}",
        customer_company_id=customer_company_a.id,
        recipient_company_id=recipient_a.id,
        pickup_company_name="Sender Hyderabad A",
        pickup_address="Sanathnagar, Hyderabad",
        destination_company_name=recipient_a.name,
        destination_address=recipient_a.address,
        goods_type="PARTS",
        weight_tons=0.400,
        load_type="PART_LOAD",
        distance_km=145.0,
        status=DeliveryRequestStatus.ACCEPTED,
        created_at=now,
        updated_at=now
    )
    await req_a.insert()

    req_b = DeliveryRequest(
        id=uuid.uuid4(),
        request_number=f"REQ-PL-B-{uuid.uuid4().hex[:4].upper()}",
        customer_company_id=customer_company_b.id,
        recipient_company_id=recipient_b.id,
        pickup_company_name="Sender Hyderabad B",
        pickup_address="Cherlapally, Hyderabad",
        destination_company_name=recipient_b.name,
        destination_address=recipient_b.address,
        goods_type="ELECTRONICS",
        weight_tons=0.600,
        load_type="PART_LOAD",
        distance_km=275.0,
        status=DeliveryRequestStatus.ACCEPTED,
        created_at=now,
        updated_at=now
    )
    await req_b.insert()

    # 1. Attempt Dispatch with consolidated endpoint
    resp = await async_client.post("/api/v1/admin/dispatch/consolidated", json={
        "request_ids": [str(req_a.id), str(req_b.id)],
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "commission_percentage": 15.0
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["trip_type"] == "CONSOLIDATED_PART_LOAD"
    assert data["request_count"] == 2
    assert data["total_weight_tons"] == 1.0  # 0.4 + 0.6 tons
    assert len(data["stops"]) == 4  # 2 pickups + 2 drops

    # 2. Verify requests updated to DRIVER_ASSIGNED
    db_req_a = await DeliveryRequest.get(req_a.id)
    assert db_req_a.status == DeliveryRequestStatus.DRIVER_ASSIGNED

    # 3. Test vehicle capacity rejection
    # Create overloaded request (4.0 tons > 3.5 tons capacity)
    req_heavy = DeliveryRequest(
        id=uuid.uuid4(),
        request_number=f"REQ-HEAVY-{uuid.uuid4().hex[:4].upper()}",
        customer_company_id=customer_company_a.id,
        recipient_company_id=recipient_a.id,
        pickup_company_name="Heavy Machinery",
        pickup_address="Hyderabad",
        destination_company_name=recipient_a.name,
        destination_address=recipient_a.address,
        goods_type="STEEL",
        weight_tons=4.0,
        load_type="PART_LOAD",
        distance_km=100.0,
        status=DeliveryRequestStatus.ACCEPTED,
        created_at=now,
        updated_at=now
    )
    await req_heavy.insert()

    resp_overload = await async_client.post("/api/v1/admin/dispatch/consolidated", json={
        "request_ids": [str(req_heavy.id)],
        "vehicle_id": str(vehicle.id),
        "driver_id": str(driver.id),
        "commission_percentage": 15.0
    })
    assert resp_overload.status_code == 400
    assert "capacity" in resp_overload.json()["detail"].lower()
