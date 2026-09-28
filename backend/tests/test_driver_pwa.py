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
async def driver_user_a():
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver_a_{uid}",
        email=f"driver_a_{uid}@cargox.com",
        role=UserRole.DRIVER,
        is_active=True
    )
    await user.insert()
    return user

@pytest.fixture
async def driver_user_b():
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver_b_{uid}",
        email=f"driver_b_{uid}@cargox.com",
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
async def driver_profile_a(driver_user_a):
    d = Driver(
        id=uuid.uuid4(),
        user_id=driver_user_a.id,
        name="Driver Alpha",
        phone="9876543210",
        license_number=f"DL-{uuid.uuid4().hex[:6].upper()}",
        email=driver_user_a.email,
        aadhaar_number="123456789012",
        age=30,
        status=DriverStatus.AVAILABLE
    )
    await d.insert()
    return d

@pytest.fixture
async def driver_profile_b(driver_user_b):
    d = Driver(
        id=uuid.uuid4(),
        user_id=driver_user_b.id,
        name="Driver Beta",
        phone="9876543211",
        license_number=f"DL-{uuid.uuid4().hex[:6].upper()}",
        email=driver_user_b.email,
        aadhaar_number="123456789013",
        age=35,
        status=DriverStatus.AVAILABLE
    )
    await d.insert()
    return d

@pytest.fixture
async def vehicle_1():
    v = Vehicle(
        id=uuid.uuid4(),
        registration_number=f"MH-{uuid.uuid4().hex[:4].upper()}-9999",
        type=VehicleType.CONTAINER,
        capacity_tons=10.0,
        status=VehicleStatus.AVAILABLE
    )
    await v.insert()
    return v

@pytest.fixture
async def dispatched_trip_driver_a(customer_user, driver_profile_a, vehicle_1):
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
    
    # Quotation is often required by invariants
    q = Quotation(
        request_id=req.id,
        pricing_config_id=uuid.uuid4(),
        distance_km=Decimal("150.0"),
        base_rate_per_km=Decimal("50.0"),
        internal_base_cost=Decimal("7500.0"),
        cargox_margin=Decimal("1500.0"),
        customer_total_charge=Decimal("9000.0"),
        status=QuotationStatus.ACCEPTED,
        created_at=now,
        accepted_at=now,
        expires_at=now
    )
    await q.insert()

    trip = Trip(
        id=uuid.uuid4(),
        request_id=req.id,
        assigned_at=now
    )
    await trip.insert()

    assignment = VehicleAssignment(
        id=uuid.uuid4(),
        trip_id=trip.id,
        vehicle_id=vehicle_1.id,
        driver_id=driver_profile_a.id,
        assigned_at=now,
        released_at=None
    )
    await assignment.insert()

    vehicle_1.status = VehicleStatus.ASSIGNED
    driver_profile_a.status = DriverStatus.ON_TRIP
    await vehicle_1.save()
    await driver_profile_a.save()

    return trip

# ----------------------------------------------------------------------
# TESTS
# ----------------------------------------------------------------------

@pytest.mark.anyio
async def test_driver_get_active_trip_success(async_client: AsyncClient, driver_user_a, driver_profile_a, dispatched_trip_driver_a):
    app.dependency_overrides[get_current_driver] = lambda: driver_user_a

    resp = await async_client.get("/api/v1/driver/trips/active")
    assert resp.status_code == 200
    data = resp.json()

    assert data["trip_id"] == str(dispatched_trip_driver_a.id)
    assert data["status"] == "DRIVER_ASSIGNED"
    assert "internal_base_cost" not in data
    assert "cargox_margin" not in data

@pytest.mark.anyio
async def test_unassigned_driver_get_active_trip_404(async_client: AsyncClient, driver_user_b, driver_profile_b):
    app.dependency_overrides[get_current_driver] = lambda: driver_user_b

    resp = await async_client.get("/api/v1/driver/trips/active")
    assert resp.status_code == 404
    assert "no active trip assigned" in resp.json()["detail"].lower()

@pytest.mark.anyio
async def test_cross_driver_trip_access_idor_protection(async_client: AsyncClient, driver_user_b, driver_profile_b, dispatched_trip_driver_a):
    # Driver B attempts to call start-pickup on Driver A's trip -> 404 Not Found
    app.dependency_overrides[get_current_driver] = lambda: driver_user_b

    resp = await async_client.post(f"/api/v1/driver/trips/{dispatched_trip_driver_a.id}/start-pickup")
    assert resp.status_code == 404

@pytest.mark.anyio
async def test_customer_user_cannot_access_driver_routes(async_client: AsyncClient, customer_user):
    resp = await async_client.get("/api/v1/driver/trips/active")
    assert resp.status_code in [401, 403]

