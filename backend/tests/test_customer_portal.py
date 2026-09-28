import pytest
from httpx import AsyncClient
from app.main import app
from app.api.deps import get_current_customer_user
from app.models.user import User
from app.models.enums import UserRole
import uuid

company_a_id = uuid.uuid4()
company_b_id = uuid.uuid4()

def override_get_current_customer_a():
    return User(id=uuid.uuid4(), role=UserRole.CUSTOMER_USER, customer_company_id=company_a_id, email="test_a@example.com")

def override_get_current_customer_b():
    return User(id=uuid.uuid4(), role=UserRole.CUSTOMER_USER, customer_company_id=company_b_id, email="test_b@example.com")

from app.models.company import CustomerCompany
from app.models.enums import CompanyStatus

@pytest.fixture(autouse=True)
async def setup_auth():
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_a
    
    comp_a = CustomerCompany(id=company_a_id, name=f"Company A {company_a_id.hex[:4]}", billing_address="Addr A", status=CompanyStatus.ACTIVE)
    comp_b = CustomerCompany(id=company_b_id, name=f"Company B {company_b_id.hex[:4]}", billing_address="Addr B", status=CompanyStatus.ACTIVE)
    await comp_a.insert()
    await comp_b.insert()
    
    yield
    
    app.dependency_overrides.clear()

@pytest.mark.anyio
async def test_create_recipient(async_client: AsyncClient):
    response = await async_client.post("/api/v1/customer/recipients", json={
        "name": "Test Recipient A",
        "address": "123 Main St",
        "contact_person": "John Doe",
        "phone": "555-1234"
    })
    assert response.status_code == 201

@pytest.mark.anyio
async def test_get_recipient_idor(async_client: AsyncClient):
    rec_resp = await async_client.post("/api/v1/customer/recipients", json={
        "name": "Test Recipient A",
        "address": "123 Main St"
    })
    rec_id = rec_resp.json()["id"]
    
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_b
    response = await async_client.get(f"/api/v1/customer/recipients/{rec_id}")
    assert response.status_code == 404
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_a

@pytest.mark.anyio
async def test_create_delivery_request_snapshot(async_client: AsyncClient):
    rec_resp = await async_client.post("/api/v1/customer/recipients", json={
        "name": "Test Recipient A",
        "address": "123 Main St"
    })
    rec_id = rec_resp.json()["id"]
    
    response = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "Electronics",
        "weight_tons": 5.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "456 Start St",
        "recipient_company_id": rec_id,
        "distance_km": 100
    })
    
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "SUBMITTED"
    assert data["destination_company_name"] == "Test Recipient A"
    assert data["destination_address"] == "123 Main St"

@pytest.mark.anyio
async def test_manual_destination_conflict(async_client: AsyncClient):
    rec_resp = await async_client.post("/api/v1/customer/recipients", json={"name": "A", "address": "B"})
    rec_id = rec_resp.json()["id"]
    
    response = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "Electronics",
        "weight_tons": 5.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "456 Start St",
        "recipient_company_id": rec_id,
        "destination_company_name": "Conflict Name",
        "destination_address": "Conflict Address",
        "distance_km": 100
    })
    assert response.status_code == 422

@pytest.mark.anyio
async def test_manual_destination_success(async_client: AsyncClient):
    response = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "Wood",
        "weight_tons": 10.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "456 Start St",
        "destination_company_name": "Manual Dest",
        "destination_address": "Manual Address",
        "distance_km": 100
    })
    assert response.status_code == 201

@pytest.mark.anyio
async def test_get_request_idor(async_client: AsyncClient):
    req_resp = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "Wood",
        "weight_tons": 10.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "456 Start St",
        "destination_company_name": "Manual Dest",
        "destination_address": "Manual Address",
        "distance_km": 100
    })
    req_id = req_resp.json()["id"]
    
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_b
    response = await async_client.get(f"/api/v1/customer/requests/{req_id}")
    assert response.status_code == 404
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_a

@pytest.mark.anyio
async def test_snapshot_survives_recipient_deletion(async_client: AsyncClient):
    rec_resp = await async_client.post("/api/v1/customer/recipients", json={"name": "A", "address": "B"})
    rec_id = rec_resp.json()["id"]
    
    req_resp = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "Wood",
        "weight_tons": 10.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "456 Start St",
        "recipient_company_id": rec_id,
        "distance_km": 100
    })
    req_id = req_resp.json()["id"]
    
    response = await async_client.delete(f"/api/v1/customer/recipients/{rec_id}")
    assert response.status_code == 204
    
    response = await async_client.get(f"/api/v1/customer/requests/{req_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["destination_company_name"] == "A"
    assert data["recipient_company_id"] is None

@pytest.mark.anyio
async def test_cancel_request_success(async_client: AsyncClient):
    req_resp = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "Wood",
        "weight_tons": 10.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "456 Start St",
        "destination_company_name": "Manual Dest",
        "destination_address": "Manual Address",
        "distance_km": 100
    })
    req_id = req_resp.json()["id"]
    
    response = await async_client.post(f"/api/v1/customer/requests/{req_id}/cancel", json={"reason": "Test cancel"})
    assert response.status_code == 200
    assert response.json()["status"] == "CUSTOMER_CANCELLED"

@pytest.mark.anyio
async def test_cancel_request_bad_state(async_client: AsyncClient):
    req_resp = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "Wood",
        "weight_tons": 10.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "456 Start St",
        "destination_company_name": "Manual Dest",
        "destination_address": "Manual Address",
        "distance_km": 100
    })
    req_id = req_resp.json()["id"]
    
    await async_client.post(f"/api/v1/customer/requests/{req_id}/cancel", json={"reason": "Test cancel"})
    
    response = await async_client.post(f"/api/v1/customer/requests/{req_id}/cancel", json={"reason": "Test cancel"})
    assert response.status_code == 400
