import pytest
import uuid
from fastapi import status
from app.db.database import SessionLocal
from fastapi.testclient import TestClient
from app.main import app
from sqlalchemy import text
from app.api.deps import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.core.config import settings

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
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.pop(get_db, None)

@pytest.fixture
def auth_headers_primary_admin(client, db_session):
    # We simulate the token verification by returning the primary admin clerk id
    clerk_id = "user_primary_admin"
    settings.CARGOX_PRIMARY_ADMIN_CLERK_ID = clerk_id
    
    # Normally deps.py uses decode_token. Since we mock decode_token or get_current_user_token in tests,
    # we override the dependency.
    from app.api.deps import get_current_user_token
    app.dependency_overrides[get_current_user_token] = lambda: {"sub": clerk_id, "email": "admin@cargox.com"}
    yield {"Authorization": "Bearer fake_token"}
    app.dependency_overrides.pop(get_current_user_token, None)

@pytest.fixture
def auth_headers_new_customer(client, db_session):
    clerk_id = "user_new_customer"
    from app.api.deps import get_current_user_token
    app.dependency_overrides[get_current_user_token] = lambda: {"sub": clerk_id, "email": "new_cust@cargox.com"}
    yield {"Authorization": "Bearer fake_token"}
    app.dependency_overrides.pop(get_current_user_token, None)

def test_primary_admin_auto_provisioning(client, db_session, auth_headers_primary_admin):
    # Calling any endpoint that uses get_current_user should provision the admin
    response = client.get("/api/v1/admin/users", headers=auth_headers_primary_admin)
    assert response.status_code == status.HTTP_200_OK
    
    # Verify in DB
    user = db_session.query(User).filter(User.clerk_user_id == "user_primary_admin").first()
    assert user is not None
    assert user.role == UserRole.ADMIN
    assert user.customer_company_id is None

def test_new_customer_auto_provisioning(client, db_session, auth_headers_new_customer):
    # Customer trying to access admin endpoint
    response = client.get("/api/v1/admin/users", headers=auth_headers_new_customer)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    
    # Verify in DB that they were provisioned correctly as CUSTOMER_USER with no company
    user = db_session.query(User).filter(User.clerk_user_id == "user_new_customer").first()
    assert user is not None
    assert user.role == UserRole.CUSTOMER_USER
    assert user.customer_company_id is None

def test_admin_can_update_role(client, db_session, auth_headers_primary_admin):
    # Seed a target user with valid company
    from app.models.company import CustomerCompany
    from app.models.enums import CompanyStatus
    company_id = uuid.uuid4()
    company = CustomerCompany(id=company_id, name="Target Company", billing_address="123", status=CompanyStatus.ACTIVE)
    db_session.add(company)
    db_session.commit()
    
    target_user = User(clerk_user_id="user_target", email="target@cargox.com", role=UserRole.CUSTOMER_USER, customer_company_id=company_id)
    db_session.add(target_user)
    db_session.commit()
    db_session.refresh(target_user)
    
    response = client.put(
        f"/api/v1/admin/users/{str(target_user.id)}/role",
        headers=auth_headers_primary_admin,
        json={"role": UserRole.ADMIN.value}
    )
    assert response.status_code == status.HTTP_200_OK
    
    # Verify DB
    db_session.refresh(target_user)
    assert target_user.role == UserRole.ADMIN
    assert target_user.customer_company_id is not None # Preserved!

def test_admin_cannot_demote_primary_admin(client, db_session, auth_headers_primary_admin):
    # Provision primary admin
    client.get("/api/v1/admin/users", headers=auth_headers_primary_admin)
    primary_admin = db_session.query(User).filter(User.clerk_user_id == "user_primary_admin").first()
    
    response = client.put(
        f"/api/v1/admin/users/{str(primary_admin.id)}/role",
        headers=auth_headers_primary_admin,
        json={"role": UserRole.CUSTOMER_USER.value}
    )
    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json()["detail"] == "Primary administrator cannot be demoted."
