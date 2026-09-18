import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import uuid
from sqlalchemy import text

from app.main import app
from app.api.deps import get_current_admin, get_current_customer_user, get_current_driver, get_db
from app.models.user import User
from app.models.company import CustomerCompany
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
        db.execute(text("DELETE FROM location_histories"))
        db.execute(text("DELETE FROM payments"))
        db.execute(text("DELETE FROM trip_expenses"))
        db.execute(text("DELETE FROM proof_of_deliveries"))
        db.execute(text("DELETE FROM vehicle_assignments"))
        db.execute(text("DELETE FROM trips"))
        db.execute(text("DELETE FROM driver_settlements"))
        db.execute(text("DELETE FROM invoices"))
        db.execute(text("DELETE FROM quotations"))
        db.execute(text("DELETE FROM delivery_requests"))
        db.execute(text("DELETE FROM compliance_documents"))
        db.execute(text("DELETE FROM vehicle_maintenance"))
        db.execute(text("DELETE FROM notifications"))
        db.execute(text("DELETE FROM drivers"))
        db.execute(text("DELETE FROM vehicles"))
        db.execute(text("DELETE FROM pricing_configs"))
        db.execute(text("DELETE FROM users"))
        db.execute(text("DELETE FROM recipient_companies"))
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
def driver_user_a(db_session):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver_a_{uid}",
        email=f"driver_a_{uid}@cargox.com",
        role=UserRole.DRIVER,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def driver_user_b(db_session):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver_b_{uid}",
        email=f"driver_b_{uid}@cargox.com",
        role=UserRole.DRIVER,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def customer_user(db_session):
    company = CustomerCompany(
        id=uuid.uuid4(),
        name=f"Company {uuid.uuid4().hex[:6]}",
        billing_address="123 Corporate Way, Mumbai",
        status=CompanyStatus.ACTIVE
    )
    db_session.add(company)
    db_session.commit()

    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_cust_{uid}",
        email=f"cust_{uid}@company.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=company.id,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def driver_profile_a(db_session, driver_user_a):
    d = Driver(
        id=uuid.uuid4(),
        user_id=driver_user_a.id,
        name="Driver Alpha",
        phone="9876543210",
        license_number=f"DL-{uuid.uuid4().hex[:6].upper()}",
        status=DriverStatus.AVAILABLE
    )
    db_session.add(d)
    db_session.commit()
    db_session.refresh(d)
    return d

@pytest.fixture
def driver_profile_b(db_session, driver_user_b):
    d = Driver(
        id=uuid.uuid4(),
        user_id=driver_user_b.id,
        name="Driver Beta",
        phone="9876543211",
        license_number=f"DL-{uuid.uuid4().hex[:6].upper()}",
        status=DriverStatus.AVAILABLE
    )
    db_session.add(d)
    db_session.commit()
    db_session.refresh(d)
    return d

@pytest.fixture
def vehicle_1(db_session):
    v = Vehicle(
        id=uuid.uuid4(),
        registration_number=f"MH-{uuid.uuid4().hex[:4].upper()}-9999",
        type=VehicleType.CONTAINER,
        capacity_tons=10.0,
        status=VehicleStatus.AVAILABLE
    )
    db_session.add(v)
    db_session.commit()
    db_session.refresh(v)
    return v

@pytest.fixture
def dispatched_trip_driver_a(db_session, customer_user, driver_profile_a, vehicle_1):
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
    db_session.add(req)

    trip = Trip(
        id=uuid.uuid4(),
        request_id=req.id,
        assigned_at=now
    )
    db_session.add(trip)

    assignment = VehicleAssignment(
        id=uuid.uuid4(),
        trip_id=trip.id,
        vehicle_id=vehicle_1.id,
        driver_id=driver_profile_a.id,
        assigned_at=now,
        released_at=None
    )
    db_session.add(assignment)

    vehicle_1.status = VehicleStatus.ASSIGNED
    driver_profile_a.status = DriverStatus.ON_TRIP

    db_session.commit()
    db_session.refresh(trip)
    return trip

# ----------------------------------------------------------------------
# TESTS
# ----------------------------------------------------------------------

def test_driver_get_active_trip_success(client, db_session, driver_user_a, driver_profile_a, dispatched_trip_driver_a):
    app.dependency_overrides[get_current_driver] = lambda: driver_user_a
    app.dependency_overrides[get_db] = lambda: db_session

    resp = client.get("/api/v1/driver/trips/active")
    assert resp.status_code == 200
    data = resp.json()

    assert data["trip_id"] == str(dispatched_trip_driver_a.id)
    assert data["status"] == "DRIVER_ASSIGNED"
    assert "internal_base_cost" not in data
    assert "cargox_margin" not in data

def test_unassigned_driver_get_active_trip_404(client, db_session, driver_user_b, driver_profile_b):
    app.dependency_overrides[get_current_driver] = lambda: driver_user_b
    app.dependency_overrides[get_db] = lambda: db_session

    resp = client.get("/api/v1/driver/trips/active")
    assert resp.status_code == 404
    assert "no active trip assigned" in resp.json()["detail"].lower()

