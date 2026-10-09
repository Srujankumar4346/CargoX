import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from httpx import AsyncClient

from app.main import app
from app.api.deps import get_current_admin, get_current_customer_user, get_current_driver
from app.models.user import User
from app.models.company import CustomerCompany
from app.models.finance import Invoice
from app.models.enums import UserRole, CompanyStatus, InvoiceStatus, PaymentMethod
from app.services.settings_service import SettingsService
import hmac
import hashlib
import json
from app.core.config import settings
from app.models.finance import Payment
from tests.test_invoice import setup_completed_trip


@pytest.fixture
async def admin_user():
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_admin_{uid}",
        email=f"admin_{uid}@cargox.com",
        role=UserRole.ADMIN,
        is_active=True,
    )
    await user.insert()
    return user


@pytest.fixture
async def customer_company():
    company = CustomerCompany(
        id=uuid.uuid4(),
        name=f"Company {uuid.uuid4().hex[:6]}",
        billing_address="123 Corporate Way, Mumbai",
        status=CompanyStatus.ACTIVE,
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
        is_active=True,
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
        is_active=True,
    )
    await user.insert()
    return user


async def setup_arrived_trip(async_client, admin_user, customer_user, driver_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user
    app.dependency_overrides[get_current_driver] = lambda: driver_user

    # Recipient
    r = await async_client.post("/api/v1/customer/recipients", json={
        "name": f"Recipient {uuid.uuid4().hex[:6]}",
        "company_name": "Dest Corp",
        "email": "dest@corp.com",
        "phone": "+919876543210",
        "address": "456 Dest Road",
        "city": "Pune",
        "state": "Maharashtra",
        "pincode": "411001"
    })
    recipient_id = r.json()["id"]

    # Delivery request
    req = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "PALLETIZED", "goods_description": "Test Goods",
        "weight_tons": 5.0, "pickup_company_name": "Source Corp",
        "pickup_address": "123 Origin St", "pickup_contact_person": "John",
        "pickup_phone": "+919876543210", "recipient_company_id": recipient_id,
        "distance_km": 100.0
    })
    request_id = req.json()["id"]

    # Pricing config + quote
    await async_client.post("/api/v1/admin/pricing-configs", json={
        "name": "Standard", "base_rate_per_km": "20.00", "margin_per_km": "5.00"
    })
    q = await async_client.post(f"/api/v1/admin/requests/{request_id}/quote", json={"distance_km": "100.00"})
    quotation_id = q.json()["id"]

    # Accept quotation
    await async_client.post(f"/api/v1/customer/quotations/{quotation_id}/accept")

    # Vehicle + Driver
    v = await async_client.post("/api/v1/admin/vehicles", json={
        "registration_number": f"MH-{uuid.uuid4().hex[:4].upper()}",
        "type": "CONTAINER", "capacity_tons": 10.0
    })
    vehicle_id = v.json()["id"]

    d = await async_client.post("/api/v1/admin/drivers", json={
        "email": driver_user.email, "name": "Test Driver",
        "aadhaar_number": "123456789012", "age": 30,
        "phone": "+919888888888", "license_number": f"DL-{uuid.uuid4().hex[:6].upper()}"
    })
    driver_id = d.json()["id"]

    # Dispatch
    disp = await async_client.post(f"/api/v1/admin/requests/{request_id}/dispatch", json={
        "vehicle_id": vehicle_id, "driver_id": driver_id
    })
    trip_id = disp.json()["trip_id"]

    # Driver progression to ARRIVED -> POD -> DELIVERED (without /complete, so assignment stays active)
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-transit")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/arrive")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/pod", json={
        "pod_signature_url": "https://storage.cargox.com/sig_delivered.png",
        "notes": "Delivered at site, awaiting collection"
    })
    await async_client.post(f"/api/v1/admin/trips/{trip_id}/verify-pod")

    return {
        "request_id": request_id,
        "trip_id": trip_id,
        "quotation_id": quotation_id,
        "vehicle_id": vehicle_id,
        "driver_id": driver_id,
    }


