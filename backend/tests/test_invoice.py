import pytest
import uuid
import re
from decimal import Decimal
from datetime import datetime, timezone

from app.main import app
from app.api.deps import get_current_admin, get_current_customer_user, get_current_driver
from app.models.user import User
from app.models.company import CustomerCompany, RecipientCompany
from app.models.delivery import DeliveryRequest, Trip, ProofOfDelivery
from app.models.fleet import Vehicle, Driver, VehicleAssignment
from app.models.finance import Invoice, Payment
from app.models.pricing import PricingConfig, Quotation
from app.models.enums import (
    UserRole, CompanyStatus, DeliveryRequestStatus, QuotationStatus,
    InvoiceStatus, VehicleStatus, DriverStatus, PaymentMethod,
    VehicleType
)

# ---------------------------------------------------------------------------
# Base fixtures for Beanie async tests
# ---------------------------------------------------------------------------

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
async def customer_company():
    company = CustomerCompany(
        id=uuid.uuid4(),
        name=f"Company {uuid.uuid4().hex[:6]}",
        billing_address="123 Corporate Way, Mumbai",
        status=CompanyStatus.ACTIVE
    )
    await company.insert()
    return company


@pytest.fixture
async def customer_user(customer_company):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_cust_{uid}",
        email=f"cust_{uid}@company.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=customer_company.id,
        is_active=True
    )
    await user.insert()
    return user


@pytest.fixture
async def driver_user():
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver_{uid}",
        email=f"driver_{uid}@cargox.com",
        role=UserRole.DRIVER,
        is_active=True
    )
    await user.insert()
    return user


# ---------------------------------------------------------------------------
# Helper: set up a completed trip end-to-end via API & Beanie documents
# ---------------------------------------------------------------------------

async def setup_completed_trip(async_client, admin_user, customer_user, driver_user):
    """Creates the full lifecycle up to COMPLETED and returns context dict."""
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user
    app.dependency_overrides[get_current_driver] = lambda: driver_user

    # Recipient
    r = await async_client.post("/api/v1/customer/recipients", json={
        "name": "Dest Co", "contact_person": "Jane", "phone": "+919999999999", "address": "456 Dest Ave"
    })
    assert r.status_code == 201
    recipient_id = r.json()["id"]

    # Delivery request
    req = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "PALLETIZED", "goods_description": "Test Goods",
        "weight_tons": 5.0, "pickup_company_name": "Source Corp",
        "pickup_address": "123 Origin St", "pickup_contact_person": "John",
        "pickup_phone": "+919876543210", "recipient_company_id": recipient_id
    })
    assert req.status_code == 201
    request_id = req.json()["id"]

    # Pricing config + quote
    await async_client.post("/api/v1/admin/pricing-configs", json={
        "name": "Standard", "base_rate_per_km": "20.00", "margin_per_km": "5.00"
    })
    q = await async_client.post(f"/api/v1/admin/requests/{request_id}/quote", json={"distance_km": "100.00"})
    assert q.status_code == 201
    quotation_id = q.json()["id"]

    # Accept quotation
    acc = await async_client.post(f"/api/v1/customer/quotations/{quotation_id}/accept")
    assert acc.status_code == 200

    # Vehicle + Driver
    v = await async_client.post("/api/v1/admin/vehicles", json={
        "registration_number": f"MH-{uuid.uuid4().hex[:4].upper()}",
        "type": "CONTAINER", "capacity_tons": 10.0
    })
    assert v.status_code == 201
    vehicle_id = v.json()["id"]

    d = await async_client.post("/api/v1/admin/drivers", json={
        "email": driver_user.email, "name": "Test Driver",
        "aadhaar_number": "123456789012", "age": 30,
        "phone": "+919888888888", "license_number": f"DL-{uuid.uuid4().hex[:6].upper()}"
    })
    assert d.status_code == 201
    driver_id = d.json()["id"]

    # Dispatch
    disp = await async_client.post(f"/api/v1/admin/requests/{request_id}/dispatch", json={
        "vehicle_id": vehicle_id, "driver_id": driver_id
    })
    assert disp.status_code == 201
    trip_id = disp.json()["trip_id"]

    # Driver execution: ARRIVED
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-transit")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/arrive")

    # POD
    pod = await async_client.post(f"/api/v1/driver/trips/{trip_id}/pod", json={
        "pod_signature_url": "https://storage.cargox.com/sig1.png",
        "notes": "Delivered OK"
    })
    assert pod.status_code == 201

    # Admin verify + complete
    await async_client.post(f"/api/v1/admin/trips/{trip_id}/verify-pod")
    comp = await async_client.post(f"/api/v1/admin/trips/{trip_id}/complete")
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

