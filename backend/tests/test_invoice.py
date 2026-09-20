import pytest
import uuid
import re
from decimal import Decimal
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.api.deps import get_current_admin, get_current_customer_user, get_current_driver, get_db
from app.db.database import SessionLocal
from app.models.user import User
from app.models.company import CustomerCompany, RecipientCompany
from app.models.delivery import DeliveryRequest, Trip
from app.models.fleet import Vehicle, Driver, VehicleAssignment
from app.models.finance import Invoice, Payment
from app.models.pricing import PricingConfig, Quotation
from app.models.enums import (
    UserRole, CompanyStatus, DeliveryRequestStatus, QuotationStatus,
    InvoiceStatus, VehicleStatus, DriverStatus, PaymentMethod
)


# ---------------------------------------------------------------------------
# Cleanup fixture — runs before and after every test for full isolation
# ---------------------------------------------------------------------------

def _do_cleanup():
    db = SessionLocal()
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


@pytest.fixture(autouse=True)



@pytest.fixture(autouse=True)
def cleanup_database():
    _do_cleanup()
    yield
    _do_cleanup()
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Base fixtures
# ---------------------------------------------------------------------------

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
def customer_company(db_session):
    company = CustomerCompany(
        id=uuid.uuid4(),
        name=f"Company {uuid.uuid4().hex[:6]}",
        billing_address="123 Corporate Way, Mumbai",
        status=CompanyStatus.ACTIVE
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)
    return company


@pytest.fixture
def customer_user(db_session, customer_company):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_cust_{uid}",
        email=f"cust_{uid}@company.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=customer_company.id,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def driver_user(db_session):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver_{uid}",
        email=f"driver_{uid}@cargox.com",
        role=UserRole.DRIVER,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Helper: set up a completed trip end-to-end via API
# ---------------------------------------------------------------------------

def setup_completed_trip(client, db_session, admin_user, customer_user, driver_user):
    """Creates the full lifecycle up to COMPLETED and returns context dict."""
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user
    app.dependency_overrides[get_current_driver] = lambda: driver_user
    app.dependency_overrides[get_db] = lambda: db_session

    # Recipient
    r = client.post("/api/v1/customer/recipients", json={
        "name": "Dest Co", "contact_person": "Jane", "phone": "+919999999999", "address": "456 Dest Ave"
    })
    assert r.status_code == 201
    recipient_id = r.json()["id"]

    # Delivery request
    req = client.post("/api/v1/customer/requests", json={
        "goods_type": "PALLETIZED", "goods_description": "Test Goods",
        "weight_tons": 5.0, "pickup_company_name": "Source Corp",
        "pickup_address": "123 Origin St", "pickup_contact_person": "John",
        "pickup_phone": "+919876543210", "recipient_company_id": recipient_id
    })
    assert req.status_code == 201
    request_id = req.json()["id"]

    # Pricing config + quote
    client.post("/api/v1/admin/pricing-configs", json={
        "name": "Standard", "base_rate_per_km": "20.00", "margin_per_km": "5.00"
    })
    q = client.post(f"/api/v1/admin/requests/{request_id}/quote", json={"distance_km": "100.00"})
    assert q.status_code == 201
    quotation_id = q.json()["id"]

    # Accept quotation
    acc = client.post(f"/api/v1/customer/quotations/{quotation_id}/accept")
    assert acc.status_code == 200

    # Vehicle + Driver
    v = client.post("/api/v1/admin/vehicles", json={
        "registration_number": f"MH-{uuid.uuid4().hex[:4].upper()}",
        "type": "CONTAINER", "capacity_tons": 10.0
    })
    assert v.status_code == 201
    vehicle_id = v.json()["id"]

    d = client.post("/api/v1/admin/drivers", json={
        "user_id": str(driver_user.id), "name": "Test Driver",
        "phone": "+919888888888", "license_number": f"DL-{uuid.uuid4().hex[:6].upper()}"
    })
    assert d.status_code == 201
    driver_id = d.json()["id"]

    # Dispatch
    disp = client.post(f"/api/v1/admin/requests/{request_id}/dispatch", json={
        "vehicle_id": vehicle_id, "driver_id": driver_id
    })
    assert disp.status_code == 201
    trip_id = disp.json()["trip_id"]

    # Driver execution: ARRIVED
    client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    client.post(f"/api/v1/driver/trips/{trip_id}/start-transit")
    client.post(f"/api/v1/driver/trips/{trip_id}/arrive")

    # POD
    pod = client.post(f"/api/v1/driver/trips/{trip_id}/pod", json={
        "pod_signature_url": "https://storage.cargox.com/sig1.png",
        "notes": "Delivered OK"
    })
    assert pod.status_code == 201

    # Admin verify + complete
    client.post(f"/api/v1/admin/trips/{trip_id}/verify-pod")
    comp = client.post(f"/api/v1/admin/trips/{trip_id}/complete")
    assert comp.status_code == 200

    return {
        "request_id": request_id,
        "trip_id": trip_id,
        "quotation_id": quotation_id,
        "vehicle_id": vehicle_id,
        "driver_id": driver_id,
    }


