import pytest
from sqlalchemy import text
from fastapi.testclient import TestClient
from app.main import app
from app.api.deps import get_current_customer_user
from app.models.user import User
from app.models.enums import UserRole
import uuid
import datetime

client = TestClient(app)
company_a_id = uuid.uuid4()
company_b_id = uuid.uuid4()

def override_get_current_customer_a():
    return User(id=str(uuid.uuid4()), role=UserRole.CUSTOMER_USER, customer_company_id=company_a_id)

def override_get_current_customer_b():
    return User(id=str(uuid.uuid4()), role=UserRole.CUSTOMER_USER, customer_company_id=company_b_id)

# Test data variables
recipient_a_id = None
request_a_id = None

from app.db.database import SessionLocal
from app.models.company import CustomerCompany
from app.models.enums import CompanyStatus

@pytest.fixture(autouse=True)
def setup_auth():
    comp_a_id = uuid.uuid4()
    comp_b_id = uuid.uuid4()
    
    app.dependency_overrides[get_current_customer_user] = lambda: User(id=str(uuid.uuid4()), role=UserRole.CUSTOMER_USER, customer_company_id=comp_a_id)
    
    db = SessionLocal()
    comp_a = CustomerCompany(id=comp_a_id, name=f"Company A {comp_a_id.hex[:4]}", billing_address="Addr A", status=CompanyStatus.ACTIVE)
    comp_b = CustomerCompany(id=comp_b_id, name=f"Company B {comp_b_id.hex[:4]}", billing_address="Addr B", status=CompanyStatus.ACTIVE)
    db.add(comp_a)
    db.add(comp_b)
    db.commit()
    
    yield
    
    # Cleanup
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
    db.close()
    
    app.dependency_overrides.clear()


def test_create_recipient():
    response = client.post("/api/v1/customer/recipients", json={
        "name": "Test Recipient A",
        "address": "123 Main St",
        "contact_person": "John Doe",
        "phone": "555-1234"
    })
    assert response.status_code == 201

def test_get_recipient_idor():
    rec_resp = client.post("/api/v1/customer/recipients", json={
        "name": "Test Recipient A",
        "address": "123 Main St"
    })
    rec_id = rec_resp.json()["id"]
    
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_b
    response = client.get(f"/api/v1/customer/recipients/{rec_id}")
    assert response.status_code == 404
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_a

def test_create_delivery_request_snapshot():
    rec_resp = client.post("/api/v1/customer/recipients", json={
        "name": "Test Recipient A",
        "address": "123 Main St"
    })
    rec_id = rec_resp.json()["id"]
    
    response = client.post("/api/v1/customer/requests", json={
        "goods_type": "Electronics",
        "weight_tons": 5.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "456 Start St",
        "recipient_company_id": rec_id
    })
    
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "SUBMITTED"
    assert data["destination_company_name"] == "Test Recipient A"
    assert data["destination_address"] == "123 Main St"

def test_manual_destination_conflict():
    rec_resp = client.post("/api/v1/customer/recipients", json={"name": "A", "address": "B"})
    rec_id = rec_resp.json()["id"]
    
    response = client.post("/api/v1/customer/requests", json={
        "goods_type": "Electronics",
        "weight_tons": 5.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "456 Start St",
        "recipient_company_id": rec_id,
        "destination_company_name": "Conflict Name",
        "destination_address": "Conflict Address"
    })
    assert response.status_code == 422

def test_manual_destination_success():
    response = client.post("/api/v1/customer/requests", json={
        "goods_type": "Wood",
        "weight_tons": 10.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "456 Start St",
        "destination_company_name": "Manual Dest",
        "destination_address": "Manual Address"
    })
    assert response.status_code == 201

def test_get_request_idor():
    req_resp = client.post("/api/v1/customer/requests", json={
        "goods_type": "Wood",
        "weight_tons": 10.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "456 Start St",
        "destination_company_name": "Manual Dest",
        "destination_address": "Manual Address"
    })
    req_id = req_resp.json()["id"]
    
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_b
    response = client.get(f"/api/v1/customer/requests/{req_id}")
    assert response.status_code == 404
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_a

def test_snapshot_survives_recipient_deletion():
    rec_resp = client.post("/api/v1/customer/recipients", json={"name": "A", "address": "B"})
    rec_id = rec_resp.json()["id"]
    
    req_resp = client.post("/api/v1/customer/requests", json={
        "goods_type": "Wood",
        "weight_tons": 10.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "456 Start St",
        "recipient_company_id": rec_id
    })
    req_id = req_resp.json()["id"]
    
    response = client.delete(f"/api/v1/customer/recipients/{rec_id}")
    assert response.status_code == 204
    
    response = client.get(f"/api/v1/customer/requests/{req_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["destination_company_name"] == "A"
    assert data["recipient_company_id"] is None

def test_cancel_request_success():
    req_resp = client.post("/api/v1/customer/requests", json={
        "goods_type": "Wood",
        "weight_tons": 10.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "456 Start St",
        "destination_company_name": "Manual Dest",
        "destination_address": "Manual Address"
    })
    req_id = req_resp.json()["id"]
    
    response = client.post(f"/api/v1/customer/requests/{req_id}/cancel")
    assert response.status_code == 200
    assert response.json()["status"] == "CUSTOMER_CANCELLED"

def test_cancel_request_bad_state():
    req_resp = client.post("/api/v1/customer/requests", json={
        "goods_type": "Wood",
        "weight_tons": 10.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "456 Start St",
        "destination_company_name": "Manual Dest",
        "destination_address": "Manual Address"
    })
    req_id = req_resp.json()["id"]
    
    client.post(f"/api/v1/customer/requests/{req_id}/cancel")
    
    response = client.post(f"/api/v1/customer/requests/{req_id}/cancel")
    assert response.status_code == 400