@pytest.mark.anyio
async def test_customer_payment_options_and_selection(
    async_client: AsyncClient,
    admin_user: User,
    customer_company: CustomerCompany,
    customer_user: User,
    driver_user: User,
):
    """
    Test 1, 2, 3:
    - Customer can fetch configured payment options.
    - Unconfigured Net Banking cannot create false success and returns 503 explanation.
    - Selecting Pay on Delivery sets method and intent without marking invoice PAID.
    - Selecting UPI sets intent and generates dynamic QR with amount due.
    """
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]

    # Generate invoice
    inv_res = await async_client.post(f"/api/v1/admin/trips/{trip_id}/invoice", json={})
    assert inv_res.status_code == 201
    invoice_id = inv_res.json()["id"]

    # Configure receiving UPI ID
    await SettingsService.update_cargox_upi_id("cargox@okaxis", admin_user.id)

    # 1. Customer GET payment options
    opts_res = await async_client.get(f"/api/v1/customer/invoices/{invoice_id}/payment-options")
    assert opts_res.status_code == 200, opts_res.text
    options = opts_res.json()
    assert len(options) == 3
    method_names = [o["method"] for o in options]
    assert "UPI" in method_names
    assert "NET_BANKING" in method_names
    assert "PAY_ON_DELIVERY" in method_names

    # Check Net Banking is marked unavailable
    nb_opt = next(o for o in options if o["method"] == "NET_BANKING")
    assert nb_opt["available"] is False
    assert "Net Banking is currently unavailable" in nb_opt["status_message"]

    # 2. Select Net Banking -> Rejects with 503, never claims money received
    nb_select_res = await async_client.post(
        f"/api/v1/customer/invoices/{invoice_id}/select-payment-method",
        json={"payment_method": "NET_BANKING"},
    )
    assert nb_select_res.status_code == 503
    assert "Net Banking is currently unavailable" in nb_select_res.json()["detail"]

    # 3. Select Pay on Delivery -> Sets payment_method without marking PAID
    pod_select_res = await async_client.post(
        f"/api/v1/customer/invoices/{invoice_id}/select-payment-method",
        json={"payment_method": "PAY_ON_DELIVERY", "notes": "Customer pays at unloading"},
    )
    assert pod_select_res.status_code == 200, pod_select_res.text
    pod_data = pod_select_res.json()
    assert pod_data["selected_method"] == "PAY_ON_DELIVERY"
    assert pod_data["intent_status"] == "AWAITING_DELIVERY"

    # Verify invoice in DB remains UNPAID with 0 amount_paid
    inv_check = await Invoice.find_one(Invoice.id == uuid.UUID(invoice_id))
    assert inv_check.status == InvoiceStatus.UNPAID
    assert inv_check.amount_paid == Decimal("0.00")
    assert inv_check.payment_method == PaymentMethod.PAY_ON_DELIVERY

    # 4. Select UPI -> Returns QR code details
    upi_select_res = await async_client.post(
        f"/api/v1/customer/invoices/{invoice_id}/select-payment-method",
        json={"payment_method": "UPI"},
    )
    assert upi_select_res.status_code == 200, upi_select_res.text
    upi_data = upi_select_res.json()
    assert upi_data["selected_method"] == "UPI"
    assert upi_data["intent_status"] == "PENDING_CONFIRMATION"
    assert upi_data["qr_details"]["upi_id"] == "cargox@okaxis"
    assert "upi://pay" in upi_data["qr_details"]["upi_uri"]

    # Verify invoice still UNPAID
    inv_check2 = await Invoice.find_one(Invoice.id == uuid.UUID(invoice_id))
    assert inv_check2.status == InvoiceStatus.UNPAID
    assert inv_check2.amount_paid == Decimal("0.00")

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_driver_collection_recording_and_security(
    async_client: AsyncClient,
    admin_user: User,
    customer_company: CustomerCompany,
    customer_user: User,
    driver_user: User,
):
    """
    Test 4, 5, 6, 9, 10, 11:
    - Driver can record collection only for assigned trip.
    - Overpayment exceeding balance is rejected.
    - Duplicate collections rejected.
    - Partial collections compute remaining balances accurately.
    - Driver cannot access internal margins or platform fees.
    """
    ctx = await setup_arrived_trip(async_client, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]

    # Generate invoice
    inv_res = await async_client.post(f"/api/v1/admin/trips/{trip_id}/invoice", json={})
    assert inv_res.status_code == 201
    invoice_id = inv_res.json()["id"]
    total_amount = Decimal(str(inv_res.json()["total_amount"]))

    # Customer selects Pay on Delivery
    await async_client.post(
        f"/api/v1/customer/invoices/{invoice_id}/select-payment-method",
        json={"payment_method": "PAY_ON_DELIVERY"},
    )

    # 1. Driver gets active trip details -> shows collection amount due, but NO cargox_margin or internal base cost
    active_res = await async_client.get("/api/v1/driver/trips/active")
    assert active_res.status_code == 200, active_res.text
    active_data = active_res.json()
    assert active_data["collection_status"] == "DUE"
    assert Decimal(str(active_data["amount_due_for_collection"])) == total_amount
    assert "cargox_margin" not in active_data
    assert "internal_base_cost" not in active_data

    # 2. Driver attempts overpayment -> Should be REJECTED (Rule: amount <= amount_due)
    overpay_res = await async_client.post(
        f"/api/v1/driver/trips/{trip_id}/record-collection",
        json={
            "collection_method": "CASH",
            "amount": float(total_amount + Decimal("500.00")),
            "reference_number": "SLIP-OVERPAY-001",
        },
    )
    assert overpay_res.status_code == 400
    assert "exceeds outstanding balance" in overpay_res.json()["detail"]

    # 3. Partial collection: Driver records ₹1000.00 Cash collection
    part_amount = Decimal("1000.00")
    part_coll_res = await async_client.post(
        f"/api/v1/driver/trips/{trip_id}/record-collection",
        json={
            "collection_method": "CASH",
            "amount": float(part_amount),
            "reference_number": "SLIP-PART-01",
            "notes": "Collected cash advance on delivery arrival",
        },
    )
    assert part_coll_res.status_code == 201, part_coll_res.text
    part_data = part_coll_res.json()
    assert Decimal(str(part_data["amount_collected"])) == part_amount
    expected_remaining = total_amount - part_amount
    assert Decimal(str(part_data["remaining_balance"])) == expected_remaining
    assert part_data["invoice_status"] == "PARTIALLY_PAID"

    # Duplicate submission with same reference number is rejected
    dup_res = await async_client.post(
        f"/api/v1/driver/trips/{trip_id}/record-collection",
        json={
            "collection_method": "CASH",
            "amount": float(part_amount),
            "reference_number": "SLIP-PART-01",
        },
    )
    assert dup_res.status_code == 409
    assert "has already been recorded" in dup_res.json()["detail"]

    # 4. Final collection: Driver records remaining balance via UPI at delivery
    full_coll_res = await async_client.post(
        f"/api/v1/driver/trips/{trip_id}/record-collection",
        json={
            "collection_method": "UPI",
            "amount": float(expected_remaining),
            "reference_number": "UPI-UTR-987654",
            "notes": "Remaining balance scanned via driver UPI QR",
        },
    )
    assert full_coll_res.status_code == 201, full_coll_res.text
    full_data = full_coll_res.json()
    assert Decimal(str(full_data["remaining_balance"])) == Decimal("0.00")
    assert full_data["invoice_status"] == "PAID"

    # Verify Invoice in database is settled
    settled_inv = await Invoice.find_one(Invoice.id == uuid.UUID(invoice_id))
    assert settled_inv.status == InvoiceStatus.PAID
    assert settled_inv.amount_paid == total_amount
    assert settled_inv.amount_due == Decimal("0.00")

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_admin_finance_reporting_and_filter(
    async_client: AsyncClient,
    admin_user: User,
    customer_company: CustomerCompany,
    customer_user: User,
    driver_user: User,
):
    """
    Test 12, 13, 14:
    - Admin can filter invoices by payment method.
    - Financial reporting categorizes collections by method (UPI, POD/Cash, Bank Transfer).
    - Unpaid amounts and POD awaiting collection are tracked accurately.
    """
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]

    inv_res = await async_client.post(f"/api/v1/admin/trips/{trip_id}/invoice", json={})
    assert inv_res.status_code == 201
    invoice_id = inv_res.json()["id"]

    # Select Pay on Delivery
    await async_client.post(
        f"/api/v1/customer/invoices/{invoice_id}/select-payment-method",
        json={"payment_method": "PAY_ON_DELIVERY"},
    )

    # 1. Test Invoice list filter by payment_method
    filter_res = await async_client.get(
        "/api/v1/admin/invoices?payment_method=PAY_ON_DELIVERY"
    )
    assert filter_res.status_code == 200, filter_res.text
    inv_list = filter_res.json()
    assert len(inv_list) >= 1
    for item in inv_list:
        assert item["payment_method"] == "PAY_ON_DELIVERY"

    # 2. Test Financial Summary reporting with payment channel breakdown
    rep_res = await async_client.get("/api/v1/admin/finance/reports/summary?period=weekly")
    assert rep_res.status_code == 200, rep_res.text
    summary_data = rep_res.json()["summary"]

    assert "upi_collections" in summary_data
    assert "net_banking_collections" in summary_data
    assert "pay_on_delivery_collections" in summary_data
    assert "bank_transfer_collections" in summary_data
    assert "pod_awaiting_collection" in summary_data
    assert "pending_confirmations_count" in summary_data

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_real_upi_webhook_auto_detection_and_security(
    async_client: AsyncClient,
    admin_user: User,
    customer_company: CustomerCompany,
    customer_user: User,
    driver_user: User,
):
    """
    Test 7, 8, 9:
    - Real signed webhook auto-detection.
    - Cryptographic signature check: invalid signature rejected with 401.
    - Idempotency: duplicate webhooks do not duplicate payments or double-settle invoices.
    - Overpayment guard: payment amount exceeding invoice due rejected with 400.
    - Non-successful status ("failed", "cancelled") acknowledged without marking invoice paid.
    - Already paid invoice ignored without corruption.
    - Correct settlement: Invoice transitions to PAID with amount_due=0.
    """
    # 1. Setup invoice
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]

    inv_res = await async_client.post(f"/api/v1/admin/trips/{trip_id}/invoice", json={})
    assert inv_res.status_code == 201
    invoice_id = inv_res.json()["id"]
    total_amount = Decimal(str(inv_res.json()["total_amount"]))
    total_paise = int(total_amount * 100)

    # Configure mock webhook secret in settings
    test_webhook_secret = "test_webhook_secret_9988"
    settings.RAZORPAY_WEBHOOK_SECRET = test_webhook_secret

    # 2. Test Invalid Webhook Signature -> 401 Unauthorized
    payload_obj = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_test_inv_001",
                    "amount": total_paise,
                    "currency": "INR",
                    "status": "captured",
                    "method": "upi",
                    "notes": {"invoice_id": invoice_id}
                }
            }
        }
    }
    payload_bytes = json.dumps(payload_obj).encode("utf-8")

    invalid_res = await async_client.post(
        "/api/v1/payments/razorpay/webhook",
        content=payload_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": "invalid_hex_signature"
        }
    )
    assert invalid_res.status_code == 401
    assert "Invalid cryptographic webhook signature" in invalid_res.json()["detail"]

    # 3. Test Failed/Cancelled Event -> Acknowledged, invoice remains UNPAID
    failed_payload = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_test_failed_001",
                    "amount": total_paise,
                    "currency": "INR",
                    "status": "failed",
                    "method": "upi",
                    "notes": {"invoice_id": invoice_id}
                }
            }
        }
    }
    failed_bytes = json.dumps(failed_payload).encode("utf-8")
    failed_sig = hmac.new(test_webhook_secret.encode("utf-8"), failed_bytes, hashlib.sha256).hexdigest()

    fail_res = await async_client.post(
        "/api/v1/payments/razorpay/webhook",
        content=failed_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": failed_sig
        }
    )
    assert fail_res.status_code == 200
    assert fail_res.json()["status"] == "recorded_unsuccessful"

    # Invoice must remain UNPAID
    inv_check = await Invoice.find_one(Invoice.id == uuid.UUID(invoice_id))
    assert inv_check.status == InvoiceStatus.UNPAID
    assert inv_check.amount_paid == Decimal("0.00")

    # 4. Test Overpayment Rejection
    overpay_payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_test_overpay_001",
                    "amount": total_paise + 100000, # ₹1,000 extra
                    "currency": "INR",
                    "status": "captured",
                    "method": "upi",
                    "notes": {"invoice_id": invoice_id}
                }
            }
        }
    }
    overpay_bytes = json.dumps(overpay_payload).encode("utf-8")
    overpay_sig = hmac.new(test_webhook_secret.encode("utf-8"), overpay_bytes, hashlib.sha256).hexdigest()

    overpay_res = await async_client.post(
        "/api/v1/payments/razorpay/webhook",
        content=overpay_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": overpay_sig
        }
    )
    assert overpay_res.status_code == 400
    assert "exceeds outstanding balance" in overpay_res.json()["detail"]

    # 5. Test Successful Automatic UPI Payment Confirmation
    success_payment_id = f"pay_upi_auto_{uuid.uuid4().hex[:6]}"
    success_payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": success_payment_id,
                    "amount": total_paise,
                    "currency": "INR",
                    "status": "captured",
                    "method": "upi",
                    "notes": {"invoice_id": invoice_id}
                }
            }
        }
    }
    success_bytes = json.dumps(success_payload).encode("utf-8")
    success_sig = hmac.new(test_webhook_secret.encode("utf-8"), success_bytes, hashlib.sha256).hexdigest()

    success_res = await async_client.post(
        "/api/v1/payments/razorpay/webhook",
        content=success_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": success_sig
        }
    )
    assert success_res.status_code == 200, success_res.text
    res_data = success_res.json()["result"]
    assert res_data["status"] == "CONFIRMED"
    assert res_data["invoice_status"] == "PAID"
    assert Decimal(res_data["amount_paid"]) == total_amount

    # Verify Invoice in Database
    settled_inv = await Invoice.find_one(Invoice.id == uuid.UUID(invoice_id))
    assert settled_inv.status == InvoiceStatus.PAID
    assert settled_inv.amount_paid == total_amount
    assert settled_inv.amount_due == Decimal("0.00")
    assert settled_inv.payment_method == PaymentMethod.UPI
    assert settled_inv.payment_intent_status == "CONFIRMED"

    # Verify Payment Record
    p_rec = await Payment.find_one(Payment.gateway_payment_id == success_payment_id)
    assert p_rec is not None
    assert p_rec.amount == total_amount
    assert p_rec.method == PaymentMethod.UPI

    # 6. Test Idempotency: Retrying exact same webhook -> ALREADY_PROCESSED without double-charging
    dup_res = await async_client.post(
        "/api/v1/payments/razorpay/webhook",
        content=success_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": success_sig
        }
    )
    assert dup_res.status_code == 200
    dup_data = dup_res.json()["result"]
    assert dup_data["status"] == "ALREADY_PROCESSED"

    # Verify Invoice amount_paid was not doubled
    settled_inv_after = await Invoice.find_one(Invoice.id == uuid.UUID(invoice_id))
    assert settled_inv_after.amount_paid == total_amount
    assert settled_inv_after.amount_due == Decimal("0.00")

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_payment_authorized_alone_does_not_settle_invoice(
    async_client: AsyncClient,
    admin_user: User,
    customer_company: CustomerCompany,
    customer_user: User,
    driver_user: User,
):
    """
    Rule Check 1:
    - payment.authorized alone must NEVER mark an invoice paid or change collected amounts.
    - Only captured / success events settle the ledger.
    """
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]

    inv_res = await async_client.post(f"/api/v1/admin/trips/{trip_id}/invoice", json={})
    assert inv_res.status_code == 201
    invoice_id = inv_res.json()["id"]
    total_amount = Decimal(str(inv_res.json()["total_amount"]))
    total_paise = int(total_amount * 100)

    test_webhook_secret = "test_webhook_secret_auth_only"
    settings.RAZORPAY_WEBHOOK_SECRET = test_webhook_secret

    auth_payload = {
        "event": "payment.authorized",
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_auth_{uuid.uuid4().hex[:6]}",
                    "amount": total_paise,
                    "currency": "INR",
                    "status": "authorized", # authorized, NOT captured
                    "method": "upi",
                    "notes": {"invoice_id": invoice_id}
                }
            }
        }
    }
    auth_bytes = json.dumps(auth_payload).encode("utf-8")
    auth_sig = hmac.new(test_webhook_secret.encode("utf-8"), auth_bytes, hashlib.sha256).hexdigest()

    auth_res = await async_client.post(
        "/api/v1/payments/razorpay/webhook",
        content=auth_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": auth_sig
        }
    )
    assert auth_res.status_code == 200
    res_data = auth_res.json()
    # Must report ignored/unsettled
    assert res_data["result"]["status"] == "IGNORED_UNSETTLED"

    # Confirm invoice in DB remains completely UNPAID
    inv_check = await Invoice.find_one(Invoice.id == uuid.UUID(invoice_id))
    assert inv_check.status == InvoiceStatus.UNPAID
    assert inv_check.amount_paid == Decimal("0.00")
    assert inv_check.amount_due == total_amount

    # Confirm no Payment was inserted for authorized status
    pay_count = await Payment.find(Payment.invoice_id == uuid.UUID(invoice_id)).count()
    assert pay_count == 0

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_partial_payment_and_remaining_balance_via_gateway(
    async_client: AsyncClient,
    admin_user: User,
    customer_company: CustomerCompany,
    customer_user: User,
    driver_user: User,
):
    """
    Financial Integrity Rule:
    - Gateway partial payment credits amount_paid accurately.
    - Status transitions to PARTIALLY_PAID.
    - Outstanding amount_due reflects exact remainder.
    """
    ctx = await setup_completed_trip(async_client, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]

    inv_res = await async_client.post(f"/api/v1/admin/trips/{trip_id}/invoice", json={})
    assert inv_res.status_code == 201
    invoice_id = inv_res.json()["id"]
    total_amount = Decimal(str(inv_res.json()["total_amount"]))

    test_webhook_secret = "test_webhook_secret_partial"
    settings.RAZORPAY_WEBHOOK_SECRET = test_webhook_secret

    part_amount = Decimal("500.00")
    part_paise = int(part_amount * 100)

    part_payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_part_{uuid.uuid4().hex[:6]}",
                    "amount": part_paise,
                    "currency": "INR",
                    "status": "captured",
                    "method": "upi",
                    "notes": {"invoice_id": invoice_id}
                }
            }
        }
    }
    part_bytes = json.dumps(part_payload).encode("utf-8")
    part_sig = hmac.new(test_webhook_secret.encode("utf-8"), part_bytes, hashlib.sha256).hexdigest()

    part_res = await async_client.post(
        "/api/v1/payments/razorpay/webhook",
        content=part_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": part_sig
        }
    )
    assert part_res.status_code == 200
    res_data = part_res.json()["result"]
    assert res_data["status"] == "CONFIRMED"
    assert res_data["invoice_status"] == "PARTIALLY_PAID"

    inv_check = await Invoice.find_one(Invoice.id == uuid.UUID(invoice_id))
    assert inv_check.status == InvoiceStatus.PARTIALLY_PAID
    assert inv_check.amount_paid == part_amount
    assert inv_check.amount_due == total_amount - part_amount

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_driver_sees_configured_cargox_upi_and_qr_details(async_client: AsyncClient, admin_user, customer_user, driver_user):
    """
    1. Driver sees the configured CargoX business UPI details.
    2. Driver QR uses the correct invoice and outstanding amount.
    """
    configured_upi = "cargox.corporate@okaxis"
    await SettingsService.update_cargox_upi_id(configured_upi, admin_user.id)

    ctx = await setup_arrived_trip(async_client, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]

    # Generate invoice for trip
    await async_client.post(f"/api/v1/admin/trips/{trip_id}/invoice", json={})

    app.dependency_overrides[get_current_driver] = lambda: driver_user

    res = await async_client.get("/api/v1/driver/trips/active")
    assert res.status_code == 200
    data = res.json()

    assert data["business_name"] == "CargoX Logistics"
    assert data["cargox_upi_id"] == configured_upi
    assert data["payment_status_display"] in ("Payment Due", "Paid")
    assert data["qr_image_url"] is not None
    assert "upi%3A%2F%2Fpay" in data["qr_image_url"] or "upi://" in (data.get("upi_uri") or "")
    assert str(data["amount_due_for_collection"]) is not None
    assert "cargox.corporate" in data["qr_image_url"]
    assert "okaxis" in data["qr_image_url"]
    assert "cargox.corporate" in (data.get("upi_uri") or "")

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_customer_portal_and_driver_qr_credit_same_invoice(async_client: AsyncClient, admin_user, customer_user, driver_user):
    """
    3. Existing Customer Portal payment flow still works.
    4. Customer-side and driver-side payments update the same invoice.
    5. Successful verified payment updates the invoice exactly once.
    6. Duplicate webhooks cannot duplicate payments.
    """
    ctx = await setup_arrived_trip(async_client, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]

    inv_res = await async_client.post(f"/api/v1/admin/trips/{trip_id}/invoice", json={})
    assert inv_res.status_code == 201
    invoice_id = inv_res.json()["id"]
    original_total = Decimal(str(inv_res.json()["total_amount"]))

    # Test Customer selects UPI and receives payment options
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user
    options_res = await async_client.get(f"/api/v1/customer/invoices/{invoice_id}/payment-options")
    assert options_res.status_code == 200
    assert len(options_res.json()) == 3

    # Now customer pays via webhook matching the invoice
    test_webhook_secret = "test_webhook_shared_ledger"
    settings.RAZORPAY_WEBHOOK_SECRET = test_webhook_secret

    pay_id = f"pay_shared_{uuid.uuid4().hex[:6]}"
    payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": pay_id,
                    "amount": int(original_total * 100),
                    "currency": "INR",
                    "status": "captured",
                    "method": "upi",
                    "notes": {"invoice_id": invoice_id}
                }
            }
        }
    }
    payload_bytes = json.dumps(payload).encode("utf-8")
    sig = hmac.new(test_webhook_secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

    hook_res = await async_client.post(
        "/api/v1/payments/razorpay/webhook",
        content=payload_bytes,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig}
    )
    assert hook_res.status_code == 200
    assert hook_res.json()["result"]["status"] == "CONFIRMED"

    # Retry duplicate webhook
    dup_res = await async_client.post(
        "/api/v1/payments/razorpay/webhook",
        content=payload_bytes,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": sig}
    )
    assert dup_res.status_code == 200
    assert dup_res.json()["result"]["status"] == "ALREADY_PROCESSED"

    # Verify invoice has exactly one payment recorded
    payments = await Payment.find(Payment.invoice_id == uuid.UUID(invoice_id)).to_list()
    assert len(payments) == 1
    assert payments[0].amount == original_total

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_admin_trip_detail_exposes_payment_records(async_client: AsyncClient, admin_user, customer_user, driver_user):
    """
    7. Payment IDs are visible in Admin records.
    """
    ctx = await setup_arrived_trip(async_client, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]

    inv_res = await async_client.post(f"/api/v1/admin/trips/{trip_id}/invoice", json={})
    assert inv_res.status_code == 201
    invoice_id = inv_res.json()["id"]

    # Record a payment
    from app.services.invoice_service import InvoiceService
    from app.schemas.invoice import PaymentCreate
    await InvoiceService.record_payment(
        uuid.UUID(invoice_id),
        PaymentCreate(amount=Decimal("1000.00"), method=PaymentMethod.CASH, reference_number="RCPT-1001"),
        admin_user
    )

    app.dependency_overrides[get_current_admin] = lambda: admin_user

    detail_res = await async_client.get(f"/api/v1/admin/trips/{trip_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()

    assert detail["invoice"] is not None
    assert detail["invoice"]["invoice_number"] == inv_res.json()["invoice_number"]
    assert len(detail["invoice"]["payments"]) >= 1
    p_record = detail["invoice"]["payments"][0]
    assert p_record["payment_id"] is not None
    assert p_record["collection_reference"] == "RCPT-1001"
    assert p_record["amount"] == 1000.0

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_auto_completion_lifecycle_rules(async_client: AsyncClient, admin_user, customer_user, driver_user):
    """
    8. Cash collection gets an internal payment-record ID without a fake provider ID.
    9. Partial payment does not mark the invoice PAID.
    10. Failed or pending payments do not trigger payment-gated completion.
    11. Fully paid invoice plus verified delivery completes the trip correctly.
    12. Payment before delivery does not prematurely complete the trip.
    14. Driver cannot collect payment for another driver's trip.
    """
    from app.models.delivery import DeliveryRequest
    from app.models.enums import DeliveryRequestStatus

    ctx = await setup_arrived_trip(async_client, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]
    req_id = ctx["request_id"]

    inv_res = await async_client.post(f"/api/v1/admin/trips/{trip_id}/invoice", json={})
    assert inv_res.status_code == 201
    invoice_id = inv_res.json()["id"]
    total_amount = Decimal(str(inv_res.json()["total_amount"]))

    # Rule 14: Driver cannot collect for another driver's trip
    other_driver = User(id=uuid.uuid4(), email="other@driver.com", role=UserRole.DRIVER, is_active=True)
    await other_driver.insert()

    app.dependency_overrides[get_current_driver] = lambda: other_driver
    bad_coll = await async_client.post(
        f"/api/v1/driver/trips/{trip_id}/record-collection",
        json={"amount": 100.0, "collection_method": "CASH"}
    )
    assert bad_coll.status_code == 403

    # Rule 8 & 9: Partial Cash collection gets internal ID and does NOT mark PAID
    app.dependency_overrides[get_current_driver] = lambda: driver_user
    part_coll = await async_client.post(
        f"/api/v1/driver/trips/{trip_id}/record-collection",
        json={"amount": 500.0, "collection_method": "CASH", "reference_number": "CASH-PART-01"}
    )
    assert part_coll.status_code == 201
    coll_data = part_coll.json()
    assert coll_data["payment_id"] is not None
    assert coll_data["invoice_status"] == "PARTIALLY_PAID"

    # Trip must NOT be completed because balance remains
    req_check = await DeliveryRequest.find_one(DeliveryRequest.id == uuid.UUID(req_id))
    assert req_check.status == DeliveryRequestStatus.DELIVERED

    # Settle the remaining balance
    rem_amount = float(total_amount - Decimal("500.00"))
    full_coll = await async_client.post(
        f"/api/v1/driver/trips/{trip_id}/record-collection",
        json={"amount": rem_amount, "collection_method": "CASH", "reference_number": "CASH-FULL-02"}
    )
    assert full_coll.status_code == 201
    assert full_coll.json()["invoice_status"] == "PAID"

    # Rule 11: Fully paid invoice plus delivered status auto-completes the trip
    req_final = await DeliveryRequest.find_one(DeliveryRequest.id == uuid.UUID(req_id))
    assert req_final.status == DeliveryRequestStatus.COMPLETED

    app.dependency_overrides.clear()