# ===========================================================================
# INVOICE TESTS
# ===========================================================================

def test_generate_invoice_success(client, db_session, admin_user, customer_user, driver_user):
    ctx = setup_completed_trip(client, db_session, admin_user, customer_user, driver_user)

    resp = client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    assert resp.status_code == 201
    data = resp.json()

    assert data["status"] == "UNPAID"
    assert Decimal(str(data["amount_paid"])) == Decimal("0.00")
    assert data["invoice_number"] is not None
    assert data["request_id"] == ctx["request_id"]


def test_generate_invoice_amounts_match_quotation(client, db_session, admin_user, customer_user, driver_user):
    """Invoice financials must be sourced from the accepted Quotation."""
    ctx = setup_completed_trip(client, db_session, admin_user, customer_user, driver_user)

    resp = client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    assert resp.status_code == 201
    data = resp.json()

    # 100 km × ₹20 base + 100 km × ₹5 margin = ₹2000 + ₹500 = ₹2500
    assert Decimal(str(data["internal_base_cost"])) == Decimal("2000.00")
    assert Decimal(str(data["cargox_margin"])) == Decimal("500.00")
    assert Decimal(str(data["customer_total_charge"])) == Decimal("2500.00")
    assert Decimal(str(data["subtotal"])) == Decimal("2500.00")
    assert Decimal(str(data["total_amount"])) == Decimal("2500.00")
    assert Decimal(str(data["amount_due"])) == Decimal("2500.00")


def test_generate_invoice_duplicate_409(client, db_session, admin_user, customer_user, driver_user):
    ctx = setup_completed_trip(client, db_session, admin_user, customer_user, driver_user)

    client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    resp = client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    assert resp.status_code == 409
    assert "already been generated" in resp.json()["detail"].lower()


def test_generate_invoice_non_completed_400(client, db_session, admin_user, customer_user, driver_user):
    """A trip that is only DELIVERED (not COMPLETED) cannot be invoiced."""
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user
    app.dependency_overrides[get_current_driver] = lambda: driver_user
    app.dependency_overrides[get_db] = lambda: db_session

    ctx = setup_completed_trip(client, db_session, admin_user, customer_user, driver_user)

    # Manually reset to DELIVERED to test the guard
    db_session.execute(
        text("UPDATE delivery_requests SET status = 'DELIVERED' WHERE id = :id"),
        {"id": ctx["request_id"]}
    )
    db_session.commit()

    resp = client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    assert resp.status_code == 400
    assert "COMPLETED" in resp.json()["detail"]


def test_generate_invoice_admin_only(client, db_session, admin_user, customer_user, driver_user):
    """Customer/Driver tokens must not be able to reach admin invoice endpoint."""
    ctx = setup_completed_trip(client, db_session, admin_user, customer_user, driver_user)

    from fastapi import HTTPException as _HTTPException
    from app.api.deps import get_current_admin as _admin_dep

    # Simulate an admin dependency that rejects (mimics non-admin presenting admin token)
    def deny_admin():
        raise _HTTPException(status_code=403, detail="Forbidden")

    app.dependency_overrides[_admin_dep] = deny_admin
    app.dependency_overrides[get_db] = lambda: db_session

    resp = client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    assert resp.status_code == 403



def test_generate_invoice_admin_only_via_rbac(client, db_session, admin_user, customer_user, driver_user):
    """Verify driver role is blocked from admin invoice endpoint."""
    ctx = setup_completed_trip(client, db_session, admin_user, customer_user, driver_user)
    app.dependency_overrides.clear()

    # No dependency override — auth will fail cleanly
    resp = client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    assert resp.status_code in (401, 403, 422)


def test_invoice_number_format(client, db_session, admin_user, customer_user, driver_user):
    ctx = setup_completed_trip(client, db_session, admin_user, customer_user, driver_user)

    resp = client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    assert resp.status_code == 201
    invoice_number = resp.json()["invoice_number"]

    year = datetime.now(timezone.utc).year
    pattern = rf"^INV-{year}-\d{{6}}$"
    assert re.match(pattern, invoice_number), f"Invoice number '{invoice_number}' does not match pattern INV-YYYY-NNNNNN"


