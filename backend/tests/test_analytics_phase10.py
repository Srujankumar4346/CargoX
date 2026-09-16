import pytest
import uuid
from decimal import Decimal
from sqlalchemy import text
from app.db.database import SessionLocal
from app.models.enums import DeliveryRequestStatus, UserRole, CompanyStatus
from app.models.user import User
from app.models.company import CustomerCompany
from app.api.deps import get_current_admin, get_current_customer_user, get_current_driver, get_db
from fastapi.testclient import TestClient
from app.main import app
from datetime import datetime, timedelta, timezone

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

def test_analytics_operating_profit(client, db_session, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    # 1. Create a vehicle and maintenance record
    v_resp = client.post("/api/v1/admin/vehicles", json={
        "registration_number": f"MH01-{uuid.uuid4().hex[:4]}",
        "type": "CONTAINER",
        "capacity_tons": 10.0
    })
    assert v_resp.status_code == 201
    vehicle_id = v_resp.json()["id"]

    sched_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    m_resp = client.post(f"/api/v1/admin/vehicles/{vehicle_id}/maintenance", json={
        "maintenance_type": "ROUTINE",
        "scheduled_date": sched_date,
        "description": "Oil change"
    })
    maintenance_id = m_resp.json()["id"]

    client.post(f"/api/v1/admin/maintenance/{maintenance_id}/start")
    
    # Check baseline analytics
    dash1 = client.get("/api/v1/admin/analytics/dashboard")
    assert dash1.status_code == 200
    assert float(dash1.json()["total_operating_expenses"]) == 0.0

    # Complete maintenance
    c_resp = client.post(f"/api/v1/admin/maintenance/{maintenance_id}/complete", json={
        "cost": "1500.00",
        "mechanic_notes": "All good"
    })
    assert c_resp.status_code == 200

    # Check analytics after maintenance cost
    dash2 = client.get("/api/v1/admin/analytics/dashboard")
    assert dash2.status_code == 200
    assert float(dash2.json()["total_operating_expenses"]) == 1500.0
    
    # Operating profit should be Total Collected - Total Operating Expenses
    # Here Total Collected is 0, so Operating Profit is -1500
    assert float(dash2.json()["operating_profit"]) == -1500.0
