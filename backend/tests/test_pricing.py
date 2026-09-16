import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import uuid
from sqlalchemy import text

from app.main import app
from app.api.deps import get_current_admin, get_current_customer_user, get_db
from app.models.user import User
from app.models.company import CustomerCompany, RecipientCompany
from app.models.delivery import DeliveryRequest
from app.models.pricing import PricingConfig, Quotation
from app.models.enums import UserRole, CompanyStatus, DeliveryRequestStatus, QuotationStatus
from app.db.database import SessionLocal

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(autouse=True)
def cleanup_database():
    def _do_cleanup():
        db = SessionLocal()
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

    _do_cleanup()   # Setup: ensure a clean slate before each test
    yield
    _do_cleanup()   # Teardown: clean up after each test
    app.dependency_overrides.clear()


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
def customer_company_a(db_session):
    company = CustomerCompany(
        id=uuid.uuid4(),
        name=f"Company A {uuid.uuid4().hex[:6]}",
        billing_address="123 Alpha St, Mumbai",
        status=CompanyStatus.ACTIVE
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)
    return company

@pytest.fixture
def customer_user_a(db_session, customer_company_a):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_cust_a_{uid}",
        email=f"cust_a_{uid}@alpha.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=customer_company_a.id,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def customer_company_b(db_session):
    company = CustomerCompany(
        id=uuid.uuid4(),
        name=f"Company B {uuid.uuid4().hex[:6]}",
        billing_address="456 Beta St, Pune",
        status=CompanyStatus.ACTIVE
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)
    return company

@pytest.fixture
def customer_user_b(db_session, customer_company_b):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_cust_b_{uid}",
        email=f"cust_b_{uid}@beta.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=customer_company_b.id,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def recipient_a(db_session, customer_company_a):
    rec = RecipientCompany(
        id=uuid.uuid4(),
        customer_company_id=customer_company_a.id,
        name="Recipient A",
        phone="9876543210",
        address="789 Gamma St, Delhi"
    )
    db_session.add(rec)
    db_session.commit()
    db_session.refresh(rec)
    return rec

@pytest.fixture
def delivery_request_a(db_session, customer_company_a, recipient_a):
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
    db_session.add(req)
    db_session.commit()
    db_session.refresh(req)
    return req

@pytest.fixture
def active_pricing_config(db_session, admin_user):
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
    db_session.add(config)
    db_session.commit()
    db_session.refresh(config)
    return config

# ----------------------------------------------------------------------
# TESTS
# ----------------------------------------------------------------------

