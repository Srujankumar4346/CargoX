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
async def driver_user_1():
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver1_{uid}",
        email=f"driver1_{uid}@cargox.com",
        role=UserRole.DRIVER,
        is_active=True
    )
    await user.insert()
    return user

@pytest.fixture
async def driver_user_2():
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver2_{uid}",
        email=f"driver2_{uid}@cargox.com",
        role=UserRole.DRIVER,
        is_active=True
    )
    await user.insert()
    return user

@pytest.fixture
async def inactive_driver_user():
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver_inact_{uid}",
        email=f"driver_inact_{uid}@cargox.com",
        role=UserRole.DRIVER,
        is_active=False
    )
    await user.insert()
    return user

@pytest.fixture
async def customer_company():
    company = CustomerCompany(
        id=uuid.uuid4(),
        name=f"Company {uuid.uuid4().hex[:6]}",
        billing_address="123 Corporate Way, Mumbai",
        status=CompanyStatus.ACTIVE
    )
    await company.insert()
    return company

@pytest.fixture
async def customer_user(customer_company):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_cust_{uid}",
        email=f"cust_{uid}@company.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=customer_company.id,
        is_active=True
    )
    await user.insert()
    return user

@pytest.fixture
async def vehicle_container_10t():
    v = Vehicle(
        id=uuid.uuid4(),
        registration_number=f"MH-{uuid.uuid4().hex[:4].upper()}-1001",
        type=VehicleType.CONTAINER,
        capacity_tons=10.0,
        status=VehicleStatus.AVAILABLE
    )
    await v.insert()
    return v

@pytest.fixture
async def vehicle_container_5t():
    v = Vehicle(
        id=uuid.uuid4(),
        registration_number=f"MH-{uuid.uuid4().hex[:4].upper()}-5005",
        type=VehicleType.CONTAINER,
        capacity_tons=5.0,
        status=VehicleStatus.AVAILABLE
    )
    await v.insert()
    return v

@pytest.fixture
async def driver_profile_1(driver_user_1):
    d = Driver(
        id=uuid.uuid4(),
        user_id=driver_user_1.id,
        name="John Driver",
        phone="9876543210",
        license_number=f"DL-{uuid.uuid4().hex[:6].upper()}",
        email=driver_user_1.email,
        aadhaar_number="123456789012",
        age=30,
        status=DriverStatus.AVAILABLE
    )
    await d.insert()
    return d

@pytest.fixture
async def driver_profile_2(driver_user_2):
    d = Driver(
        id=uuid.uuid4(),
        user_id=driver_user_2.id,
        name="Sam Driver",
        phone="9876543211",
        license_number=f"DL-{uuid.uuid4().hex[:6].upper()}",
        email=driver_user_2.email,
        aadhaar_number="123456789013",
        age=35,
        status=DriverStatus.AVAILABLE
    )
    await d.insert()
    return d

@pytest.fixture
async def accepted_delivery_request(customer_company):
    now = datetime.now(timezone.utc)
    req = DeliveryRequest(
        id=uuid.uuid4(),
        request_number=f"REQ-{uuid.uuid4().hex[:6].upper()}",
        customer_company_id=customer_company.id,
        pickup_company_name="Sender Co",
        pickup_address="123 Alpha St, Mumbai",
        destination_company_name="Receiver Co",
        destination_address="456 Beta St, Pune",
        goods_type="ELECTRONICS",
        weight_tons=8.0,
        distance_km=150.0,
        status=DeliveryRequestStatus.ACCEPTED,
        created_at=now,
        updated_at=now
    )
    await req.insert()
    
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
    
    return req

# ----------------------------------------------------------------------
# FLEET MANAGEMENT TESTS
# ----------------------------------------------------------------------

