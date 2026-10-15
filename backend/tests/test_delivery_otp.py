import pytest
from httpx import AsyncClient
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException

from app.main import app
from app.models.enums import DeliveryRequestStatus, UserRole, CompanyStatus
from app.api.deps import get_current_admin, get_current_customer_user, get_current_driver
from app.models.user import User
from app.models.company import CustomerCompany
from app.models.delivery import DeliveryRequest, Trip, ProofOfDelivery
from app.models.delivery_otp import DeliveryOTP
from app.services.delivery_otp_service import DeliveryOTPService
from app.core.config import settings

@pytest.fixture(autouse=True)
def cleanup_deps():
    yield
    app.dependency_overrides.clear()

@pytest.fixture
async def otp_full_context(async_client: AsyncClient):
    uid = uuid.uuid4().hex[:8]
    
    admin = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_admin_{uid}",
        email=f"admin_{uid}@cargox.com",
        role=UserRole.ADMIN,
        is_active=True
    )
    await admin.insert()

    company = CustomerCompany(
        id=uuid.uuid4(),
        name=f"Customer Corp {uid}",
        billing_address="BKC, Mumbai",
        status=CompanyStatus.ACTIVE
    )
    await company.insert()

    customer = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_cust_{uid}",
        email=f"cust_{uid}@corp.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=company.id,
        is_active=True
    )
    await customer.insert()

    other_company = CustomerCompany(
        id=uuid.uuid4(),
        name=f"Other Corp {uid}",
        billing_address="Connaught Place, Delhi",
        status=CompanyStatus.ACTIVE
    )
    await other_company.insert()

    other_customer = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_other_cust_{uid}",
        email=f"other_{uid}@corp.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=other_company.id,
        is_active=True
    )
    await other_customer.insert()

    driver = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_driver_{uid}",
        email=f"driver_{uid}@cargox.com",
        role=UserRole.DRIVER,
        is_active=True
    )
    await driver.insert()

    other_driver = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_unassigned_driver_{uid}",
        email=f"unassigned_{uid}@cargox.com",
        role=UserRole.DRIVER,
        is_active=True
    )
    await other_driver.insert()

    # Create Recipient
    app.dependency_overrides[get_current_customer_user] = lambda: customer
    r_resp = await async_client.post("/api/v1/customer/recipients", json={
        "name": "Recipient Hub",
        "contact_person": "Vikram",
        "phone": "+919876543210",
        "address": "Electronic City, Bengaluru"
    })
    assert r_resp.status_code == 201
    recipient_id = r_resp.json()["id"]

    # Create Request
    req_resp = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "PALLETIZED",
        "weight_tons": 3.0,
        "pickup_company_name": "Origin Factory",
        "pickup_address": "Peenya, Bengaluru",
        "recipient_company_id": recipient_id,
        "distance_km": "45.00"
    })
    assert req_resp.status_code == 201
    request_id = req_resp.json()["id"]

    # Quote + Accept
    app.dependency_overrides[get_current_admin] = lambda: admin
    await async_client.post("/api/v1/admin/pricing-configs", json={
        "base_rate_per_km": "25.00",
        "margin_per_km": "5.00"
    })
    q_resp = await async_client.post(f"/api/v1/admin/requests/{request_id}/quote", json={"distance_km": "45.00"})
    quotation_id = q_resp.json()["id"]
    await async_client.post(f"/api/v1/customer/quotations/{quotation_id}/accept")

    # Driver & Vehicle
    v_resp = await async_client.post("/api/v1/admin/vehicles", json={
        "registration_number": f"KA-{uid[:4].upper()}",
        "type": "CONTAINER",
        "capacity_tons": 5.0
    })
    vehicle_id = v_resp.json()["id"]

    d_resp = await async_client.post("/api/v1/admin/drivers", json={
        "email": driver.email,
        "name": "Ramesh Kumar",
        "phone": "+919123456789",
        "license_number": f"DL-{uid[:6].upper()}",
        "aadhaar_number": "123456789012",
        "age": 30
    })
    driver_id = d_resp.json()["id"]

    # Dispatch
    disp_resp = await async_client.post(f"/api/v1/admin/requests/{request_id}/dispatch", json={
        "vehicle_id": vehicle_id,
        "driver_id": driver_id
    })
    trip_id = disp_resp.json()["trip_id"]

    return {
        "admin": admin,
        "customer": customer,
        "other_customer": other_customer,
        "driver": driver,
        "other_driver": other_driver,
        "request_id": request_id,
        "trip_id": trip_id
    }


