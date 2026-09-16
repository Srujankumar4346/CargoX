import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import uuid
from sqlalchemy import text

from app.main import app
from app.api.deps import get_current_admin, get_current_customer_user, get_current_driver, get_db
from app.models.user import User
from app.models.company import CustomerCompany, RecipientCompany
from app.models.delivery import DeliveryRequest, Trip
from app.models.fleet import Vehicle, Driver, VehicleAssignment
from app.models.enums import UserRole, CompanyStatus, DeliveryRequestStatus, VehicleType, VehicleStatus, DriverStatus
from app.db.database import SessionLocal

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(autouse=True)
def mock_compliance_service(monkeypatch):
    monkeypatch.setattr("app.services.dispatch_service.ComplianceService.validate_dispatch_eligibility", lambda *args, **kwargs: None)

@pytest.fixture(autouse=True)
def cleanup_database():
    db = SessionLocal()
    yield
    try:
        db.execute(text("DELETE FROM trip_expenses"))
        db.execute(text("DELETE FROM vehicle_maintenance"))
        db.execute(text("DELETE FROM notifications"))
        db.execute(text("DELETE FROM payments"))
        db.execute(text("DELETE FROM invoices"))
        db.execute(text("DELETE FROM location_histories"))
        db.execute(text("DELETE FROM proof_of_deliveries"))
        db.execute(text("DELETE FROM vehicle_assignments"))
        db.execute(text("DELETE FROM trips"))
        db.execute(text("DELETE FROM quotations"))
        db.execute(text("DELETE FROM delivery_requests"))
        db.execute(text("DELETE FROM recipient_companies"))
        db.execute(text("DELETE FROM pricing_configs"))
        db.execute(text("DELETE FROM drivers"))
        db.execute(text("DELETE FROM vehicles"))
        db.execute(text("DELETE FROM users"))
        db.execute(text("DELETE FROM customer_companies"))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
    app.dependency_overrides.clear()

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def admin_user(db_session):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_admin_{uid}",
        email=f"admin_{uid}@cargox.com",
        role=UserRole.ADMIN,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def driver_user_1(db_session):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver1_{uid}",
        email=f"driver1_{uid}@cargox.com",
        role=UserRole.DRIVER,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def driver_user_2(db_session):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver2_{uid}",
        email=f"driver2_{uid}@cargox.com",
        role=UserRole.DRIVER,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def inactive_driver_user(db_session):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver_inact_{uid}",
        email=f"driver_inact_{uid}@cargox.com",
        role=UserRole.DRIVER,
        is_active=False
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def customer_company(db_session):
    company = CustomerCompany(
        id=uuid.uuid4(),
        name=f"Company {uuid.uuid4().hex[:6]}",
        billing_address="123 Corporate Way, Mumbai",
        status=CompanyStatus.ACTIVE
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)
    return company

@pytest.fixture
def customer_user(db_session, customer_company):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_cust_{uid}",
        email=f"cust_{uid}@company.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=customer_company.id,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def vehicle_container_10t(db_session):
    v = Vehicle(
        id=uuid.uuid4(),
        registration_number=f"MH-{uuid.uuid4().hex[:4].upper()}-1001",
        type=VehicleType.CONTAINER,
        capacity_tons=10.0,
        status=VehicleStatus.AVAILABLE
    )
    db_session.add(v)
    db_session.commit()
    db_session.refresh(v)
    return v

@pytest.fixture
def vehicle_container_5t(db_session):
    v = Vehicle(
        id=uuid.uuid4(),
        registration_number=f"MH-{uuid.uuid4().hex[:4].upper()}-5005",
        type=VehicleType.CONTAINER,
        capacity_tons=5.0,
        status=VehicleStatus.AVAILABLE
    )
    db_session.add(v)
    db_session.commit()
    db_session.refresh(v)
    return v

@pytest.fixture
def driver_profile_1(db_session, driver_user_1):
    d = Driver(
        id=uuid.uuid4(),
        user_id=driver_user_1.id,
        name="John Driver",
        phone="9876543210",
        license_number=f"DL-{uuid.uuid4().hex[:6].upper()}",
        status=DriverStatus.AVAILABLE
    )
    db_session.add(d)
    db_session.commit()
    db_session.refresh(d)
    return d

