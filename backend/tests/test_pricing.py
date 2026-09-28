import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import uuid

from app.main import app
from app.api.deps import get_current_admin, get_current_customer_user
from app.models.user import User
from app.models.company import CustomerCompany, RecipientCompany
from app.models.delivery import DeliveryRequest
from app.models.pricing import PricingConfig, Quotation
from app.models.enums import UserRole, CompanyStatus, DeliveryRequestStatus, QuotationStatus

@pytest.fixture(autouse=True)
def cleanup_database():
    yield
    app.dependency_overrides.clear()

@pytest.fixture
async def admin_user():
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_admin_{uid}",
        email=f"admin_{uid}@cargox.com",
        role=UserRole.ADMIN,
        is_active=True
    )
    await user.insert()
    return user

@pytest.fixture
async def customer_company_a():
    company = CustomerCompany(
        id=uuid.uuid4(),
        name=f"Company A {uuid.uuid4().hex[:6]}",
        billing_address="123 Alpha St, Mumbai",
        status=CompanyStatus.ACTIVE
    )
    await company.insert()
    return company

@pytest.fixture
async def customer_user_a(customer_company_a):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_cust_a_{uid}",
        email=f"cust_a_{uid}@alpha.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=customer_company_a.id,
        is_active=True
    )
    await user.insert()
    return user

@pytest.fixture
async def customer_company_b():
    company = CustomerCompany(
        id=uuid.uuid4(),
        name=f"Company B {uuid.uuid4().hex[:6]}",
        billing_address="456 Beta St, Pune",
        status=CompanyStatus.ACTIVE
    )
    await company.insert()
    return company

@pytest.fixture
async def customer_user_b(customer_company_b):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_cust_b_{uid}",
        email=f"cust_b_{uid}@beta.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=customer_company_b.id,
        is_active=True
    )
    await user.insert()
    return user

@pytest.fixture
async def recipient_a(customer_company_a):
    rec = RecipientCompany(
        id=uuid.uuid4(),
        customer_company_id=customer_company_a.id,
        name="Recipient A",
        phone="9876543210",
        address="789 Gamma St, Delhi"
    )
    await rec.insert()
    return rec

@pytest.fixture
async def delivery_request_a(customer_company_a, recipient_a):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    req = DeliveryRequest(
        id=uuid.uuid4(),
        request_number=f"REQ-{uuid.uuid4().hex[:6].upper()}",
        customer_company_id=customer_company_a.id,
        recipient_company_id=recipient_a.id,
        pickup_company_name="Sender Co",
        pickup_address="123 Alpha St, Mumbai",
        destination_company_name=recipient_a.name,
        destination_address=recipient_a.address,
        goods_type="GENERAL",
        weight_tons=10.0,
        distance_km=250.0,
        status=DeliveryRequestStatus.SUBMITTED,
        created_at=now,
        updated_at=now
    )
    await req.insert()
    return req

@pytest.fixture
async def active_pricing_config(admin_user):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    config = PricingConfig(
        id=uuid.uuid4(),
        base_rate_per_km=Decimal("20.00"),
        margin_per_km=Decimal("2.00"),
        effective_from=now,
        active=True,
        created_by=admin_user.id,
        created_at=now
    )
    await config.insert()
    return config

# ----------------------------------------------------------------------
# TESTS
# ----------------------------------------------------------------------