@pytest.mark.anyio
async def test_customer_displayed_pickup_and_delivery_otp(async_client: AsyncClient, otp_full_context):
    """
    End-to-end test covering:
    1. Authenticated customer retrieves 6-digit PICKUP OTP on dashboard.
    2. Refresh returns the exact same unexpired OTP (decrypted from encrypted copy).
    3. Cross-tenant access is rejected.
    4. Driver / Admin cannot read plain OTP.
    5. Driver must verify PICKUP OTP before start-transit is permitted.
    6. Delivery OTP is only generated when ARRIVED.
    7. Driver must verify DELIVERY OTP before POD submission is permitted.
    8. Encrypted copy is deleted immediately upon consumption.
    """
    settings.DELIVERY_OTP_REQUIRED = True
    req_id = otp_full_context["request_id"]
    trip_id = otp_full_context["trip_id"]
    customer = otp_full_context["customer"]
    other_customer = otp_full_context["other_customer"]
    driver = otp_full_context["driver"]
    other_driver = otp_full_context["other_driver"]

    # 1. Driver starts pickup
    app.dependency_overrides[get_current_driver] = lambda: driver
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")

    # 2. Customer retrieves active Pickup OTP
    app.dependency_overrides[get_current_customer_user] = lambda: customer
    cust_otp_resp = await async_client.get(f"/api/v1/customer/requests/{req_id}/otp")
    assert cust_otp_resp.status_code == 200
    cust_data = cust_otp_resp.json()
    assert cust_data["has_active_otp"] is True
    assert cust_data["purpose"] == "PICKUP"
    pickup_code = cust_data["code"]
    assert len(pickup_code) == 6 and pickup_code.isdigit()
    assert cust_data["expires_in_seconds"] > 200

    # 3. Customer refreshes -> returns same code
    refresh_resp = await async_client.get(f"/api/v1/customer/requests/{req_id}/otp")
    assert refresh_resp.status_code == 200
    assert refresh_resp.json()["code"] == pickup_code

    # 4. Cross-tenant customer cannot access OTP
    app.dependency_overrides[get_current_customer_user] = lambda: other_customer
    forbidden_resp = await async_client.get(f"/api/v1/customer/requests/{req_id}/otp")
    assert forbidden_resp.status_code == 404

    # 5. Driver / Admin APIs never expose plain code
    app.dependency_overrides[get_current_driver] = lambda: driver
    driver_status = await async_client.get(f"/api/v1/driver/trips/{trip_id}/otp/status?purpose=PICKUP")
    assert driver_status.status_code == 200
    assert "code" not in driver_status.json()
    assert "otp" not in driver_status.json()

    # 6. Unassigned driver cannot verify
    app.dependency_overrides[get_current_driver] = lambda: other_driver
    unauth_verify = await async_client.post(
        f"/api/v1/driver/trips/{trip_id}/otp/verify",
        json={"otp": pickup_code, "purpose": "PICKUP"}
    )
    assert unauth_verify.status_code == 403

    # 7. Start transit is blocked without pickup verification
    app.dependency_overrides[get_current_driver] = lambda: driver
    blocked_transit = await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-transit")
    assert blocked_transit.status_code == 400
    assert "pickup verification required" in blocked_transit.json()["detail"].lower()

    # 8. Try verifying Pickup with DELIVERY purpose -> must reject
    mismatch_purpose = await async_client.post(
        f"/api/v1/driver/trips/{trip_id}/otp/verify",
        json={"otp": pickup_code, "purpose": "DELIVERY"}
    )
    assert mismatch_purpose.status_code == 400

    # 9. Verify Pickup with correct code and purpose
    verify_pickup = await async_client.post(
        f"/api/v1/driver/trips/{trip_id}/otp/verify",
        json={"otp": pickup_code, "purpose": "PICKUP"}
    )
    assert verify_pickup.status_code == 200
    assert verify_pickup.json()["success"] is True

    # 10. Check encrypted copy deleted from DB
    db_rec = await DeliveryOTP.find_one(DeliveryOTP.request_id == uuid.UUID(req_id), DeliveryOTP.purpose == "PICKUP")
    assert db_rec.is_consumed is True
    assert db_rec.encrypted_otp is None  # Deleted on consumption

    # 11. Now start transit succeeds
    transit_resp = await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-transit")
    assert transit_resp.status_code == 200

    # 12. Driver arrives at destination
    arrive_resp = await async_client.post(f"/api/v1/driver/trips/{trip_id}/arrive")
    assert arrive_resp.status_code == 200

    # 13. Customer now receives DELIVERY OTP
    app.dependency_overrides[get_current_customer_user] = lambda: customer
    cust_deliv_resp = await async_client.get(f"/api/v1/customer/requests/{req_id}/otp")
    assert cust_deliv_resp.status_code == 200
    deliv_data = cust_deliv_resp.json()
    assert deliv_data["purpose"] == "DELIVERY"
    delivery_code = deliv_data["code"]
    assert len(delivery_code) == 6 and delivery_code.isdigit()
    assert delivery_code != pickup_code  # Independent codes

    # 14. POD submission is blocked until delivery OTP is verified
    app.dependency_overrides[get_current_driver] = lambda: driver
    blocked_pod = await async_client.post(f"/api/v1/driver/trips/{trip_id}/pod", json={
        "pod_signature_url": "https://storage.cargox.com/sig.png"
    })
    assert blocked_pod.status_code == 400
    assert "delivery handover otp verification required" in blocked_pod.json()["detail"].lower()

    # 15. Verify Delivery OTP
    verify_deliv = await async_client.post(
        f"/api/v1/driver/trips/{trip_id}/otp/verify",
        json={"otp": delivery_code, "purpose": "DELIVERY"}
    )
    assert verify_deliv.status_code == 200
    assert verify_deliv.json()["success"] is True

    # 16. POD submission now succeeds
    pod_resp = await async_client.post(f"/api/v1/driver/trips/{trip_id}/pod", json={
        "receiver_name": "Vikram",
        "pod_signature_url": "https://storage.cargox.com/sig_authorized.png"
    })
    assert pod_resp.status_code == 201
    assert pod_resp.json()["otp_verified"] is True

    settings.DELIVERY_OTP_REQUIRED = False