@pytest.fixture
def driver_profile_2(db_session, driver_user_2):
    d = Driver(
        id=uuid.uuid4(),
        user_id=driver_user_2.id,
        name="Sam Driver",
        phone="9876543211",
        license_number=f"DL-{uuid.uuid4().hex[:6].upper()}",
        status=DriverStatus.AVAILABLE
    )
    db_session.add(d)
    db_session.commit()
    db_session.refresh(d)
    return d

@pytest.fixture
def accepted_delivery_request(db_session, customer_company):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
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
    db_session.add(req)
    db_session.commit()
    db_session.refresh(req)
    return req

# ----------------------------------------------------------------------
# FLEET MANAGEMENT TESTS
# ----------------------------------------------------------------------

def test_admin_create_vehicle(client, db_session, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    reg_no = f"MH12-{uuid.uuid4().hex[:4].upper()}"
    resp = client.post("/api/v1/admin/vehicles", json={
        "registration_number": reg_no,
        "type": "CONTAINER",
        "capacity_tons": "12.5"
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["registration_number"] == reg_no
    assert data["status"] == "AVAILABLE"
    assert Decimal(str(data["capacity_tons"])) == Decimal("12.5")

def test_admin_create_duplicate_vehicle_rejected(client, db_session, admin_user, vehicle_container_10t):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    resp = client.post("/api/v1/admin/vehicles", json={
        "registration_number": vehicle_container_10t.registration_number,
        "type": "CONTAINER",
        "capacity_tons": "10.0"
    })
    assert resp.status_code == 409

def test_non_admin_fleet_creation_blocked(client, db_session, customer_user):
    app.dependency_overrides[get_db] = lambda: db_session
    # Without override for get_current_admin, OAuth2 Password bearer rejects or 401/403
    resp = client.post("/api/v1/admin/vehicles", json={
        "registration_number": "MH12AB1234",
        "type": "CONTAINER",
        "capacity_tons": "10.0"
    })
    assert resp.status_code in [401, 403]

def test_admin_create_driver_success(client, db_session, admin_user, driver_user_1):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    lic_no = f"DL-{uuid.uuid4().hex[:6].upper()}"
    resp = client.post("/api/v1/admin/drivers", json={
        "user_id": str(driver_user_1.id),
        "name": "John Driver",
        "phone": "9876543210",
        "license_number": lic_no
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "John Driver"
    assert data["status"] == "AVAILABLE"

# ----------------------------------------------------------------------
# DISPATCH WORKFLOW TESTS
# ----------------------------------------------------------------------

def test_dispatch_request_success(client, db_session, admin_user, accepted_delivery_request, vehicle_container_10t, driver_profile_1):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    resp = client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_profile_1.id)
    })
    assert resp.status_code == 201
    data = resp.json()

    assert data["request_status"] == "DRIVER_ASSIGNED"
    assert data["vehicle_id"] == str(vehicle_container_10t.id)
    assert data["driver_id"] == str(driver_profile_1.id)

    # Verify resource status transitions
    db_session.refresh(accepted_delivery_request)
    db_session.refresh(vehicle_container_10t)
    db_session.refresh(driver_profile_1)

    assert accepted_delivery_request.status == DeliveryRequestStatus.DRIVER_ASSIGNED
    assert vehicle_container_10t.status == VehicleStatus.ASSIGNED
    assert driver_profile_1.status == DriverStatus.ON_TRIP

def test_dispatch_invalid_request_status_rejected(client, db_session, admin_user, accepted_delivery_request, vehicle_container_10t, driver_profile_1):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    # Set request status to SUBMITTED
    accepted_delivery_request.status = DeliveryRequestStatus.SUBMITTED
    db_session.commit()

    resp = client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_profile_1.id)
    })
    assert resp.status_code == 400
    assert "must be in ACCEPTED status" in resp.json()["detail"]

def test_dispatch_insufficient_capacity_rejected(client, db_session, admin_user, accepted_delivery_request, vehicle_container_5t, driver_profile_1):
    # Request weight = 8.0 tons, vehicle capacity = 5.0 tons -> should fail
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    resp = client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_5t.id),
        "driver_id": str(driver_profile_1.id)
    })
    assert resp.status_code == 400
    assert "insufficient" in resp.json()["detail"].lower()

def test_dispatch_unavailable_vehicle_rejected(client, db_session, admin_user, accepted_delivery_request, vehicle_container_10t, driver_profile_1):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    # Set vehicle status to MAINTENANCE
    vehicle_container_10t.status = VehicleStatus.MAINTENANCE
    db_session.commit()

    resp = client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_profile_1.id)
    })
    assert resp.status_code == 409
    assert "unavailable" in resp.json()["detail"].lower()