@pytest.mark.anyio
async def test_pricing_config_singleton(async_client: AsyncClient, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    # Create config 1
    resp1 = await async_client.post("/api/v1/admin/pricing-configs", json={
        "base_rate_per_km": "20.00",
        "margin_per_km": "2.00"
    })
    assert resp1.status_code == 201
    cfg1 = resp1.json()
    assert cfg1["active"] is True

    # Create config 2
    resp2 = await async_client.post("/api/v1/admin/pricing-configs", json={
        "base_rate_per_km": "25.00",
        "margin_per_km": "3.00"
    })
    assert resp2.status_code == 201
    cfg2 = resp2.json()
    assert cfg2["active"] is True

    # Verify config 1 is now inactive
    db_cfg1 = await PricingConfig.get(cfg1["id"])
    assert db_cfg1.active is False

    # Get active config
    resp_active = await async_client.get("/api/v1/admin/pricing-configs/active")
    assert resp_active.status_code == 200
    assert resp_active.json()["id"] == cfg2["id"]

@pytest.mark.anyio
async def test_pricing_config_validation(async_client: AsyncClient, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    # Invalid base_rate <= 0
    resp = await async_client.post("/api/v1/admin/pricing-configs", json={
        "base_rate_per_km": "0.00",
        "margin_per_km": "2.00"
    })
    assert resp.status_code == 422

    # Invalid margin < 0
    resp = await async_client.post("/api/v1/admin/pricing-configs", json={
        "base_rate_per_km": "10.00",
        "margin_per_km": "-1.00"
    })
    assert resp.status_code == 422

@pytest.mark.anyio
async def test_generate_quotation_success(async_client: AsyncClient, admin_user, active_pricing_config, delivery_request_a):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    # 250 km: base = 250*20 = 5000, margin = 250*2 = 500, total = 5500
    resp = await async_client.post(f"/api/v1/admin/requests/{delivery_request_a.id}/quote", json={
        "distance_km": "250.00",
        "validity_hours": 48
    })
    assert resp.status_code == 201
    q = resp.json()

    assert Decimal(str(q["distance_km"])) == Decimal("250.00")
    assert Decimal(str(q["base_rate_per_km"])) == Decimal("20.00")
    assert Decimal(str(q["internal_base_cost"])) == Decimal("5000.00")
    assert Decimal(str(q["cargox_margin"])) == Decimal("500.00")
    assert Decimal(str(q["customer_total_charge"])) == Decimal("5500.00")
    assert q["status"] == "PENDING"

    # Verify delivery request status updated to QUOTED
    req = await DeliveryRequest.get(delivery_request_a.id)
    assert req.status == DeliveryRequestStatus.QUOTED

@pytest.mark.anyio
async def test_generate_quotation_mutex(async_client: AsyncClient, admin_user, active_pricing_config, delivery_request_a):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    # Generate 1st quotation (updates request status to QUOTED)
    await async_client.post(f"/api/v1/admin/requests/{delivery_request_a.id}/quote", json={"distance_km": "100.00"})

    # Reset request status to SUBMITTED for mutex test
    req = await DeliveryRequest.get(delivery_request_a.id)
    req.status = DeliveryRequestStatus.SUBMITTED
    await req.save()

    # Attempt 2nd quotation while 1st is still PENDING -> should fail with 409
    resp = await async_client.post(f"/api/v1/admin/requests/{delivery_request_a.id}/quote", json={"distance_km": "100.00"})
    assert resp.status_code == 409
    assert "pending quotation already exists" in resp.json()["detail"].lower()

@pytest.mark.anyio
async def test_generate_quotation_invalid_request_state(async_client: AsyncClient, admin_user, active_pricing_config, delivery_request_a):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    # Set request to ACCEPTED
    delivery_request_a.status = DeliveryRequestStatus.ACCEPTED
    await delivery_request_a.save()

    resp = await async_client.post(f"/api/v1/admin/requests/{delivery_request_a.id}/quote", json={"distance_km": "100.00"})
    assert resp.status_code == 400
    assert "cannot generate quotation" in resp.json()["detail"].lower()

@pytest.mark.anyio
async def test_customer_quotation_tenant_isolation(async_client: AsyncClient, admin_user, customer_user_a, customer_user_b, active_pricing_config, delivery_request_a):
    # Admin generates quotation for company A request
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    resp_quote = await async_client.post(f"/api/v1/admin/requests/{delivery_request_a.id}/quote", json={"distance_km": "100.00"})
    quot_id = resp_quote.json()["id"]

    # Customer A (owner) fetches -> 200 OK, internal fields hidden
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user_a
    resp_a = await async_client.get(f"/api/v1/customer/quotations/{quot_id}")
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert "customer_total_charge" in data_a
    assert "internal_base_cost" not in data_a
    assert "cargox_margin" not in data_a

    # Customer B (unauthorized tenant) fetches -> 404 Not Found (IDOR protection)
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user_b
    resp_b = await async_client.get(f"/api/v1/customer/quotations/{quot_id}")
    assert resp_b.status_code == 404

@pytest.mark.anyio
async def test_customer_accept_quotation_success(async_client: AsyncClient, admin_user, customer_user_a, active_pricing_config, delivery_request_a):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    resp_quote = await async_client.post(f"/api/v1/admin/requests/{delivery_request_a.id}/quote", json={"distance_km": "100.00"})
    quot_id = resp_quote.json()["id"]

    # Customer A accepts quotation
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user_a
    resp_accept = await async_client.post(f"/api/v1/customer/quotations/{quot_id}/accept")
    assert resp_accept.status_code == 200
    q_data = resp_accept.json()
    assert q_data["status"] == "ACCEPTED"
    assert q_data["accepted_at"] is not None

    # Verify DeliveryRequest state updated to ACCEPTED
    req = await DeliveryRequest.get(delivery_request_a.id)
    assert req.status == DeliveryRequestStatus.ACCEPTED

@pytest.mark.anyio
async def test_customer_reject_quotation_success(async_client: AsyncClient, admin_user, customer_user_a, active_pricing_config, delivery_request_a):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    resp_quote = await async_client.post(f"/api/v1/admin/requests/{delivery_request_a.id}/quote", json={"distance_km": "100.00"})
    quot_id = resp_quote.json()["id"]

    # Customer A rejects quotation
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user_a
    resp_reject = await async_client.post(f"/api/v1/customer/quotations/{quot_id}/reject")
    assert resp_reject.status_code == 200
    q_data = resp_reject.json()
    assert q_data["status"] == "REJECTED"

    # Verify DeliveryRequest state updated to REJECTED
    req = await DeliveryRequest.get(delivery_request_a.id)
    assert req.status == DeliveryRequestStatus.REJECTED

@pytest.mark.anyio
async def test_lazy_expiration(async_client: AsyncClient, customer_user_a, active_pricing_config, delivery_request_a):
    # Manually create an expired quotation
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    expired_quotation = Quotation(
        id=uuid.uuid4(),
        request_id=delivery_request_a.id,
        pricing_config_id=active_pricing_config.id,
        distance_km=Decimal("100.00"),
        base_rate_per_km=Decimal("20.00"),
        internal_base_cost=Decimal("2000.00"),
        cargox_margin=Decimal("200.00"),
        customer_total_charge=Decimal("2200.00"),
        status=QuotationStatus.PENDING,
        created_at=now - timedelta(hours=30),
        expires_at=now - timedelta(hours=6)
    )
    await expired_quotation.insert()
    delivery_request_a.status = DeliveryRequestStatus.QUOTED
    await delivery_request_a.save()

    # Customer tries to fetch -> status lazily transitions to EXPIRED
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user_a

    resp_get = await async_client.get(f"/api/v1/customer/quotations/{expired_quotation.id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["status"] == "EXPIRED"

    # Customer tries to accept -> returns 409 Conflict
    resp_accept = await async_client.post(f"/api/v1/customer/quotations/{expired_quotation.id}/accept")
    assert resp_accept.status_code == 409
    assert "expired" in resp_accept.json()["detail"].lower()