def test_pricing_config_singleton(client, db_session, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    # Create config 1
    resp1 = client.post("/api/v1/admin/pricing-configs", json={
        "base_rate_per_km": "20.00",
        "margin_per_km": "2.00"
    })
    assert resp1.status_code == 201
    cfg1 = resp1.json()
    assert cfg1["active"] is True

    # Create config 2
    resp2 = client.post("/api/v1/admin/pricing-configs", json={
        "base_rate_per_km": "25.00",
        "margin_per_km": "3.00"
    })
    assert resp2.status_code == 201
    cfg2 = resp2.json()
    assert cfg2["active"] is True

    # Verify config 1 is now inactive
    db_cfg1 = db_session.query(PricingConfig).filter(PricingConfig.id == cfg1["id"]).first()
    assert db_cfg1.active is False

    # Get active config
    resp_active = client.get("/api/v1/admin/pricing-configs/active")
    assert resp_active.status_code == 200
    assert resp_active.json()["id"] == cfg2["id"]

def test_pricing_config_validation(client, db_session, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    # Invalid base_rate <= 0
    resp = client.post("/api/v1/admin/pricing-configs", json={
        "base_rate_per_km": "0.00",
        "margin_per_km": "2.00"
    })
    assert resp.status_code == 422

    # Invalid margin < 0
    resp = client.post("/api/v1/admin/pricing-configs", json={
        "base_rate_per_km": "10.00",
        "margin_per_km": "-1.00"
    })
    assert resp.status_code == 422

def test_generate_quotation_success(client, db_session, admin_user, active_pricing_config, delivery_request_a):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    # 250 km: base = 250*20 = 5000, margin = 250*2 = 500, total = 5500
    resp = client.post(f"/api/v1/admin/requests/{delivery_request_a.id}/quote", json={
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
    db_session.refresh(delivery_request_a)
    assert delivery_request_a.status == DeliveryRequestStatus.QUOTED

def test_generate_quotation_mutex(client, db_session, admin_user, active_pricing_config, delivery_request_a):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    # Generate 1st quotation (updates request status to QUOTED)
    client.post(f"/api/v1/admin/requests/{delivery_request_a.id}/quote", json={"distance_km": "100.00"})

    # Reset request status to SUBMITTED for mutex test
    delivery_request_a.status = DeliveryRequestStatus.SUBMITTED
    db_session.commit()

    # Attempt 2nd quotation while 1st is still PENDING -> should fail with 409
    resp = client.post(f"/api/v1/admin/requests/{delivery_request_a.id}/quote", json={"distance_km": "100.00"})
    assert resp.status_code == 409
    assert "pending quotation already exists" in resp.json()["detail"].lower()

def test_generate_quotation_invalid_request_state(client, db_session, admin_user, active_pricing_config, delivery_request_a):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    # Set request to ACCEPTED
    delivery_request_a.status = DeliveryRequestStatus.ACCEPTED
    db_session.commit()

    resp = client.post(f"/api/v1/admin/requests/{delivery_request_a.id}/quote", json={"distance_km": "100.00"})
    assert resp.status_code == 400
    assert "cannot generate quotation" in resp.json()["detail"].lower()

def test_customer_quotation_tenant_isolation(client, db_session, admin_user, customer_user_a, customer_user_b, active_pricing_config, delivery_request_a):
    # Admin generates quotation for company A request
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    resp_quote = client.post(f"/api/v1/admin/requests/{delivery_request_a.id}/quote", json={"distance_km": "100.00"})
    quot_id = resp_quote.json()["id"]

    # Customer A (owner) fetches -> 200 OK, internal fields hidden
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user_a
    resp_a = client.get(f"/api/v1/customer/quotations/{quot_id}")
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert "customer_total_charge" in data_a
    assert "internal_base_cost" not in data_a
    assert "cargox_margin" not in data_a

    # Customer B (unauthorized tenant) fetches -> 404 Not Found (IDOR protection)
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user_b
    resp_b = client.get(f"/api/v1/customer/quotations/{quot_id}")
    assert resp_b.status_code == 404

def test_customer_accept_quotation_success(client, db_session, admin_user, customer_user_a, active_pricing_config, delivery_request_a):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    resp_quote = client.post(f"/api/v1/admin/requests/{delivery_request_a.id}/quote", json={"distance_km": "100.00"})
    quot_id = resp_quote.json()["id"]

    # Customer A accepts quotation
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user_a
    resp_accept = client.post(f"/api/v1/customer/quotations/{quot_id}/accept")
    assert resp_accept.status_code == 200
    q_data = resp_accept.json()
    assert q_data["status"] == "ACCEPTED"
    assert q_data["accepted_at"] is not None

    # Verify DeliveryRequest state updated to ACCEPTED
    db_session.refresh(delivery_request_a)
    assert delivery_request_a.status == DeliveryRequestStatus.ACCEPTED

def test_customer_reject_quotation_success(client, db_session, admin_user, customer_user_a, active_pricing_config, delivery_request_a):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    resp_quote = client.post(f"/api/v1/admin/requests/{delivery_request_a.id}/quote", json={"distance_km": "100.00"})
    quot_id = resp_quote.json()["id"]

    # Customer A rejects quotation
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user_a
    resp_reject = client.post(f"/api/v1/customer/quotations/{quot_id}/reject")
    assert resp_reject.status_code == 200
    q_data = resp_reject.json()
    assert q_data["status"] == "REJECTED"

    # Verify DeliveryRequest state updated to REJECTED
    db_session.refresh(delivery_request_a)
    assert delivery_request_a.status == DeliveryRequestStatus.REJECTED

def test_lazy_expiration(client, db_session, customer_user_a, active_pricing_config, delivery_request_a):
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
    db_session.add(expired_quotation)
    delivery_request_a.status = DeliveryRequestStatus.QUOTED
    db_session.commit()

    # Customer tries to fetch -> status lazily transitions to EXPIRED
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user_a
    app.dependency_overrides[get_db] = lambda: db_session

    resp_get = client.get(f"/api/v1/customer/quotations/{expired_quotation.id}")
    assert resp_get.status_code == 200
    assert resp_get.json()["status"] == "EXPIRED"

    # Customer tries to accept -> returns 409 Conflict
    resp_accept = client.post(f"/api/v1/customer/quotations/{expired_quotation.id}/accept")
    assert resp_accept.status_code == 409
    assert "expired" in resp_accept.json()["detail"].lower()