def test_dispatch_inactive_driver_user_rejected(client, db_session, admin_user, accepted_delivery_request, vehicle_container_10t, inactive_driver_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    driver_inact = Driver(
        id=uuid.uuid4(),
        user_id=inactive_driver_user.id,
        name="Inactive Driver",
        phone="9000000000",
        license_number=f"DL-INACTIVE-{uuid.uuid4().hex[:6].upper()}",
        status=DriverStatus.AVAILABLE
    )
    db_session.add(driver_inact)
    db_session.commit()

    resp = client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_inact.id)
    })
    assert resp.status_code == 409
    assert "inactive" in resp.json()["detail"].lower()

def test_duplicate_dispatch_rejected(client, db_session, admin_user, accepted_delivery_request, vehicle_container_10t, driver_profile_1, driver_profile_2):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    # First dispatch
    client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_profile_1.id)
    })

    # Reset request status to ACCEPTED manually to simulate race condition / duplicate dispatch attempt
    accepted_delivery_request.status = DeliveryRequestStatus.ACCEPTED
    db_session.commit()

    # Second dispatch attempt when trip already exists
    resp = client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_profile_2.id)
    })
    assert resp.status_code == 409
    assert "already been dispatched" in resp.json()["detail"].lower()

def test_reassign_dispatch_success(client, db_session, admin_user, accepted_delivery_request, vehicle_container_10t, vehicle_container_5t, driver_profile_1, driver_profile_2):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    # 1. Initial Dispatch
    client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_profile_1.id)
    })

    # Make vehicle_container_5t 10t for capacity check in reassignment
    vehicle_container_5t.capacity_tons = 10.0
    db_session.commit()

    # 2. Reassign to vehicle 2 and driver 2
    resp_reassign = client.put(f"/api/v1/admin/requests/{accepted_delivery_request.id}/reassign", json={
        "vehicle_id": str(vehicle_container_5t.id),
        "driver_id": str(driver_profile_2.id)
    })
    assert resp_reassign.status_code == 200
    data = resp_reassign.json()
    assert data["vehicle_id"] == str(vehicle_container_5t.id)
    assert data["driver_id"] == str(driver_profile_2.id)

    # Check previous vehicle and driver returned to AVAILABLE
    db_session.refresh(vehicle_container_10t)
    db_session.refresh(driver_profile_1)
    assert vehicle_container_10t.status == VehicleStatus.AVAILABLE
    assert driver_profile_1.status == DriverStatus.AVAILABLE

    # Check new vehicle and driver assigned
    db_session.refresh(vehicle_container_5t)
    db_session.refresh(driver_profile_2)
    assert vehicle_container_5t.status == VehicleStatus.ASSIGNED
    assert driver_profile_2.status == DriverStatus.ON_TRIP

    # Check VehicleAssignment audit history (2 assignments exist under same Trip, 1 released, 1 active)
    trip = db_session.query(Trip).filter(Trip.request_id == accepted_delivery_request.id).first()
    assignments = db_session.query(VehicleAssignment).filter(VehicleAssignment.trip_id == trip.id).all()
    assert len(assignments) == 2
    released_assignments = [a for a in assignments if a.released_at is not None]
    active_assignments = [a for a in assignments if a.released_at is None]
    assert len(released_assignments) == 1
    assert len(active_assignments) == 1
    assert released_assignments[0].vehicle_id == vehicle_container_10t.id
    assert active_assignments[0].vehicle_id == vehicle_container_5t.id

def test_reassign_started_trip_rejected(client, db_session, admin_user, accepted_delivery_request, vehicle_container_10t, vehicle_container_5t, driver_profile_1, driver_profile_2):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    # Dispatch
    client.post(f"/api/v1/admin/requests/{accepted_delivery_request.id}/dispatch", json={
        "vehicle_id": str(vehicle_container_10t.id),
        "driver_id": str(driver_profile_1.id)
    })

    # Simulate trip started
    trip = db_session.query(Trip).filter(Trip.request_id == accepted_delivery_request.id).first()
    trip.started_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db_session.commit()

    # Reassign attempt should fail with 400
    resp = client.put(f"/api/v1/admin/requests/{accepted_delivery_request.id}/reassign", json={
        "vehicle_id": str(vehicle_container_5t.id),
        "driver_id": str(driver_profile_2.id)
    })
    assert resp.status_code == 400
    assert "already started" in resp.json()["detail"].lower()