@pytest.mark.anyio
async def test_trip_execution_state_flow_and_idempotency(async_client: AsyncClient, driver_user_a, driver_profile_a, dispatched_trip_driver_a):
    app.dependency_overrides[get_current_driver] = lambda: driver_user_a

    trip_id = str(dispatched_trip_driver_a.id)

    # 1. Start Pickup: DRIVER_ASSIGNED -> PICKUP_IN_PROGRESS
    r1 = await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    assert r1.status_code == 200
    assert r1.json()["status"] == "PICKUP_IN_PROGRESS"
    assert r1.json()["pickup_started_at"] is not None
    orig_pickup_time = r1.json()["pickup_started_at"]

    # 1b. Idempotency test: Retry start pickup -> returns 200 OK without re-mutating timestamp
    r1_retry = await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    assert r1_retry.status_code == 200
    assert r1_retry.json()["pickup_started_at"] == orig_pickup_time

    # 2. Start Transit: PICKUP_IN_PROGRESS -> IN_TRANSIT
    r2 = await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-transit")
    assert r2.status_code == 200
    assert r2.json()["status"] == "IN_TRANSIT"
    assert r2.json()["started_at"] is not None

    # 3. Arrive: IN_TRANSIT -> ARRIVED
    r3 = await async_client.post(f"/api/v1/driver/trips/{trip_id}/arrive")
    assert r3.status_code == 200
    assert r3.json()["status"] == "ARRIVED"
    assert r3.json()["arrived_at"] is not None

@pytest.mark.anyio
async def test_out_of_order_state_transition_rejected(async_client: AsyncClient, driver_user_a, driver_profile_a, dispatched_trip_driver_a):
    app.dependency_overrides[get_current_driver] = lambda: driver_user_a

    trip_id = str(dispatched_trip_driver_a.id)

    # Currently DRIVER_ASSIGNED: Attempting to call arrive directly -> 400 Bad Request
    resp = await async_client.post(f"/api/v1/driver/trips/{trip_id}/arrive")
    assert resp.status_code == 400
    assert "cannot mark arrived" in resp.json()["detail"].lower()

@pytest.mark.anyio
async def test_gps_location_update_success(async_client: AsyncClient, driver_user_a, driver_profile_a, dispatched_trip_driver_a):
    app.dependency_overrides[get_current_driver] = lambda: driver_user_a

    trip_id = str(dispatched_trip_driver_a.id)
    resp = await async_client.post(f"/api/v1/driver/trips/{trip_id}/location", json={
        "lat": 19.0760,
        "lng": 72.8777
    })
    assert resp.status_code == 200
    assert resp.json()["current_lat"] == 19.0760

    # Verify DB update
    updated_trip = await Trip.get(dispatched_trip_driver_a.id)
    assert updated_trip.current_lat == 19.0760
    assert updated_trip.current_lng == 72.8777

@pytest.mark.anyio
async def test_gps_location_validation_bounds(async_client: AsyncClient, driver_user_a, driver_profile_a, dispatched_trip_driver_a):
    app.dependency_overrides[get_current_driver] = lambda: driver_user_a

    trip_id = str(dispatched_trip_driver_a.id)
    # Invalid lat > 90.0
    resp = await async_client.post(f"/api/v1/driver/trips/{trip_id}/location", json={
        "lat": 95.0,
        "lng": 72.8777
    })
    assert resp.status_code == 422

@pytest.mark.anyio
async def test_phase5_reassignment_releases_driver_a(async_client: AsyncClient, admin_user, driver_user_a, driver_user_b, driver_profile_a, driver_profile_b, vehicle_1, dispatched_trip_driver_a):
    # Driver A initially assigned to trip
    trip_id = str(dispatched_trip_driver_a.id)

    # Admin reassigns trip to Driver B (Phase 5 endpoint)
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    req = await DeliveryRequest.find_one(DeliveryRequest.id == dispatched_trip_driver_a.request_id)
    req_id = req.id
    
    reassign_resp = await async_client.put(f"/api/v1/admin/requests/{req_id}/reassign", json={
        "vehicle_id": str(vehicle_1.id),
        "driver_id": str(driver_profile_b.id)
    })
    assert reassign_resp.status_code == 200

    # Driver A attempts to call start-pickup -> 404 Not Found (assignment released_at is set)
    app.dependency_overrides[get_current_driver] = lambda: driver_user_a
    resp_a = await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    assert resp_a.status_code == 404

    # Driver B attempts to call start-pickup -> 200 OK
    app.dependency_overrides[get_current_driver] = lambda: driver_user_b
    resp_b = await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    assert resp_b.status_code == 200
    assert resp_b.json()["status"] == "PICKUP_IN_PROGRESS"