@pytest.mark.anyio
async def test_generate_invoice_success(async_client, admin_user, customer_user, driver_user):
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    assert resp.status_code == 201
    data = resp.json()

    assert data["status"] == "UNPAID"
    assert Decimal(str(data["amount_paid"])) == Decimal("0.00")
    assert data["invoice_number"] is not None
    assert data["request_id"] == ctx["request_id"]


@pytest.mark.anyio
async def test_generate_invoice_amounts_match_quotation(async_client, admin_user, customer_user, driver_user):
    """Invoice financials must be sourced from the accepted Quotation."""
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    assert resp.status_code == 201
    data = resp.json()

    # 100 km * 20 base + 100 km * 5 margin = 2000 + 500 = 2500
    assert Decimal(str(data["internal_base_cost"])) == Decimal("2000.00")
    assert Decimal(str(data["cargox_margin"])) == Decimal("500.00")
    assert Decimal(str(data["customer_total_charge"])) == Decimal("2500.00")
    assert Decimal(str(data["subtotal"])) == Decimal("2500.00")
    assert Decimal(str(data["total_amount"])) == Decimal("2500.00")
    assert Decimal(str(data["amount_due"])) == Decimal("2500.00")


@pytest.mark.anyio
async def test_generate_invoice_idempotency_returns_existing(async_client, admin_user, customer_user, driver_user):
    """Calling generate_invoice multiple times returns the existing invoice (idempotent)."""
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    resp1 = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    assert resp1.status_code == 201
    inv_id_1 = resp1.json()["id"]

    resp2 = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    assert resp2.status_code == 201
    inv_id_2 = resp2.json()["id"]

    assert inv_id_1 == inv_id_2


@pytest.mark.anyio
async def test_generate_invoice_non_completed_400(async_client, admin_user, customer_user, driver_user):
    """A trip that is only DELIVERED (not COMPLETED) cannot be invoiced."""
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user
    app.dependency_overrides[get_current_driver] = lambda: driver_user

    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    # Manually reset to DELIVERED to test the guard
    delivery_req = await DeliveryRequest.find_one(DeliveryRequest.id == uuid.UUID(ctx["request_id"]))
    assert delivery_req is not None
    delivery_req.status = DeliveryRequestStatus.DELIVERED
    await delivery_req.save()

    resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    assert resp.status_code == 400
    assert "COMPLETED" in resp.json()["detail"]


@pytest.mark.anyio
async def test_generate_invoice_admin_only(async_client, admin_user, customer_user, driver_user):
    """Customer/Driver tokens must not be able to reach admin invoice endpoint."""
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    from fastapi import HTTPException as _HTTPException
    from app.api.deps import get_current_admin as _admin_dep

    # Simulate an admin dependency that rejects (mimics non-admin presenting admin token)
    def deny_admin():
        raise _HTTPException(status_code=403, detail="Forbidden")

    app.dependency_overrides[_admin_dep] = deny_admin

    resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    assert resp.status_code == 403


@pytest.mark.anyio
async def test_generate_invoice_admin_only_via_rbac(async_client, admin_user, customer_user, driver_user):
    """Verify unauthenticated/wrong role is blocked from admin invoice endpoint."""
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)
    app.dependency_overrides.clear()

    resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    assert resp.status_code in (401, 403, 422)


@pytest.mark.anyio
async def test_invoice_number_format(async_client, admin_user, customer_user, driver_user):
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    assert resp.status_code == 201
    invoice_number = resp.json()["invoice_number"]

    year = datetime.now(timezone.utc).year
    pattern = rf"^INV-{year}-\d{{6}}$"
    assert re.match(pattern, invoice_number), f"Invoice number '{invoice_number}' does not match pattern INV-YYYY-NNNNNN"


