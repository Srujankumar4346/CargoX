import pytest
import uuid
from sqlalchemy import text
from app.db.database import SessionLocal
from app.models.enums import DeliveryRequestStatus, UserRole, CompanyStatus, ExpenseCategory, ExpenseStatus
from app.models.user import User
from app.models.company import CustomerCompany
from app.api.deps import get_current_admin, get_current_customer_user, get_current_driver, get_db
from fastapi.testclient import TestClient
from app.main import app

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
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_admin_{uuid.uuid4().hex[:8]}",
        email=f"admin_{uuid.uuid4().hex[:8]}@cargox.com",
        role=UserRole.ADMIN,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def driver_user(db_session):
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver_{uuid.uuid4().hex[:8]}",
        email=f"driver_{uuid.uuid4().hex[:8]}@cargox.com",
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
    
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_cust_{uuid.uuid4().hex[:8]}",
        email=f"cust_{uuid.uuid4().hex[:8]}@company.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=company.id,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

def setup_trip(client, db_session, admin_user, customer_user, driver_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user
    app.dependency_overrides[get_current_driver] = lambda: driver_user
    app.dependency_overrides[get_db] = lambda: db_session

    r_resp = client.post("/api/v1/customer/recipients", json={
        "name": "Target Recipient", "contact_person": "Jane Doe",
        "phone": "+919999999999", "address": "456 Destination Ave"
    })
    recipient_id = r_resp.json()["id"]

    req_resp = client.post("/api/v1/customer/requests", json={
        "goods_type": "PALLETIZED", "weight_tons": 5.0,
        "pickup_company_name": "Source Corp", "pickup_address": "123 Origin St",
        "recipient_company_id": recipient_id
    })
    request_id = req_resp.json()["id"]

    client.post("/api/v1/admin/pricing-configs", json={"name": "Std", "base_rate_per_km": "20", "margin_per_km": "5"})
    q_resp = client.post(f"/api/v1/admin/requests/{request_id}/quote", json={"distance_km": "100"})
    quotation_id = q_resp.json()["id"]
    client.post(f"/api/v1/customer/quotations/{quotation_id}/accept")

    v_resp = client.post("/api/v1/admin/vehicles", json={"registration_number": f"MH01-{uuid.uuid4().hex[:4]}", "type": "CONTAINER", "capacity_tons": 10.0})
    vehicle_id = v_resp.json()["id"]
    d_prof_resp = client.post("/api/v1/admin/drivers", json={"user_id": str(driver_user.id), "name": "Driver", "phone": "+9199", "license_number": f"DL-{uuid.uuid4().hex[:4]}"})
    driver_id = d_prof_resp.json()["id"]

    disp_resp = client.post(f"/api/v1/admin/requests/{request_id}/dispatch", json={"vehicle_id": vehicle_id, "driver_id": driver_id})
    return disp_resp.json()["trip_id"]

def test_expense_lifecycle(client, db_session, admin_user, customer_user, driver_user):
    trip_id = setup_trip(client, db_session, admin_user, customer_user, driver_user)
    
    # Try driver submit expense before active -> should fail? 
    # Actually DRIVER_ASSIGNED is an active state. Let's test it.
    app.dependency_overrides[get_current_driver] = lambda: driver_user
    resp1 = client.post(f"/api/v1/driver/trips/{trip_id}/expenses", json={
        "amount": "50.00",
        "category": "FUEL",
        "description": "Initial fuel",
        "receipt_url": "https://example.com/receipt1.png"
    })
    assert resp1.status_code == 200
    expense_id = resp1.json()["id"]
    assert resp1.json()["status"] == "PENDING_APPROVAL"

    # Driver cannot mutate status
    # Admin mutate status
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    resp2 = client.patch(f"/api/v1/admin/expenses/{expense_id}/status", json={
        "status": "APPROVED"
    })
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "APPROVED"

    # Cannot mutate approved expense
    resp3 = client.patch(f"/api/v1/admin/expenses/{expense_id}/status", json={
        "status": "REJECTED"
    })
    assert resp3.status_code == 400

    # Admin direct submit -> APPROVED
    resp4 = client.post(f"/api/v1/admin/trips/{trip_id}/expenses", json={
        "amount": "100.00",
        "category": "TOLL"
    })
    assert resp4.status_code == 200
    assert resp4.json()["status"] == "APPROVED"

    # Complete the trip
    db_session.execute(text(f"UPDATE delivery_requests SET status = 'COMPLETED' WHERE id = (SELECT request_id FROM trips WHERE id = '{trip_id}')"))
    db_session.commit()

    # Driver submission on COMPLETED trip should fail
    app.dependency_overrides[get_current_driver] = lambda: driver_user
    resp_driver_completed = client.post(f"/api/v1/driver/trips/{trip_id}/expenses", json={
        "amount": "10.00",
        "category": "OTHER"
    })
    assert resp_driver_completed.status_code == 400

    # Admin submission on COMPLETED trip should succeed
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    resp_admin_completed = client.post(f"/api/v1/admin/trips/{trip_id}/expenses", json={
        "amount": "20.00",
        "category": "OTHER"
    })
    assert resp_admin_completed.status_code == 200