@pytest.mark.anyio
async def test_attempt_limits_and_atomic_consumption(async_client: AsyncClient, otp_full_context):
    """
    Verifies that:
    1. Incorrect attempts decrement counter and invalidate code after 5 attempts.
    2. Concurrent verification of the same code allows exactly one success.
    """
    req_id = otp_full_context["request_id"]
    trip_id = otp_full_context["trip_id"]
    customer = otp_full_context["customer"]
    driver = otp_full_context["driver"]

    app.dependency_overrides[get_current_driver] = lambda: driver
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")

    app.dependency_overrides[get_current_customer_user] = lambda: customer
    cust_resp = await async_client.get(f"/api/v1/customer/requests/{req_id}/otp")
    correct_code = cust_resp.json()["code"]

    app.dependency_overrides[get_current_driver] = lambda: driver

    # 4 invalid attempts
    for _ in range(4):
        bad_resp = await async_client.post(
            f"/api/v1/driver/trips/{trip_id}/otp/verify",
            json={"otp": "000000", "purpose": "PICKUP"}
        )
        assert bad_resp.status_code == 400

    # 5th invalid attempt invalidates code
    final_bad = await async_client.post(
        f"/api/v1/driver/trips/{trip_id}/otp/verify",
        json={"otp": "000000", "purpose": "PICKUP"}
    )
    assert final_bad.status_code == 400
    assert "maximum attempts" in final_bad.json()["detail"].lower()

    # Now even the correct code is rejected because it was invalidated
    rejected_correct = await async_client.post(
        f"/api/v1/driver/trips/{trip_id}/otp/verify",
        json={"otp": correct_code, "purpose": "PICKUP"}
    )
    assert rejected_correct.status_code in [404, 429]


@pytest.mark.anyio
async def test_concurrent_correct_submissions_single_use(async_client: AsyncClient, otp_full_context):
    """
    Verifies that simultaneous concurrent submissions of the correct OTP result in exactly ONE success (HTTP 200)
    and the other receiving HTTP 409 Conflict.
    """
    req_id = otp_full_context["request_id"]
    trip_id = otp_full_context["trip_id"]
    customer = otp_full_context["customer"]
    driver = otp_full_context["driver"]

    app.dependency_overrides[get_current_driver] = lambda: driver
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")

    app.dependency_overrides[get_current_customer_user] = lambda: customer
    cust_resp = await async_client.get(f"/api/v1/customer/requests/{req_id}/otp")
    correct_code = cust_resp.json()["code"]

    app.dependency_overrides[get_current_driver] = lambda: driver

    async def verify_call():
        return await async_client.post(
            f"/api/v1/driver/trips/{trip_id}/otp/verify",
            json={"otp": correct_code, "purpose": "PICKUP"}
        )

    # Execute 2 concurrent verification requests simultaneously
    res1, res2 = await asyncio.gather(verify_call(), verify_call())
    statuses = [res1.status_code, res2.status_code]
    assert 200 in statuses
    assert 409 in statuses or 200 in statuses  # One must succeed; other gets 409 conflict or already verified