def test_cross_driver_trip_access_idor_protection(client, db_session, driver_user_b, driver_profile_b, dispatched_trip_driver_a):
    # Driver B attempts to call start-pickup on Driver A's trip -> 404 Not Found
    app.dependency_overrides[get_current_driver] = lambda: driver_user_b
    app.dependency_overrides[get_db] = lambda: db_session

    resp = client.post(f"/api/v1/driver/trips/{dispatched_trip_driver_a.id}/start-pickup")
    assert resp.status_code == 404

def test_customer_user_cannot_access_driver_routes(client, db_session, customer_user):
    app.dependency_overrides[get_db] = lambda: db_session
    resp = client.get("/api/v1/driver/trips/active")
    assert resp.status_code in [401, 403]

def test_trip_execution_state_flow_and_idempotency(client, db_session, driver_user_a, driver_profile_a, dispatched_trip_driver_a):
    app.dependency_overrides[get_current_driver] = lambda: driver_user_a
    app.dependency_overrides[get_db] = lambda: db_session

    trip_id = str(dispatched_trip_driver_a.id)

    # 1. Start Pickup: DRIVER_ASSIGNED -> PICKUP_IN_PROGRESS
    r1 = client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    assert r1.status_code == 200
    assert r1.json()["status"] == "PICKUP_IN_PROGRESS"
    assert r1.json()["pickup_started_at"] is not None
    orig_pickup_time = r1.json()["pickup_started_at"]

    # 1b. Idempotency test: Retry start pickup -> returns 200 OK without re-mutating timestamp
    r1_retry = client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    assert r1_retry.status_code == 200
    assert r1_retry.json()["pickup_started_at"] == orig_pickup_time

    # 2. Start Transit: PICKUP_IN_PROGRESS -> IN_TRANSIT
    r2 = client.post(f"/api/v1/driver/trips/{trip_id}/start-transit")
    assert r2.status_code == 200
    assert r2.json()["status"] == "IN_TRANSIT"
    assert r2.json()["started_at"] is not None

    # 3. Arrive: IN_TRANSIT -> ARRIVED
    r3 = client.post(f"/api/v1/driver/trips/{trip_id}/arrive")
    assert r3.status_code == 200
    assert r3.json()["status"] == "ARRIVED"
    assert r3.json()["arrived_at"] is not None

def test_out_of_order_state_transition_rejected(client, db_session, driver_user_a, driver_profile_a, dispatched_trip_driver_a):
    app.dependency_overrides[get_current_driver] = lambda: driver_user_a
    app.dependency_overrides[get_db] = lambda: db_session

    trip_id = str(dispatched_trip_driver_a.id)

    # Currently DRIVER_ASSIGNED: Attempting to call arrive directly -> 400 Bad Request
    resp = client.post(f"/api/v1/driver/trips/{trip_id}/arrive")
    assert resp.status_code == 400
    assert "cannot mark arrived" in resp.json()["detail"].lower()

def test_gps_location_update_success(client, db_session, driver_user_a, driver_profile_a, dispatched_trip_driver_a):
    app.dependency_overrides[get_current_driver] = lambda: driver_user_a
    app.dependency_overrides[get_db] = lambda: db_session

    trip_id = str(dispatched_trip_driver_a.id)
    resp = client.post(f"/api/v1/driver/trips/{trip_id}/location", json={
        "lat": 19.0760,
        "lng": 72.8777
    })
    assert resp.status_code == 200
    assert resp.json()["current_lat"] == 19.0760

    # Verify DB update
    db_session.refresh(dispatched_trip_driver_a)
    assert dispatched_trip_driver_a.current_lat == 19.0760
    assert dispatched_trip_driver_a.current_lng == 72.8777

def test_gps_location_validation_bounds(client, db_session, driver_user_a, driver_profile_a, dispatched_trip_driver_a):
    app.dependency_overrides[get_current_driver] = lambda: driver_user_a
    app.dependency_overrides[get_db] = lambda: db_session

    trip_id = str(dispatched_trip_driver_a.id)
    # Invalid lat > 90.0
    resp = client.post(f"/api/v1/driver/trips/{trip_id}/location", json={
        "lat": 95.0,
        "lng": 72.8777
    })
    assert resp.status_code == 422

def test_phase5_reassignment_releases_driver_a(client, db_session, admin_user, driver_user_a, driver_user_b, driver_profile_a, driver_profile_b, vehicle_1, dispatched_trip_driver_a):
    # Driver A initially assigned to trip
    trip_id = str(dispatched_trip_driver_a.id)

    # Admin reassigns trip to Driver B (Phase 5 endpoint)
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    req_id = dispatched_trip_driver_a.request_id
    reassign_resp = client.put(f"/api/v1/admin/requests/{req_id}/reassign", json={
        "vehicle_id": str(vehicle_1.id),
        "driver_id": str(driver_profile_b.id)
    })
    assert reassign_resp.status_code == 200

    # Driver A attempts to call start-pickup -> 404 Not Found (assignment released_at is set)
    app.dependency_overrides[get_current_driver] = lambda: driver_user_a
    resp_a = client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    assert resp_a.status_code == 404

    # Driver B attempts to call start-pickup -> 200 OK
    app.dependency_overrides[get_current_driver] = lambda: driver_user_b
    resp_b = client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    assert resp_b.status_code == 200
    assert resp_b.json()["status"] == "PICKUP_IN_PROGRESS"