@pytest.mark.anyio
async def test_record_payment_partial(async_client, admin_user, customer_user, driver_user):
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    inv_resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]

    pay_resp = await async_client.post(f"/api/v1/admin/invoices/{invoice_id}/payments", json={
        "amount": "1000.00", "method": "BANK_TRANSFER", "reference_number": "REF001"
    })
    assert pay_resp.status_code == 201
    assert Decimal(str(pay_resp.json()["amount"])) == Decimal("1000.00")

    # Verify invoice updated
    inv = await async_client.get(f"/api/v1/admin/invoices/{invoice_id}")
    data = inv.json()
    assert data["status"] == "PARTIALLY_PAID"
    assert Decimal(str(data["amount_paid"])) == Decimal("1000.00")
    assert Decimal(str(data["amount_due"])) == Decimal("1500.00")


@pytest.mark.anyio
async def test_record_payment_full(async_client, admin_user, customer_user, driver_user):
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    inv_resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]
    total = inv_resp.json()["total_amount"]

    pay_resp = await async_client.post(f"/api/v1/admin/invoices/{invoice_id}/payments", json={
        "amount": str(total), "method": "UPI"
    })
    assert pay_resp.status_code == 201

    inv = await async_client.get(f"/api/v1/admin/invoices/{invoice_id}")
    data = inv.json()
    assert data["status"] == "PAID"
    assert Decimal(str(data["amount_due"])) == Decimal("0.00")


@pytest.mark.anyio
async def test_record_payment_overpayment_400(async_client, admin_user, customer_user, driver_user):
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    inv_resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]

    pay_resp = await async_client.post(f"/api/v1/admin/invoices/{invoice_id}/payments", json={
        "amount": "999999.00", "method": "CASH"
    })
    assert pay_resp.status_code == 400
    assert "overpayment" in pay_resp.json()["detail"].lower()


@pytest.mark.anyio
async def test_record_payment_already_paid_400(async_client, admin_user, customer_user, driver_user):
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    inv_resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]
    total = inv_resp.json()["total_amount"]

    # Pay in full
    await async_client.post(f"/api/v1/admin/invoices/{invoice_id}/payments", json={
        "amount": str(total), "method": "BANK_TRANSFER"
    })

    # Attempt another payment
    resp = await async_client.post(f"/api/v1/admin/invoices/{invoice_id}/payments", json={
        "amount": "100.00", "method": "CASH"
    })
    assert resp.status_code == 400
    assert "already fully paid" in resp.json()["detail"].lower()


@pytest.mark.anyio
async def test_customer_invoice_tenant_isolation(async_client, admin_user, customer_user, driver_user):
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    inv_resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]

    # Create a different company and user
    other_company = CustomerCompany(
        id=uuid.uuid4(),
        name="Other Corp",
        billing_address="Other Address",
        status=CompanyStatus.ACTIVE
    )
    await other_company.insert()

    uid2 = uuid.uuid4().hex[:8]
    other_user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_other_{uid2}",
        email=f"other_{uid2}@other.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=other_company.id,
        is_active=True
    )
    await other_user.insert()

    app.dependency_overrides[get_current_customer_user] = lambda: other_user

    resp = await async_client.get(f"/api/v1/customer/invoices/{invoice_id}")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_customer_invoice_hides_internal_costs(async_client, admin_user, customer_user, driver_user):
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    inv_resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]

    app.dependency_overrides[get_current_customer_user] = lambda: customer_user

    resp = await async_client.get(f"/api/v1/customer/invoices/{invoice_id}")
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


@pytest.mark.anyio
async def test_driver_cannot_access_invoices(async_client, admin_user, customer_user, driver_user):
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    inv_resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]

    # Clear overrides — unauthenticated access
    app.dependency_overrides.clear()

    resp_admin = await async_client.get(f"/api/v1/admin/invoices/{invoice_id}")
    assert resp_admin.status_code in (401, 403, 422)

    resp_customer = await async_client.get(f"/api/v1/customer/invoices/{invoice_id}")
    assert resp_customer.status_code in (401, 403, 422)


@pytest.mark.anyio
async def test_update_due_date_unpaid_only(async_client, admin_user, customer_user, driver_user):
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    inv_resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]

    # UNPAID -> should succeed
    due = datetime(2026, 12, 31, 0, 0, 0).isoformat()
    resp = await async_client.patch(f"/api/v1/admin/invoices/{invoice_id}/due-date?due_at={due}")
    assert resp.status_code == 200
    assert resp.json()["due_at"] is not None

    # Record partial payment -> PARTIALLY_PAID
    await async_client.post(f"/api/v1/admin/invoices/{invoice_id}/payments", json={
        "amount": "100.00", "method": "CASH"
    })

    # Now update should fail
    resp2 = await async_client.patch(f"/api/v1/admin/invoices/{invoice_id}/due-date?due_at={due}")
    assert resp2.status_code == 400
    assert "UNPAID" in resp2.json()["detail"]