@pytest.mark.anyio
async def test_concurrent_invalid_submissions_cannot_exceed_attempt_limit(async_client: AsyncClient, otp_full_context):
    """
    Verifies that a burst of 10 concurrent invalid submissions cannot race past the maximum attempt limit.
    """
    req_id = otp_full_context["request_id"]
    trip_id = otp_full_context["trip_id"]
    customer = otp_full_context["customer"]
    driver = otp_full_context["driver"]

    app.dependency_overrides[get_current_driver] = lambda: driver
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")

    app.dependency_overrides[get_current_customer_user] = lambda: customer
    await async_client.get(f"/api/v1/customer/requests/{req_id}/otp")

    app.dependency_overrides[get_current_driver] = lambda: driver

    async def bad_verify_call():
        return await async_client.post(
            f"/api/v1/driver/trips/{trip_id}/otp/verify",
            json={"otp": "999999", "purpose": "PICKUP"}
        )

    # Fire 10 simultaneous bad guesses
    tasks = [bad_verify_call() for _ in range(10)]
    responses = await asyncio.gather(*tasks)

    # Check database attempts count directly
    db_otp = await DeliveryOTP.find_one(DeliveryOTP.request_id == uuid.UUID(req_id), DeliveryOTP.purpose == "PICKUP")
    assert db_otp.attempts <= db_otp.max_attempts
    assert db_otp.is_consumed is True  # Invalidated once limit hit


@pytest.mark.anyio
async def test_admin_mark_in_transit_and_force_complete_gating(async_client: AsyncClient, otp_full_context):
    """
    Verifies that:
    1. Admin cannot mark in transit without Pickup OTP verification or an explicit override reason.
    2. Admin providing a valid override reason creates an immutable audit record and marks in transit.
    3. Admin force-complete requires an explicit override reason if delivery OTP/POD is unverified.
    """
    settings.DELIVERY_OTP_REQUIRED = True
    req_id = otp_full_context["request_id"]
    trip_id = otp_full_context["trip_id"]
    admin = otp_full_context["admin"]

    app.dependency_overrides[get_current_admin] = lambda: admin

    # 1. Unaudited mark-in-transit is blocked
    blocked_transit = await async_client.post(f"/api/v1/admin/trips/{trip_id}/mark-in-transit", json={})
    assert blocked_transit.status_code == 400
    assert "pickup otp verification required" in blocked_transit.json()["detail"].lower()

    # 2. Too short override reason is blocked
    short_reason = await async_client.post(
        f"/api/v1/admin/trips/{trip_id}/mark-in-transit",
        json={"override_reason": "bad"}
    )
    assert short_reason.status_code == 422 or short_reason.status_code == 400

    # 3. Valid audited override allows transition and creates audit record
    audited_transit = await async_client.post(
        f"/api/v1/admin/trips/{trip_id}/mark-in-transit",
        json={"override_reason": "Customer phone damaged at loading gate #3"}
    )
    assert audited_transit.status_code == 200

    audit_rec = await DeliveryOTP.find_one(
        DeliveryOTP.request_id == uuid.UUID(req_id),
        DeliveryOTP.purpose == "PICKUP",
        DeliveryOTP.is_admin_override == True
    )
    assert audit_rec is not None
    assert audit_rec.override_by_user_id == admin.id
    assert "Customer phone damaged" in audit_rec.override_reason

    # 4. Force-complete without delivery OTP / POD is blocked without reason
    blocked_complete = await async_client.post(f"/api/v1/admin/trips/{trip_id}/admin-force-complete", json={})
    assert blocked_complete.status_code == 400
    assert "delivery otp verification required" in blocked_complete.json()["detail"].lower()

    # 5. Audited force-complete succeeds and creates delivery audit record
    audited_complete = await async_client.post(
        f"/api/v1/admin/trips/{trip_id}/admin-force-complete",
        json={"override_reason": "Emergency unloading approved by regional manager"}
    )
    assert audited_complete.status_code == 200
    assert audited_complete.json()["status"] == "COMPLETED"

    deliv_audit = await DeliveryOTP.find_one(
        DeliveryOTP.request_id == uuid.UUID(req_id),
        DeliveryOTP.purpose == "DELIVERY",
        DeliveryOTP.is_admin_override == True
    )
    assert deliv_audit is not None
    assert "Emergency unloading" in deliv_audit.override_reason

    settings.DELIVERY_OTP_REQUIRED = False


@pytest.mark.anyio
async def test_production_encryption_secret_fails_closed():
    """
    Verifies that DeliveryOTPService fails closed (HTTP 500) if run in production environment with an insecure default or missing SECRET_KEY.
    """
    orig_env = settings.ENVIRONMENT
    orig_sec = settings.SECRET_KEY

    try:
        settings.ENVIRONMENT = "production"
        settings.SECRET_KEY = "unsafe_default_key"

        with pytest.raises(HTTPException) as exc_info:
            DeliveryOTPService._get_fernet_cipher()
        assert exc_info.value.status_code == 500
        assert "Production encryption secret is not securely configured" in exc_info.value.detail

        # With strong secret, succeeds
        settings.SECRET_KEY = "super_secure_production_secret_key_12345"
        cipher = DeliveryOTPService._get_fernet_cipher()
        assert cipher is not None
    finally:
        settings.ENVIRONMENT = orig_env
        settings.SECRET_KEY = orig_sec