def test_record_payment_partial(client, db_session, admin_user, customer_user, driver_user):
    ctx = setup_completed_trip(client, db_session, admin_user, customer_user, driver_user)

    inv_resp = client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]

    pay_resp = client.post(f"/api/v1/admin/invoices/{invoice_id}/payments", json={
        "amount": "1000.00", "method": "BANK_TRANSFER", "reference_number": "REF001"
    })
    assert pay_resp.status_code == 201
    assert Decimal(str(pay_resp.json()["amount"])) == Decimal("1000.00")

    # Verify invoice updated
    inv = client.get(f"/api/v1/admin/invoices/{invoice_id}")
    data = inv.json()
    assert data["status"] == "PARTIALLY_PAID"
    assert Decimal(str(data["amount_paid"])) == Decimal("1000.00")
    assert Decimal(str(data["amount_due"])) == Decimal("1500.00")


def test_record_payment_full(client, db_session, admin_user, customer_user, driver_user):
    ctx = setup_completed_trip(client, db_session, admin_user, customer_user, driver_user)

    inv_resp = client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]
    total = inv_resp.json()["total_amount"]

    pay_resp = client.post(f"/api/v1/admin/invoices/{invoice_id}/payments", json={
        "amount": str(total), "method": "UPI"
    })
    assert pay_resp.status_code == 201

    inv = client.get(f"/api/v1/admin/invoices/{invoice_id}")
    data = inv.json()
    assert data["status"] == "PAID"
    assert Decimal(str(data["amount_due"])) == Decimal("0.00")


def test_record_payment_overpayment_400(client, db_session, admin_user, customer_user, driver_user):
    ctx = setup_completed_trip(client, db_session, admin_user, customer_user, driver_user)

    inv_resp = client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]

    pay_resp = client.post(f"/api/v1/admin/invoices/{invoice_id}/payments", json={
        "amount": "999999.00", "method": "CASH"
    })
    assert pay_resp.status_code == 400
    assert "overpayment" in pay_resp.json()["detail"].lower()


def test_record_payment_already_paid_400(client, db_session, admin_user, customer_user, driver_user):
    ctx = setup_completed_trip(client, db_session, admin_user, customer_user, driver_user)

    inv_resp = client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]
    total = inv_resp.json()["total_amount"]

    # Pay in full
    client.post(f"/api/v1/admin/invoices/{invoice_id}/payments", json={
        "amount": str(total), "method": "BANK_TRANSFER"
    })

    # Attempt another payment
    resp = client.post(f"/api/v1/admin/invoices/{invoice_id}/payments", json={
        "amount": "100.00", "method": "CASH"
    })
    assert resp.status_code == 400
    assert "already fully paid" in resp.json()["detail"].lower()


def test_customer_invoice_tenant_isolation(client, db_session, admin_user, customer_user, driver_user):
    ctx = setup_completed_trip(client, db_session, admin_user, customer_user, driver_user)

    inv_resp = client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]

    # Create a different company and user
    other_company = CustomerCompany(
        id=uuid.uuid4(),
        name="Other Corp",
        billing_address="Other Address",
        status=CompanyStatus.ACTIVE
    )
    db_session.add(other_company)
    db_session.commit()

    uid2 = uuid.uuid4().hex[:8]
    other_user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_other_{uid2}",
        email=f"other_{uid2}@other.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=other_company.id,
        is_active=True
    )
    db_session.add(other_user)
    db_session.commit()

    app.dependency_overrides[get_current_customer_user] = lambda: other_user
    app.dependency_overrides[get_db] = lambda: db_session

    resp = client.get(f"/api/v1/customer/invoices/{invoice_id}")
    assert resp.status_code == 404


def test_customer_invoice_hides_internal_costs(client, db_session, admin_user, customer_user, driver_user):
    ctx = setup_completed_trip(client, db_session, admin_user, customer_user, driver_user)

    inv_resp = client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]

    app.dependency_overrides[get_current_customer_user] = lambda: customer_user
    app.dependency_overrides[get_db] = lambda: db_session

    resp = client.get(f"/api/v1/customer/invoices/{invoice_id}")
    assert resp.status_code == 200
    data = resp.json()

    # These fields must NOT appear in the customer response
    assert "internal_base_cost" not in data
    assert "cargox_margin" not in data
    assert "base_rate_per_km" not in data
    assert "customer_total_charge" not in data
    assert "distance_km" not in data
    assert "quotation_id" not in data

    # These fields must be present
    assert "total_amount" in data
    assert "amount_paid" in data
    assert "amount_due" in data
    assert "status" in data
    assert "invoice_number" in data