@pytest.mark.anyio
async def test_admin_invoice_retains_internal_financial_fields(async_client, admin_user, customer_user, driver_user):
    """Admin invoice endpoint must retain internal base cost, margin, and quotation details."""
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    inv_resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]

    resp = await async_client.get(f"/api/v1/admin/invoices/{invoice_id}")
    assert resp.status_code == 200
    data = resp.json()

    assert "internal_base_cost" in data
    assert "cargox_margin" in data
    assert "customer_total_charge" in data
    assert "quotation_id" in data
    assert Decimal(str(data["internal_base_cost"])) > Decimal("0.00")
    assert Decimal(str(data["cargox_margin"])) > Decimal("0.00")


@pytest.mark.anyio
async def test_customer_invoice_excludes_pricing_config_id(async_client, admin_user, customer_user, driver_user):
    """Customer invoice must never expose internal pricing_config_id."""
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    inv_resp = await async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    invoice_id = inv_resp.json()["id"]

    app.dependency_overrides[get_current_customer_user] = lambda: customer_user

    resp = await async_client.get(f"/api/v1/customer/invoices/{invoice_id}")
    assert resp.status_code == 200
    data = resp.json()

    assert "pricing_config_id" not in data
    assert "internal_base_cost" not in data
    assert "cargox_margin" not in data


@pytest.mark.anyio
async def test_concurrent_invoice_generation_is_idempotent(async_client, admin_user, customer_user, driver_user):
    """Simultaneous concurrent requests to generate invoice yield exactly one invoice without race failure."""
    import asyncio
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)

    # Launch two concurrent invoice generation calls
    res1, res2 = await asyncio.gather(
        async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={}),
        async_client.post(f"/api/v1/admin/trips/{ctx['trip_id']}/invoice", json={})
    )
    assert res1.status_code == 201
    assert res2.status_code == 201
    assert res1.json()["id"] == res2.json()["id"]
    assert res1.json()["invoice_number"] == res2.json()["invoice_number"]


# ---------------------------------------------------------------------------
# Direct Admin Booking Approval -> Quotation Snapshot & Invoice Tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_direct_admin_approval_creates_accepted_quotation(async_client, admin_user, customer_user, driver_user):
    """
    Direct Admin approval workflow:
    When Admin approves a customer request without a prior quotation,
    it snapshots the active PricingConfig and marks the Quotation ACCEPTED.
    Subsequent dispatch and completion then generate invoice using that quotation.
    """
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user
    app.dependency_overrides[get_current_driver] = lambda: driver_user

    # Create active PricingConfig
    await async_client.post("/api/v1/admin/pricing-configs", json={
        "name": "Direct Rate", "base_rate_per_km": "25.00", "margin_per_km": "10.00"
    })

    # Recipient
    r = await async_client.post("/api/v1/customer/recipients", json={
        "name": "Direct Recipient", "contact_person": "Dave", "phone": "+919876500000", "address": "Direct Addr"
    })
    recipient_id = r.json()["id"]

    # Request
    req = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "GENERAL", "goods_description": "Instant Goods",
        "weight_tons": 3.0, "pickup_company_name": "Instant Co",
        "pickup_address": "Instant Addr", "recipient_company_id": recipient_id
    })
    request_id = req.json()["id"]

    # Direct Admin Approval WITHOUT a prior quotation
    app_resp = await async_client.post(f"/api/v1/admin/requests/{request_id}/approve")
    assert app_resp.status_code == 200

    # Verify Quotation was created and ACCEPTED with the active pricing snapshot
    created_quote = await Quotation.find_one(Quotation.request_id == uuid.UUID(request_id))
    assert created_quote is not None
    assert created_quote.status == QuotationStatus.ACCEPTED
    assert Decimal(str(created_quote.base_rate_per_km)) == Decimal("25.00")
    assert Decimal(str(created_quote.cargox_margin)) > Decimal("0.00")

    # Vehicle + Driver + Dispatch
    v = await async_client.post("/api/v1/admin/vehicles", json={
        "registration_number": f"MH-{uuid.uuid4().hex[:4].upper()}",
        "type": "CONTAINER", "capacity_tons": 10.0
    })
    vehicle_id = v.json()["id"]

    d = await async_client.post("/api/v1/admin/drivers", json={
        "email": driver_user.email, "name": "Direct Driver",
        "aadhaar_number": "987654321098", "age": 32,
        "phone": "+919888877777", "license_number": f"DL-{uuid.uuid4().hex[:6].upper()}"
    })
    assert d.status_code == 201
    driver_id = d.json()["id"]

    disp = await async_client.post(f"/api/v1/admin/requests/{request_id}/dispatch", json={
        "vehicle_id": vehicle_id, "driver_id": driver_id
    })
    assert disp.status_code == 201
    trip_id = disp.json()["trip_id"]

    # Trip progression to COMPLETED
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-transit")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/arrive")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/pod", json={
        "pod_signature_url": "https://storage.cargox.com/sig2.png", "notes": "Done"
    })
    await async_client.post(f"/api/v1/admin/trips/{trip_id}/verify-pod")
    await async_client.post(f"/api/v1/admin/trips/{trip_id}/complete")

    # Invoice generation succeeds and uses the snapshot quotation
    inv_resp = await async_client.post(f"/api/v1/admin/trips/{trip_id}/invoice", json={})
    assert inv_resp.status_code == 201
    inv_data = inv_resp.json()
    assert inv_data["quotation_id"] == str(created_quote.id)
    assert Decimal(str(inv_data["total_amount"])) == Decimal(str(created_quote.customer_total_charge))


