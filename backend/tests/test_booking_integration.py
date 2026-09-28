import pytest
from httpx import AsyncClient
from app.main import app
from app.api.deps import get_current_customer_user, get_current_admin
from app.models.user import User
from app.models.enums import UserRole
from app.models.company import CustomerCompany
from app.models.enums import CompanyStatus
import uuid

customer_a_id = uuid.uuid4()
customer_b_id = uuid.uuid4()

def override_get_current_customer_a():
    return User(id=uuid.uuid4(), role=UserRole.CUSTOMER_USER, customer_company_id=customer_a_id, email="test_a@example.com")

def override_get_current_customer_b():
    return User(id=uuid.uuid4(), role=UserRole.CUSTOMER_USER, customer_company_id=customer_b_id, email="test_b@example.com")

def override_get_current_admin():
    return User(id=uuid.uuid4(), role=UserRole.ADMIN, email="admin@example.com")

@pytest.fixture(autouse=True)
async def setup_integration_env():
    comp_a = CustomerCompany(id=customer_a_id, name="ABC Company", billing_address="Addr A", status=CompanyStatus.ACTIVE)
    comp_b = CustomerCompany(id=customer_b_id, name="XYZ Company", billing_address="Addr B", status=CompanyStatus.ACTIVE)
    await comp_a.insert()
    await comp_b.insert()
    
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_a
    app.dependency_overrides[get_current_admin] = override_get_current_admin
    
    yield
    
    app.dependency_overrides.clear()

@pytest.mark.anyio
async def test_1_customer_submits_booking(async_client: AsyncClient):
    """TEST 1: Customer submits booking -> DeliveryRequest created -> status = SUBMITTED"""
    response = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "Cotton",
        "weight_tons": 10.0,
        "pickup_company_name": "Pickup Co",
        "pickup_address": "123 Start St",
        "destination_company_name": "Dest Co",
        "destination_address": "456 End St",
        "distance_km": 100
    })
    
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "SUBMITTED"
    assert data["goods_type"] == "Cotton"
    assert "request_number" in data

@pytest.mark.anyio
async def test_2_admin_requests_list_shows_submitted(async_client: AsyncClient):
    """TEST 2: Admin requests list -> submitted request appears"""
    create_resp = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "Steel",
        "weight_tons": 5.0,
        "pickup_company_name": "Pickup",
        "pickup_address": "Addr 1",
        "destination_company_name": "Dest",
        "destination_address": "Addr 2",
        "distance_km": 100
    })
    req_id = create_resp.json()["id"]

    admin_resp = await async_client.get("/api/v1/admin/requests")
    assert admin_resp.status_code == 200
    requests = admin_resp.json()
    assert any(r["id"] == req_id for r in requests)

@pytest.mark.anyio
async def test_3_customer_request_list(async_client: AsyncClient):
    """TEST 3: Customer request list -> customer's request appears"""
    create_resp = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "Plastic",
        "weight_tons": 2.0,
        "pickup_company_name": "P",
        "pickup_address": "P",
        "destination_company_name": "D",
        "destination_address": "D",
        "distance_km": 100
    })
    req_id = create_resp.json()["id"]
    
    list_resp = await async_client.get("/api/v1/customer/requests")
    assert list_resp.status_code == 200
    requests = list_resp.json()
    assert any(r["id"] == req_id for r in requests)

@pytest.mark.anyio
async def test_4_customer_isolation(async_client: AsyncClient):
    """TEST 4: Customer A cannot access Customer B request"""
    create_resp = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "Glass",
        "weight_tons": 1.0,
        "pickup_company_name": "P",
        "pickup_address": "P",
        "destination_company_name": "D",
        "destination_address": "D",
        "distance_km": 100
    })
    req_id = create_resp.json()["id"]
    
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_b
    get_resp = await async_client.get(f"/api/v1/customer/requests/{req_id}")
    assert get_resp.status_code == 404

@pytest.mark.anyio
async def test_5_customer_cannot_access_admin_endpoints(async_client: AsyncClient):
    """TEST 5: Customer cannot access /api/v1/admin/requests"""
    app.dependency_overrides.pop(get_current_admin, None)
    
    response = await async_client.get("/api/v1/admin/requests")
    assert response.status_code == 401

@pytest.mark.anyio
async def test_6_non_admin_cannot_access_admin_requests(async_client: AsyncClient):
    """TEST 6: Non-admin cannot access admin requests"""
    app.dependency_overrides.pop(get_current_admin, None)
    response = await async_client.get("/api/v1/admin/requests")
    assert response.status_code == 401

@pytest.mark.anyio
async def test_7_admin_can_access_submitted_requests(async_client: AsyncClient):
    """TEST 7: Admin can access submitted requests"""
    admin_resp = await async_client.get("/api/v1/admin/requests")
    assert admin_resp.status_code == 200

@pytest.mark.anyio
async def test_8_correct_customer_company_id_derived(async_client: AsyncClient):
    """TEST 8: Created request contains correct customer_company_id derived from authenticated user"""
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_b
    create_resp = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "Wood",
        "weight_tons": 4.0,
        "pickup_company_name": "P",
        "pickup_address": "P",
        "destination_company_name": "D",
        "destination_address": "D",
        "distance_km": 100
    })
    assert create_resp.status_code == 201
    
    from app.models.delivery import DeliveryRequest
    req = await DeliveryRequest.get(uuid.UUID(create_resp.json()["id"]))
    assert req.customer_company_id == customer_b_id

@pytest.mark.anyio
async def test_9_client_cannot_spoof_customer_company_id(async_client: AsyncClient):
    """TEST 9: Client cannot spoof customer_company_id"""
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer_a
    create_resp = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "Wood",
        "weight_tons": 4.0,
        "pickup_company_name": "P",
        "pickup_address": "P",
        "destination_company_name": "D",
        "destination_address": "D",
        "distance_km": 100,
        "customer_company_id": str(customer_b_id)
    })
    
    if create_resp.status_code == 201:
        from app.models.delivery import DeliveryRequest
        req = await DeliveryRequest.get(uuid.UUID(create_resp.json()["id"]))
        assert req.customer_company_id == customer_a_id
    else:
        assert create_resp.status_code == 422

@pytest.mark.anyio
async def test_10_no_mock_data(async_client: AsyncClient):
    """TEST 10: No mock/hardcoded request is required for Admin display"""
    admin_resp = await async_client.get("/api/v1/admin/requests")
    assert admin_resp.status_code == 200
    assert admin_resp.json() == []

@pytest.mark.anyio
async def test_11_refresh_admin_page(async_client: AsyncClient):
    """TEST 11: After customer submission, refreshing Admin request page retrieves the request from backend/database."""
    await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "Oil",
        "weight_tons": 10.0,
        "pickup_company_name": "A",
        "pickup_address": "A",
        "destination_company_name": "B",
        "destination_address": "B",
        "distance_km": 100
    })
    admin_resp = await async_client.get("/api/v1/admin/requests")
    assert len(admin_resp.json()) == 1
    assert admin_resp.json()[0]["goods_type"] == "Oil"