@pytest.mark.anyio
async def test_admin_create_vehicle(async_client: AsyncClient, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    reg_no = f"MH12-{uuid.uuid4().hex[:4].upper()}"
    resp = await async_client.post("/api/v1/admin/vehicles", json={
        "registration_number": reg_no,
        "type": "CONTAINER",
        "capacity_tons": "12.5"
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["registration_number"] == reg_no
    assert data["status"] == "AVAILABLE"
    assert Decimal(str(data["capacity_tons"])) == Decimal("12.5")

@pytest.mark.anyio
async def test_admin_create_duplicate_vehicle_rejected(async_client: AsyncClient, admin_user, vehicle_container_10t):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    resp = await async_client.post("/api/v1/admin/vehicles", json={
        "registration_number": vehicle_container_10t.registration_number,
        "type": "CONTAINER",
        "capacity_tons": "10.0"
    })
    assert resp.status_code == 409

@pytest.mark.anyio
async def test_non_admin_fleet_creation_blocked(async_client: AsyncClient, customer_user):
    # Without override for get_current_admin, OAuth2 Password bearer rejects or 401/403
    resp = await async_client.post("/api/v1/admin/vehicles", json={
        "registration_number": "MH12AB1234",
        "type": "CONTAINER",
        "capacity_tons": "10.0"
    })
    assert resp.status_code in [401, 403]

@pytest.mark.anyio
async def test_admin_create_driver_success(async_client: AsyncClient, admin_user, driver_user_1):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    lic_no = f"DL-{uuid.uuid4().hex[:6].upper()}"
    resp = await async_client.post("/api/v1/admin/drivers", json={
        "user_id": str(driver_user_1.id),
        "name": "John Driver",
        "phone": "9876543210",
        "license_number": lic_no,
        "email": driver_user_1.email,
        "aadhaar_number": "123456789012",
        "age": 30
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "John Driver"
    assert data["status"] == "AVAILABLE"

# ----------------------------------------------------------------------
# DISPATCH WORKFLOW TESTS
# ----------------------------------------------------------------------

@pytest.mark.anyio
async def test_dispatch_request_success(async_client: AsyncClient, admin_user, accepted_delivery_request, vehicle_container_10t, driver_profile_1):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    resp = await async_client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_profile_1.id)
    })
    assert resp.status_code == 201
    data = resp.json()

    assert data["request_status"] == "DRIVER_ASSIGNED"
    assert data["vehicle_id"] == str(vehicle_container_10t.id)
    assert data["driver_id"] == str(driver_profile_1.id)

    # Verify resource status transitions
    req = await DeliveryRequest.get(accepted_delivery_request.id)
    veh = await Vehicle.get(vehicle_container_10t.id)
    driv = await Driver.get(driver_profile_1.id)

    assert req.status == DeliveryRequestStatus.DRIVER_ASSIGNED
    assert veh.status == VehicleStatus.ASSIGNED
    assert driv.status == DriverStatus.ON_TRIP

@pytest.mark.anyio
async def test_dispatch_invalid_request_status_rejected(async_client: AsyncClient, admin_user, accepted_delivery_request, vehicle_container_10t, driver_profile_1):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    # Set request status to SUBMITTED
    accepted_delivery_request.status = DeliveryRequestStatus.SUBMITTED
    await accepted_delivery_request.save()

    resp = await async_client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_profile_1.id)
    })
    assert resp.status_code == 400
    assert "must be in ACCEPTED status" in resp.json()["detail"]

@pytest.mark.anyio
async def test_dispatch_insufficient_capacity_rejected(async_client: AsyncClient, admin_user, accepted_delivery_request, vehicle_container_5t, driver_profile_1):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    resp = await async_client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_5t.id),
        "driver_id": str(driver_profile_1.id)
    })
    assert resp.status_code == 400
    assert "insufficient" in resp.json()["detail"].lower()

@pytest.mark.anyio
async def test_dispatch_unavailable_vehicle_rejected(async_client: AsyncClient, admin_user, accepted_delivery_request, vehicle_container_10t, driver_profile_1):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    # Set vehicle status to MAINTENANCE
    vehicle_container_10t.status = VehicleStatus.MAINTENANCE
    await vehicle_container_10t.save()

    resp = await async_client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_profile_1.id)
    })
    assert resp.status_code == 409
    assert "unavailable" in resp.json()["detail"].lower()

@pytest.mark.anyio
async def test_dispatch_unavailable_driver_rejected(async_client: AsyncClient, admin_user, accepted_delivery_request, vehicle_container_10t, driver_user_1):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    driver_unavail = Driver(
        id=uuid.uuid4(),
        user_id=driver_user_1.id,
        name="Unavailable Driver",
        phone="9000000000",
        license_number=f"DL-UNAVAIL-{uuid.uuid4().hex[:6].upper()}",
        email=driver_user_1.email,
        aadhaar_number="123456789014",
        age=40,
        status=DriverStatus.ON_TRIP
    )
    await driver_unavail.insert()

    resp = await async_client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_unavail.id)
    })
    assert resp.status_code == 409
    assert "unavailable" in resp.json()["detail"].lower()

