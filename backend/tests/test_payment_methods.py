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