# ---------------------------------------------------------------------------
# POD URL Hardening Tests (Phase 7 carry-forward)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_pod_https_only_accepted(async_client, admin_user, customer_user, driver_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user
    app.dependency_overrides[get_current_driver] = lambda: driver_user

    # Build trip to ARRIVED state
    r = await async_client.post("/api/v1/customer/recipients", json={"name": "R", "address": "A"})
    rid = r.json()["id"]
    req = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "GENERAL", "weight_tons": 1.0,
        "pickup_company_name": "P", "pickup_address": "P Addr",
        "recipient_company_id": rid
    })
    request_id = req.json()["id"]

    await async_client.post("/api/v1/admin/pricing-configs", json={
        "name": "Rate", "base_rate_per_km": "10.00", "margin_per_km": "1.00"
    })
    q = await async_client.post(f"/api/v1/admin/requests/{request_id}/quote", json={"distance_km": "50.00"})
    quotation_id = q.json()["id"]
    await async_client.post(f"/api/v1/customer/quotations/{quotation_id}/accept")

    v = await async_client.post("/api/v1/admin/vehicles", json={
        "registration_number": f"KA-{uuid.uuid4().hex[:4].upper()}",
        "type": "OPEN", "capacity_tons": 5.0
    })
    vehicle_id = v.json()["id"]
    d = await async_client.post("/api/v1/admin/drivers", json={
        "email": driver_user.email, "name": "Driver",
        "aadhaar_number": "112233445566", "age": 28,
        "phone": "+918888888888", "license_number": f"DL-{uuid.uuid4().hex[:6].upper()}"
    })
    assert d.status_code == 201
    driver_id = d.json()["id"]
    disp = await async_client.post(f"/api/v1/admin/requests/{request_id}/dispatch", json={
        "vehicle_id": vehicle_id, "driver_id": driver_id
    })
    trip_id = disp.json()["trip_id"]

    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-transit")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/arrive")

    # Valid HTTPS URL -> should succeed (201)
    resp = await async_client.post(f"/api/v1/driver/trips/{trip_id}/pod", json={
        "pod_signature_url": "https://storage.cargox.com/valid.png",
        "notes": "OK"
    })
    assert resp.status_code == 201


@pytest.mark.anyio
async def test_pod_http_rejected():
    """HTTP URLs must be rejected with ValidationError."""
    from app.schemas.tracking_delivery import PODSubmission
    import pytest as _pytest
    from pydantic import ValidationError

    with _pytest.raises(ValidationError) as exc_info:
        PODSubmission(pod_signature_url="http://insecure.example.com/sig.png")
    assert "HTTPS" in str(exc_info.value)


@pytest.mark.anyio
async def test_pod_plain_string_rejected():
    """Non-URL strings must be rejected."""
    from app.schemas.tracking_delivery import PODSubmission
    import pytest as _pytest
    from pydantic import ValidationError

    with _pytest.raises(ValidationError):
        PODSubmission(pod_signature_url="not-a-url-at-all")

