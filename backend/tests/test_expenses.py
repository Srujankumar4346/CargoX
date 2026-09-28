import pytest
from httpx import AsyncClient
from datetime import datetime, timezone
from decimal import Decimal
import uuid

from app.main import app
from app.api.deps import get_current_admin, get_current_customer_user, get_current_driver
from app.models.user import User
from app.models.company import CustomerCompany
from app.models.delivery import DeliveryRequest, Trip
from app.models.fleet import Vehicle, Driver, VehicleAssignment
from app.models.enums import UserRole, CompanyStatus, DeliveryRequestStatus, VehicleType, VehicleStatus, DriverStatus, QuotationStatus
from app.models.pricing import Quotation

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
async def driver_user():
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver_{uid}",
        email=f"driver_{uid}@cargox.com",
        role=UserRole.DRIVER,
        is_active=True
    )
    await user.insert()
    return user

@pytest.fixture
async def customer_user():
    company = CustomerCompany(
        id=uuid.uuid4(),
        name=f"Company {uuid.uuid4().hex[:6]}",
        billing_address="123 Corporate Way, Mumbai",
        status=CompanyStatus.ACTIVE
    )
    await company.insert()

    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_cust_{uid}",
        email=f"cust_{uid}@company.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=company.id,
        is_active=True
    )
    await user.insert()
    return user

@pytest.fixture
async def active_trip(customer_user, driver_user):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    req = DeliveryRequest(
        id=uuid.uuid4(),
        request_number=f"REQ-{uuid.uuid4().hex[:6].upper()}",
        customer_company_id=customer_user.customer_company_id,
        pickup_company_name="Sender Corp",
        pickup_address="123 Alpha St, Mumbai",
        destination_company_name="Receiver Corp",
        destination_address="456 Beta St, Pune",
        goods_type="MACHINERY",
        weight_tons=5.0,
        distance_km=150.0,
        status=DeliveryRequestStatus.DRIVER_ASSIGNED,
        created_at=now,
        updated_at=now
    )
    await req.insert()
    
    trip = Trip(
        id=uuid.uuid4(),
        request_id=req.id,
        assigned_at=now
    )
    await trip.insert()
    
    d = Driver(
        id=uuid.uuid4(),
        user_id=driver_user.id,
        name="Driver Expense",
        phone="9876543210",
        license_number=f"DL-{uuid.uuid4().hex[:6].upper()}",
        email=driver_user.email,
        aadhaar_number="123456789012",
        age=30,
        status=DriverStatus.ON_TRIP
    )
    await d.insert()

    v = Vehicle(
        id=uuid.uuid4(),
        registration_number=f"MH-{uuid.uuid4().hex[:4].upper()}-9999",
        type=VehicleType.CONTAINER,
        capacity_tons=10.0,
        status=VehicleStatus.ASSIGNED
    )
    await v.insert()

    assignment = VehicleAssignment(
        id=uuid.uuid4(),
        trip_id=trip.id,
        vehicle_id=v.id,
        driver_id=d.id,
        assigned_at=now,
        released_at=None
    )
    await assignment.insert()

    return trip

@pytest.mark.anyio
async def test_expense_lifecycle(async_client: AsyncClient, admin_user, customer_user, driver_user, active_trip):
    trip_id = str(active_trip.id)
    
    # Driver submit expense
    app.dependency_overrides[get_current_driver] = lambda: driver_user
    resp1 = await async_client.post(f"/api/v1/driver/trips/{trip_id}/expenses", json={
        "amount": "50.00",
        "category": "FUEL",
        "description": "Initial fuel",
        "receipt_url": "https://example.com/receipt1.png"
    })
    assert resp1.status_code == 200
    expense_id = resp1.json()["id"]
    assert resp1.json()["status"] == "PENDING_APPROVAL"

    # Admin mutate status
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    resp2 = await async_client.patch(f"/api/v1/admin/expenses/{expense_id}/status", json={
        "status": "APPROVED"
    })
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "APPROVED"

    # Cannot mutate approved expense
    resp3 = await async_client.patch(f"/api/v1/admin/expenses/{expense_id}/status", json={
        "status": "REJECTED"
    })
    assert resp3.status_code == 400

    # Admin direct submit -> APPROVED
    resp4 = await async_client.post(f"/api/v1/admin/trips/{trip_id}/expenses", json={
        "amount": "100.00",
        "category": "TOLL"
    })
    assert resp4.status_code == 200
    assert resp4.json()["status"] == "APPROVED"

    # Complete the trip
    req = await DeliveryRequest.find_one(DeliveryRequest.id == active_trip.request_id)
    req.status = DeliveryRequestStatus.COMPLETED
    await req.save()

    # Driver submission on COMPLETED trip should fail
    app.dependency_overrides[get_current_driver] = lambda: driver_user
    resp_driver_completed = await async_client.post(f"/api/v1/driver/trips/{trip_id}/expenses", json={
        "amount": "10.00",
        "category": "OTHER"
    })
    assert resp_driver_completed.status_code == 400

    # Admin submission on COMPLETED trip should succeed
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    resp_admin_completed = await async_client.post(f"/api/v1/admin/trips/{trip_id}/expenses", json={
        "amount": "20.00",
        "category": "OTHER"
    })
    assert resp_admin_completed.status_code == 200