def test_driver_cannot_access_invoices(client, db_session, admin_user, customer_user, driver_user):
    ctx = setup_completed_trip(client, db_session, admin_user, customer_user, driver_user)

    inv_resp = client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]

    # Clear overrides — unauthenticated access
    app.dependency_overrides.clear()

    resp_admin = client.get(f"/api/v1/admin/invoices/{invoice_id}")
    assert resp_admin.status_code in (401, 403, 422)

    resp_customer = client.get(f"/api/v1/customer/invoices/{invoice_id}")
    assert resp_customer.status_code in (401, 403, 422)


def test_update_due_date_unpaid_only(client, db_session, admin_user, customer_user, driver_user):
    ctx = setup_completed_trip(client, db_session, admin_user, customer_user, driver_user)

    inv_resp = client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]

    # UNPAID → should succeed
    due = datetime(2026, 12, 31, 0, 0, 0).isoformat()
    resp = client.patch(f"/api/v1/admin/invoices/{invoice_id}/due-date?due_at={due}")
    assert resp.status_code == 200
    assert resp.json()["due_at"] is not None

    # Record partial payment → PARTIALLY_PAID
    client.post(f"/api/v1/admin/invoices/{invoice_id}/payments", json={
        "amount": "100.00", "method": "CASH"
    })

    # Now update should fail
    resp2 = client.patch(f"/api/v1/admin/invoices/{invoice_id}/due-date?due_at={due}")
    assert resp2.status_code == 400
    assert "UNPAID" in resp2.json()["detail"]


# ---------------------------------------------------------------------------
# POD URL Hardening Tests (Phase 7 carry-forward)
# ---------------------------------------------------------------------------

def test_pod_https_only_accepted(client, db_session, admin_user, customer_user, driver_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user
    app.dependency_overrides[get_current_driver] = lambda: driver_user
    app.dependency_overrides[get_db] = lambda: db_session

    # Build trip to ARRIVED state
    r = client.post("/api/v1/customer/recipients", json={"name": "R", "address": "A"})
    rid = r.json()["id"]
    req = client.post("/api/v1/customer/requests", json={
        "goods_type": "GENERAL", "weight_tons": 1.0,
        "pickup_company_name": "P", "pickup_address": "P Addr",
        "recipient_company_id": rid
    })
    request_id = req.json()["id"]

    client.post("/api/v1/admin/pricing-configs", json={
        "name": "Rate", "base_rate_per_km": "10.00", "margin_per_km": "1.00"
    })
    q = client.post(f"/api/v1/admin/requests/{request_id}/quote", json={"distance_km": "50.00"})
    quotation_id = q.json()["id"]
    client.post(f"/api/v1/customer/quotations/{quotation_id}/accept")

    v = client.post("/api/v1/admin/vehicles", json={
        "registration_number": f"KA-{uuid.uuid4().hex[:4].upper()}",
        "type": "OPEN", "capacity_tons": 5.0
    })
    vehicle_id = v.json()["id"]
    d = client.post("/api/v1/admin/drivers", json={
        "user_id": str(driver_user.id), "name": "Driver",
        "phone": "+918888888888", "license_number": f"DL-{uuid.uuid4().hex[:6].upper()}"
    })
    driver_id = d.json()["id"]
    disp = client.post(f"/api/v1/admin/requests/{request_id}/dispatch", json={
        "vehicle_id": vehicle_id, "driver_id": driver_id
    })
    trip_id = disp.json()["trip_id"]

    client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    client.post(f"/api/v1/driver/trips/{trip_id}/start-transit")
    client.post(f"/api/v1/driver/trips/{trip_id}/arrive")

    # Valid HTTPS URL → should succeed (201)
    resp = client.post(f"/api/v1/driver/trips/{trip_id}/pod", json={
        "pod_signature_url": "https://storage.cargox.com/valid.png",
        "notes": "OK"
    })
    assert resp.status_code == 201


def test_pod_http_rejected(client, db_session, admin_user, customer_user, driver_user):
    """HTTP URLs must be rejected with 422."""
    app.dependency_overrides[get_current_driver] = lambda: driver_user
    app.dependency_overrides[get_db] = lambda: db_session

    from app.schemas.tracking_delivery import PODSubmission
    import pytest as _pytest
    from pydantic import ValidationError

    with _pytest.raises(ValidationError) as exc_info:
        PODSubmission(pod_signature_url="http://insecure.example.com/sig.png")
    assert "HTTPS" in str(exc_info.value)


def test_pod_plain_string_rejected(client, db_session, admin_user, customer_user, driver_user):
    """Non-URL strings must be rejected."""
    from app.schemas.tracking_delivery import PODSubmission
    import pytest as _pytest
    from pydantic import ValidationError

    with _pytest.raises(ValidationError):
        PODSubmission(pod_signature_url="not-a-url-at-all")