@pytest.mark.anyio
async def test_duplicate_dispatch_rejected(async_client: AsyncClient, admin_user, accepted_delivery_request, vehicle_container_10t, driver_profile_1, driver_profile_2):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    # First dispatch
    await async_client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_profile_1.id)
    })

    # Reset request status to ACCEPTED manually to simulate race condition / duplicate dispatch attempt
    accepted_delivery_request = await DeliveryRequest.get(accepted_delivery_request.id)
    accepted_delivery_request.status = DeliveryRequestStatus.ACCEPTED
    await accepted_delivery_request.save()

    # Second dispatch attempt when trip already exists
    resp = await async_client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_profile_2.id)
    })
    assert resp.status_code == 409
    assert "already been dispatched" in resp.json()["detail"].lower()

@pytest.mark.anyio
async def test_reassign_dispatch_success(async_client: AsyncClient, admin_user, accepted_delivery_request, vehicle_container_10t, vehicle_container_5t, driver_profile_1, driver_profile_2):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    # 1. Initial Dispatch
    await async_client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_profile_1.id)
    })

    # Make vehicle_container_5t 10t for capacity check in reassignment
    veh_5t = await Vehicle.get(vehicle_container_5t.id)
    veh_5t.capacity_tons = 10.0
    await veh_5t.save()

    # 2. Reassign to vehicle 2 and driver 2
    resp_reassign = await async_client.put(f"/api/v1/admin/requests/{accepted_delivery_request.id}/reassign", json={
        "vehicle_id": str(vehicle_container_5t.id),
        "driver_id": str(driver_profile_2.id)
    })
    assert resp_reassign.status_code == 200
    data = resp_reassign.json()
    assert data["vehicle_id"] == str(vehicle_container_5t.id)
    assert data["driver_id"] == str(driver_profile_2.id)

    # Check previous vehicle and driver returned to AVAILABLE
    veh_10t = await Vehicle.get(vehicle_container_10t.id)
    driv_1 = await Driver.get(driver_profile_1.id)
    assert veh_10t.status == VehicleStatus.AVAILABLE
    assert driv_1.status == DriverStatus.AVAILABLE

    # Check new vehicle and driver assigned
    veh_5t = await Vehicle.get(vehicle_container_5t.id)
    driv_2 = await Driver.get(driver_profile_2.id)
    assert veh_5t.status == VehicleStatus.ASSIGNED
    assert driv_2.status == DriverStatus.ON_TRIP

    # Check VehicleAssignment audit history (2 assignments exist under same Trip, 1 released, 1 active)
    trip = await Trip.find_one(Trip.request_id == accepted_delivery_request.id)
    assignments = await VehicleAssignment.find(VehicleAssignment.trip_id == trip.id).to_list()
    assert len(assignments) == 2
    released_assignments = [a for a in assignments if a.released_at is not None]
    active_assignments = [a for a in assignments if a.released_at is None]
    assert len(released_assignments) == 1
    assert len(active_assignments) == 1
    assert released_assignments[0].vehicle_id == vehicle_container_10t.id
    assert active_assignments[0].vehicle_id == vehicle_container_5t.id

@pytest.mark.anyio
async def test_reassign_started_trip_rejected(async_client: AsyncClient, admin_user, accepted_delivery_request, vehicle_container_10t, vehicle_container_5t, driver_profile_1, driver_profile_2):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    # Dispatch
    await async_client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_profile_1.id)
    })

    # Simulate trip started
    trip = await Trip.find_one(Trip.request_id == accepted_delivery_request.id)
    trip.started_at = datetime.now(timezone.utc)
    await trip.save()

    # Reassign attempt should fail with 400
    resp = await async_client.put(f"/api/v1/admin/requests/{accepted_delivery_request.id}/reassign", json={
        "vehicle_id": str(vehicle_container_5t.id),
        "driver_id": str(driver_profile_2.id)
    })
    assert resp.status_code == 400
    assert "already started" in resp.json()["detail"].lower()
