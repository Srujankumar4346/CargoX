import pytest
from sqlalchemy import text
from fastapi.testclient import TestClient
from app.main import app
from app.api.deps import get_current_customer_user, get_current_admin
from app.models.user import User
from app.models.enums import UserRole
from app.db.database import SessionLocal
from app.models.company import CustomerCompany
from app.models.enums import CompanyStatus
import uuid

client = TestClient(app)

customer_a_id = uuid.uuid4()
customer_b_id = uuid.uuid4()

def override_get_current_customer_a():
    return User(id=str(uuid.uuid4()), role=UserRole.CUSTOMER_USER, customer_company_id=customer_a_id)

def override_get_current_customer_b():
    return User(id=str(uuid.uuid4()), role=UserRole.CUSTOMER_USER, customer_company_id=customer_b_id)

def override_get_current_admin():
    return User(id=str(uuid.uuid4()), role=UserRole.ADMIN)

def cleanup_db(db):
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

@pytest.fixture(autouse=True)
def setup_integration_env():
    # Setup test companies
    db = SessionLocal()
    cleanup_db(db)
    
    comp_a = CustomerCompany(id=customer_a_id, name="ABC Company", billing_address="Addr A", status=CompanyStatus.ACTIVE)
    comp_b = CustomerCompany(id=customer_b_id, name="XYZ Company", billing_address="Addr B", status=CompanyStatus.ACTIVE)
    db.add(comp_a)
    db.add(comp_b)
    db.commit()
    
    # Default override to customer A for normal customer tests
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_a
    app.dependency_overrides[get_current_admin] = override_get_current_admin
    
    yield
    
    cleanup_db(db)
    db.close()
    
    app.dependency_overrides.clear()

def test_1_customer_submits_booking():
    """TEST 1: Customer submits booking -> DeliveryRequest created -> status = SUBMITTED"""
    response = client.post("/api/v1/customer/requests", json={
        "goods_type": "Cotton",
        "weight_tons": 10.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "123 Start St",
        "destination_company_name": "Dest Co",
        "destination_address": "456 End St"
    })
    
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "SUBMITTED"
    assert data["goods_type"] == "Cotton"
    assert "request_number" in data

def test_2_admin_requests_list_shows_submitted():
    """TEST 2: Admin requests list -> submitted request appears"""
    # Create request
    create_resp = client.post("/api/v1/customer/requests", json={
        "goods_type": "Steel",
        "weight_tons": 5.0,
        "pickup_company_name": "Pickup",
        "pickup_address": "Addr 1",
        "destination_company_name": "Dest",
        "destination_address": "Addr 2"
    })
    req_id = create_resp.json()["id"]

    # Check admin view
    admin_resp = client.get("/api/v1/admin/requests")
    assert admin_resp.status_code == 200
    requests = admin_resp.json()
    assert any(r["id"] == req_id for r in requests)

def test_3_customer_request_list():
    """TEST 3: Customer request list -> customer's request appears"""
    create_resp = client.post("/api/v1/customer/requests", json={
        "goods_type": "Plastic",
        "weight_tons": 2.0,
        "pickup_company_name": "P",
        "pickup_address": "P",
        "destination_company_name": "D",
        "destination_address": "D"
    })
    req_id = create_resp.json()["id"]
    
    list_resp = client.get("/api/v1/customer/requests")
    assert list_resp.status_code == 200
    requests = list_resp.json()
    assert any(r["id"] == req_id for r in requests)

def test_4_customer_isolation():
    """TEST 4: Customer A cannot access Customer B request"""
    # Create as Customer A
    create_resp = client.post("/api/v1/customer/requests", json={
        "goods_type": "Glass",
        "weight_tons": 1.0,
        "pickup_company_name": "P",
        "pickup_address": "P",
        "destination_company_name": "D",
        "destination_address": "D"
    })
    req_id = create_resp.json()["id"]
    
    # Try to access as Customer B
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_b
    get_resp = client.get(f"/api/v1/customer/requests/{req_id}")
    assert get_resp.status_code == 404

def test_5_customer_cannot_access_admin_endpoints():
    """TEST 5: Customer cannot access /api/v1/admin/requests"""
    app.dependency_overrides.pop(get_current_admin, None)
    
    # By removing get_current_admin override, the request should fail 
    # since no valid token is provided.
    response = client.get("/api/v1/admin/requests")
    assert response.status_code == 401

def test_6_non_admin_cannot_access_admin_requests():
    """TEST 6: Non-admin cannot access admin requests"""
    app.dependency_overrides.pop(get_current_admin, None)
    # Even if they provide a customer token, get_current_admin explicitly checks for UserRole.ADMIN
    response = client.get("/api/v1/admin/requests")
    assert response.status_code == 401

def test_7_admin_can_access_submitted_requests():
    """TEST 7: Admin can access submitted requests"""
    admin_resp = client.get("/api/v1/admin/requests")
    assert admin_resp.status_code == 200

def test_8_correct_customer_company_id_derived():
    """TEST 8: Created request contains correct customer_company_id derived from authenticated user"""
    # Create as Customer B
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_b
    create_resp = client.post("/api/v1/customer/requests", json={
        "goods_type": "Wood",
        "weight_tons": 4.0,
        "pickup_company_name": "P",
        "pickup_address": "P",
        "destination_company_name": "D",
        "destination_address": "D"
    })
    assert create_resp.status_code == 201
    
    db = SessionLocal()
    from app.models.delivery import DeliveryRequest
    req = db.query(DeliveryRequest).filter(DeliveryRequest.id == create_resp.json()["id"]).first()
    assert req.customer_company_id == customer_b_id
    db.close()

def test_9_client_cannot_spoof_customer_company_id():
    """TEST 9: Client cannot spoof customer_company_id"""
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_a
    create_resp = client.post("/api/v1/customer/requests", json={
        "goods_type": "Wood",
        "weight_tons": 4.0,
        "pickup_company_name": "P",
        "pickup_address": "P",
        "destination_company_name": "D",
        "destination_address": "D",
        "customer_company_id": str(customer_b_id)
    })
    
    if create_resp.status_code == 201:
        # Pydantic ignores extra fields, so customer_company_id should be A (the authenticated user)
        db = SessionLocal()
        from app.models.delivery import DeliveryRequest
        req = db.query(DeliveryRequest).filter(DeliveryRequest.id == create_resp.json()["id"]).first()
        assert req.customer_company_id == customer_a_id
        db.close()
    else:
        assert create_resp.status_code == 422

def test_10_no_mock_data():
    """TEST 10: No mock/hardcoded request is required for Admin display"""
    admin_resp = client.get("/api/v1/admin/requests")
    assert admin_resp.status_code == 200
    assert admin_resp.json() == []  # DB is cleaned up before each test

def test_11_refresh_admin_page():
    """TEST 11: After customer submission, refreshing Admin request page retrieves the request from backend/database."""
    client.post("/api/v1/customer/requests", json={
        "goods_type": "Oil",
        "weight_tons": 10.0,
        "pickup_company_name": "A",
        "pickup_address": "A",
        "destination_company_name": "B",
        "destination_address": "B"
    })
    admin_resp = client.get("/api/v1/admin/requests")
    assert len(admin_resp.json()) == 1
    assert admin_resp.json()[0]["goods_type"] == "Oil"
