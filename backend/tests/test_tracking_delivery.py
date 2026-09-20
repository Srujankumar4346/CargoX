import pytest
import uuid
from decimal import Decimal
from app.models.enums import DeliveryRequestStatus, VehicleStatus, DriverStatus
from app.api.deps import get_current_admin, get_current_customer_user, get_current_driver, get_db
from app.db.database import SessionLocal
from sqlalchemy import text

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


from fastapi.testclient import TestClient
from app.main import app
from app.models.user import User
from app.models.company import CustomerCompany
from app.models.enums import UserRole, CompanyStatus

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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
def driver_user(db_session):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver_{uid}",
        email=f"driver_{uid}@cargox.com",
        role=UserRole.DRIVER,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

def setup_full_trip(client, db_session, admin_user, customer_user, driver_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user
    app.dependency_overrides[get_current_driver] = lambda: driver_user
    app.dependency_overrides[get_db] = lambda: db_session

    # 1. Create Recipient
    r_resp = client.post("/api/v1/customer/recipients", json={
        "name": "Target Recipient",
        "contact_person": "Jane Doe",
        "phone": "+919999999999",
        "address": "456 Destination Ave"
    })
    assert r_resp.status_code == 201
    recipient_id = r_resp.json()["id"]

    # 2. Create Delivery Request
    req_resp = client.post("/api/v1/customer/requests", json={
        "goods_type": "PALLETIZED",
        "goods_description": "General Goods",
        "weight_tons": 5.0,
        "pickup_company_name": "Source Corp",
        "pickup_address": "123 Origin St",
        "pickup_contact_person": "John Doe",
        "pickup_phone": "+919876543210",
        "recipient_company_id": recipient_id
    })
    assert req_resp.status_code == 201
    request_id = req_resp.json()["id"]

    # 3. Create active pricing config & Quote
    client.post("/api/v1/admin/pricing-configs", json={
        "name": "Standard Rate",
        "base_rate_per_km": "20.00",
        "margin_per_km": "5.00"
    })

    q_resp = client.post(f"/api/v1/admin/requests/{request_id}/quote", json={
        "distance_km": "100.00"
    })
    assert q_resp.status_code == 201
    quotation_id = q_resp.json()["id"]

    # 4. Accept quotation
    acc_resp = client.post(f"/api/v1/customer/quotations/{quotation_id}/accept")
    assert acc_resp.status_code == 200

    # 5. Create Vehicle & Driver Profile
    v_resp = client.post("/api/v1/admin/vehicles", json={
        "registration_number": f"MH01-{uuid.uuid4().hex[:4].upper()}",
        "type": "CONTAINER",
        "capacity_tons": 10.0
    })
    assert v_resp.status_code == 201
    vehicle_id = v_resp.json()["id"]

    d_prof_resp = client.post("/api/v1/admin/drivers", json={
        "user_id": str(driver_user.id),
        "name": "Test Driver",
        "phone": "+919888888888",
        "license_number": f"DL-{uuid.uuid4().hex[:6].upper()}"
    })
    assert d_prof_resp.status_code == 201
    driver_id = d_prof_resp.json()["id"]

    # 6. Dispatch Request
    disp_resp = client.post(f"/api/v1/admin/requests/{request_id}/dispatch", json={
        "vehicle_id": vehicle_id,
        "driver_id": driver_id
    })
    assert disp_resp.status_code == 201
    trip_id = disp_resp.json()["trip_id"]

    return {
        "request_id": request_id,
        "trip_id": trip_id,
        "vehicle_id": vehicle_id,
        "driver_id": driver_id,
        "admin_user": admin_user,
        "customer_user": customer_user,
        "driver_user": driver_user
    }

def test_phase7_full_lifecycle(client, db_session, admin_user, customer_user, driver_user):
    ctx = setup_full_trip(client, db_session, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]
    req_id = ctx["request_id"]

    app.dependency_overrides[get_current_driver] = lambda: driver_user
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user
    app.dependency_overrides[get_db] = lambda: db_session

    # 1. Driver execution steps: DRIVER_ASSIGNED -> PICKUP_IN_PROGRESS -> IN_TRANSIT -> ARRIVED
    r1 = client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    assert r1.status_code == 200

    r2 = client.post(f"/api/v1/driver/trips/{trip_id}/start-transit")
    assert r2.status_code == 200

    r3 = client.post(f"/api/v1/driver/trips/{trip_id}/arrive")
    assert r3.status_code == 200

    # Test skipped transition rejection: ARRIVED -> COMPLETED via Admin complete call
    bad_comp = client.post(f"/api/v1/admin/trips/{trip_id}/complete")
    assert bad_comp.status_code == 400
    assert "DELIVERED" in bad_comp.json()["detail"]

    # 2. Driver submits POD -> POD_SUBMITTED
    pod_resp = client.post(f"/api/v1/driver/trips/{trip_id}/pod", json={
        "pod_signature_url": "https://storage.cargox.com/sig1.png",
        "pod_photo_url": "https://storage.cargox.com/photo1.png",
        "notes": "Delivered in perfect condition"
    })
    assert pod_resp.status_code == 201

    # Test duplicate POD submission -> 409 Conflict
    dup_pod = client.post(f"/api/v1/driver/trips/{trip_id}/pod", json={
        "pod_signature_url": "https://storage.cargox.com/sig2.png"
    })
    assert dup_pod.status_code == 409

    # Test skipped transition rejection: POD_SUBMITTED -> COMPLETED
    bad_comp2 = client.post(f"/api/v1/admin/trips/{trip_id}/complete")
    assert bad_comp2.status_code == 400

    # 3. Admin verifies POD -> DELIVERED
    verify_resp = client.post(f"/api/v1/admin/trips/{trip_id}/verify-pod")
    assert verify_resp.status_code == 200

    # Verify vehicle and driver are still committed ON_TRIP/ASSIGNED during DELIVERED
    v_info = client.get(f"/api/v1/admin/vehicles/{ctx['vehicle_id']}")
    assert v_info.json()["status"] == "ASSIGNED"

    # 4. Admin completes delivery -> COMPLETED
    comp_resp = client.post(f"/api/v1/admin/trips/{trip_id}/complete")
    assert comp_resp.status_code == 200
    assert comp_resp.json()["status"] == "COMPLETED"
    assert comp_resp.json()["completed_at"] is not None

    # Verify resources released to AVAILABLE ONLY at completion
    v_info_after = client.get(f"/api/v1/admin/vehicles/{ctx['vehicle_id']}")
    assert v_info_after.json()["status"] == "AVAILABLE"

    d_info_after = client.get(f"/api/v1/admin/drivers/{ctx['driver_id']}")
    assert d_info_after.json()["status"] == "AVAILABLE"

def test_gps_location_history_and_customer_tracking(client, db_session, admin_user, customer_user, driver_user):
    ctx = setup_full_trip(client, db_session, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]
    req_id = ctx["request_id"]

    app.dependency_overrides[get_current_driver] = lambda: driver_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user
    app.dependency_overrides[get_db] = lambda: db_session

    # Start pickup so live tracking is active
    client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")

    # Post GPS update
    gps_resp = client.post(f"/api/v1/driver/trips/{trip_id}/location", json={
        "lat": 19.0760,
        "lng": 72.8777
    })
    assert gps_resp.status_code == 200

    # Post second GPS update
    gps_resp2 = client.post(f"/api/v1/driver/trips/{trip_id}/location", json={
        "lat": 19.0800,
        "lng": 72.8800
    })
    assert gps_resp2.status_code == 200

    # Customer tracking query
    track_resp = client.get(f"/api/v1/customer/requests/{req_id}/tracking")
    assert track_resp.status_code == 200
    track_data = track_resp.json()

    assert track_data["is_live"] is True
    assert track_data["current_lat"] == 19.0800
    assert track_data["current_lng"] == 72.8800
    assert len(track_data["breadcrumbs"]) == 2
    assert track_data["breadcrumbs"][0]["lat"] == 19.0760
    assert track_data["breadcrumbs"][1]["lat"] == 19.0800

    # Check IDOR: Another customer cannot access tracking
    other_company = CustomerCompany(
        id=uuid.uuid4(),
        name="Other Company",
        billing_address="Other Address",
        status=CompanyStatus.ACTIVE
    )
    db_session.add(other_company)
    db_session.commit()

    uid2 = uuid.uuid4().hex[:8]
    customer2_user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_cust_other_{uid2}",
        email=f"cust_other_{uid2}@company.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=other_company.id,
        is_active=True
    )
    db_session.add(customer2_user)
    db_session.commit()

    app.dependency_overrides[get_current_customer_user] = lambda: customer2_user
    idor_resp = client.get(f"/api/v1/customer/requests/{req_id}/tracking")
    assert idor_resp.status_code == 404


