import pytest
import uuid
from sqlalchemy import text
from app.db.database import SessionLocal
from app.models.enums import DeliveryRequestStatus, UserRole, CompanyStatus, MaintenanceType, MaintenanceStatus
from app.models.user import User
from app.api.deps import get_current_admin, get_db
from fastapi.testclient import TestClient
from app.main import app
from datetime import datetime, timedelta, timezone

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

def test_maintenance_lifecycle(client, db_session, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    v_resp = client.post("/api/v1/admin/vehicles", json={
        "registration_number": f"MH01-{uuid.uuid4().hex[:4]}",
        "type": "CONTAINER",
        "capacity_tons": 10.0
    })
    assert v_resp.status_code == 201
    vehicle_id = v_resp.json()["id"]
    
    # 1. Schedule Maintenance
    sched_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    m_resp = client.post(f"/api/v1/admin/vehicles/{vehicle_id}/maintenance", json={
        "maintenance_type": "ROUTINE",
        "scheduled_date": sched_date,
        "description": "Oil change"
    })
    assert m_resp.status_code == 200
    maintenance_id = m_resp.json()["id"]
    assert m_resp.json()["status"] == "SCHEDULED"

    # Cannot schedule another active maintenance
    m2_resp = client.post(f"/api/v1/admin/vehicles/{vehicle_id}/maintenance", json={
        "maintenance_type": "REPAIR",
        "scheduled_date": sched_date
    })
    assert m2_resp.status_code == 409
    
    # 2. Start Maintenance
    s_resp = client.post(f"/api/v1/admin/maintenance/{maintenance_id}/start")
    assert s_resp.status_code == 200
    assert s_resp.json()["status"] == "IN_PROGRESS"
    
    # Vehicle status should be MAINTENANCE
    v_info = client.get(f"/api/v1/admin/vehicles/{vehicle_id}")
    assert v_info.json()["status"] == "MAINTENANCE"
    
    # 3. Complete Maintenance
    c_resp = client.post(f"/api/v1/admin/maintenance/{maintenance_id}/complete", json={
        "cost": "1500.00",
        "mechanic_notes": "All good"
    })
    assert c_resp.status_code == 200
    assert c_resp.json()["status"] == "COMPLETED"
    assert c_resp.json()["cost"] == "1500.00"
    
    # Vehicle status should be AVAILABLE
    v_info2 = client.get(f"/api/v1/admin/vehicles/{vehicle_id}")
    assert v_info2.json()["status"] == "AVAILABLE"
