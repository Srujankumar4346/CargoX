import pytest
from httpx import AsyncClient
import uuid
from decimal import Decimal

from app.main import app
from app.models.enums import DeliveryRequestStatus, VehicleStatus, DriverStatus, UserRole, CompanyStatus
from app.api.deps import get_current_admin, get_current_customer_user, get_current_driver
from app.models.user import User
from app.models.company import CustomerCompany
from app.models.delivery import DeliveryRequest

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

async def setup_full_trip(async_client: AsyncClient, admin_user, customer_user, driver_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user
    app.dependency_overrides[get_current_driver] = lambda: driver_user

    # 1. Create Recipient
    r_resp = await async_client.post("/api/v1/customer/recipients", json={
        "name": "Target Recipient",
        "contact_person": "Jane Doe",
        "phone": "+919999999999",
        "address": "456 Destination Ave"
    })
    assert r_resp.status_code == 201
    recipient_id = r_resp.json()["id"]

    # 2. Create Delivery Request
    req_resp = await async_client.post("/api/v1/customer/requests", json={
        "goods_type": "PALLETIZED",
        "goods_description": "General Goods",
        "weight_tons": 5.0,
        "pickup_company_name": "Source Corp",
        "pickup_address": "123 Origin St",
        "pickup_contact_person": "John Doe",
        "pickup_phone": "+919876543210",
        "recipient_company_id": recipient_id,
        "distance_km": "250.00"
    })
    assert req_resp.status_code == 201
    request_id = req_resp.json()["id"]

    # 3. Create active pricing config & Quote
    await async_client.post("/api/v1/admin/pricing-configs", json={
        "base_rate_per_km": "20.00",
        "margin_per_km": "5.00"
    })

    q_resp = await async_client.post(f"/api/v1/admin/requests/{request_id}/quote", json={
        "distance_km": "100.00"
    })
    assert q_resp.status_code == 201
    quotation_id = q_resp.json()["id"]

    # 4. Accept quotation
    acc_resp = await async_client.post(f"/api/v1/customer/quotations/{quotation_id}/accept")
    assert acc_resp.status_code == 200

    # 5. Create Vehicle & Driver Profile
    v_resp = await async_client.post("/api/v1/admin/vehicles", json={
        "registration_number": f"MH01-{uuid.uuid4().hex[:4].upper()}",
        "type": "CONTAINER",
        "capacity_tons": 10.0
    })
    assert v_resp.status_code == 201
    vehicle_id = v_resp.json()["id"]

    d_prof_resp = await async_client.post("/api/v1/admin/drivers", json={
        "email": driver_user.email,
        "name": "Test Driver",
        "phone": "+919888888888",
        "license_number": f"DL-{uuid.uuid4().hex[:6].upper()}",
        "aadhaar_number": "123456789012",
        "age": 30
    })
    assert d_prof_resp.status_code == 201
    driver_id = d_prof_resp.json()["id"]

    # 6. Dispatch Request
    disp_resp = await async_client.post(f"/api/v1/admin/requests/{request_id}/dispatch", json={
        "vehicle_id": vehicle_id,
        "driver_id": driver_id
    })
    assert disp_resp.status_code == 201
    trip_id = disp_resp.json()["trip_id"]

    return {
        "request_id": request_id,
        "trip_id": trip_id,
        "vehicle_id": vehicle_id,
        "driver_id": driver_id,
        "admin_user": admin_user,
        "customer_user": customer_user,
        "driver_user": driver_user
    }

@pytest.mark.anyio
async def test_phase7_full_lifecycle(async_client: AsyncClient, admin_user, customer_user, driver_user):
    ctx = await setup_full_trip(async_client, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]
    req_id = ctx["request_id"]

    app.dependency_overrides[get_current_driver] = lambda: driver_user
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user

    # 1. Driver execution steps: DRIVER_ASSIGNED -> PICKUP_IN_PROGRESS -> IN_TRANSIT -> ARRIVED
    r1 = await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    assert r1.status_code == 200

    r2 = await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-transit")
    assert r2.status_code == 200

    r3 = await async_client.post(f"/api/v1/driver/trips/{trip_id}/arrive")
    assert r3.status_code == 200

    # Test skipped transition rejection: ARRIVED -> COMPLETED via Admin complete call
    bad_comp = await async_client.post(f"/api/v1/admin/trips/{trip_id}/complete")
    assert bad_comp.status_code == 400
    assert "DELIVERED" in bad_comp.json()["detail"]

    # 2. Driver submits POD -> POD_SUBMITTED
    pod_resp = await async_client.post(f"/api/v1/driver/trips/{trip_id}/pod", json={
        "pod_signature_url": "https://storage.cargox.com/sig1.png",
        "pod_photo_url": "https://storage.cargox.com/photo1.png",
        "notes": "Delivered in perfect condition"
    })
    assert pod_resp.status_code == 201

    # Test duplicate POD submission -> 409 Conflict
    dup_pod = await async_client.post(f"/api/v1/driver/trips/{trip_id}/pod", json={
        "pod_signature_url": "https://storage.cargox.com/sig2.png"
    })
    assert dup_pod.status_code == 409

    # Test skipped transition rejection: POD_SUBMITTED -> COMPLETED
    bad_comp2 = await async_client.post(f"/api/v1/admin/trips/{trip_id}/complete")
    assert bad_comp2.status_code == 400

    # 3. Admin verifies POD -> DELIVERED
    verify_resp = await async_client.post(f"/api/v1/admin/trips/{trip_id}/verify-pod")
    assert verify_resp.status_code == 200

    # Verify vehicle and driver are still committed ON_TRIP/ASSIGNED during DELIVERED
    v_info = await async_client.get(f"/api/v1/admin/vehicles/{ctx['vehicle_id']}")
    assert v_info.json()["status"] == "ASSIGNED"

    # 4. Admin completes delivery -> COMPLETED
    comp_resp = await async_client.post(f"/api/v1/admin/trips/{trip_id}/complete")
    assert comp_resp.status_code == 200
    assert comp_resp.json()["status"] == "COMPLETED"
    assert comp_resp.json()["completed_at"] is not None

    # Verify resources released to AVAILABLE ONLY at completion
    v_info_after = await async_client.get(f"/api/v1/admin/vehicles/{ctx['vehicle_id']}")
    assert v_info_after.json()["status"] == "AVAILABLE"

    d_info_after = await async_client.get(f"/api/v1/admin/drivers/{ctx['driver_id']}")
    assert d_info_after.json()["status"] == "AVAILABLE"

@pytest.mark.anyio
async def test_trip_completes_only_after_full_payment(async_client: AsyncClient, admin_user, customer_user, driver_user):
    ctx = await setup_full_trip(async_client, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]
    request_id = ctx["request_id"]

    app.dependency_overrides[get_current_driver] = lambda: driver_user
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user

    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-transit")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/arrive")
    pod_resp = await async_client.post(f"/api/v1/driver/trips/{trip_id}/pod", json={
        "pod_signature_url": "https://storage.cargox.com/sig-payment-test.png",
        "notes": "Delivery confirmed"
    })
    assert pod_resp.status_code == 201
    verify_resp = await async_client.post(f"/api/v1/admin/trips/{trip_id}/verify-pod")
    assert verify_resp.status_code == 200

    invoice_resp = await async_client.get("/api/v1/customer/invoices")
    assert invoice_resp.status_code == 200
    invoice = next(item for item in invoice_resp.json() if item["request_id"] == request_id)
    invoice_id = invoice["id"]
    total_amount = Decimal(str(invoice["total_amount"]))

    partial_resp = await async_client.post(f"/api/v1/admin/invoices/{invoice_id}/payments", json={
        "amount": str(total_amount / 2), "method": "UPI", "reference_number": "UPI-PARTIAL-TEST"
    })
    assert partial_resp.status_code == 201
    request = await DeliveryRequest.find_one(DeliveryRequest.id == uuid.UUID(request_id))
    assert request.status == DeliveryRequestStatus.DELIVERED

    final_resp = await async_client.post(f"/api/v1/admin/invoices/{invoice_id}/payments", json={
        "amount": str(total_amount / 2), "method": "UPI", "reference_number": "UPI-FINAL-TEST"
    })
    assert final_resp.status_code == 201
    request = await DeliveryRequest.find_one(DeliveryRequest.id == uuid.UUID(request_id))
    assert request.status == DeliveryRequestStatus.COMPLETED

    vehicle = await async_client.get(f"/api/v1/admin/vehicles/{ctx['vehicle_id']}")
    assert vehicle.json()["status"] == "AVAILABLE"

@pytest.mark.anyio
async def test_gps_location_history_and_customer_tracking(async_client: AsyncClient, admin_user, customer_user, driver_user):
    ctx = await setup_full_trip(async_client, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]
    req_id = ctx["request_id"]

    app.dependency_overrides[get_current_driver] = lambda: driver_user
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user

    # Start pickup so live tracking is active
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")

    # Post GPS update
    gps_resp = await async_client.post(f"/api/v1/driver/trips/{trip_id}/location", json={
        "lat": 19.0760,
        "lng": 72.8777
    })
    assert gps_resp.status_code == 200

    # Post second GPS update
    gps_resp2 = await async_client.post(f"/api/v1/driver/trips/{trip_id}/location", json={
        "lat": 19.0800,
        "lng": 72.8800
    })
    assert gps_resp2.status_code == 200

    # Customer tracking query
    track_resp = await async_client.get(f"/api/v1/customer/requests/{req_id}/tracking")
    assert track_resp.status_code == 200
    track_data = track_resp.json()

    assert track_data["is_live"] is True
    assert track_data["current_lat"] == 19.0800
    assert track_data["current_lng"] == 72.8800
    assert len(track_data["breadcrumbs"]) == 2
    assert track_data["breadcrumbs"][0]["lat"] == 19.0760
    assert track_data["breadcrumbs"][1]["lat"] == 19.0800

    # Check IDOR: Another customer cannot access tracking
    other_company = CustomerCompany(
        id=uuid.uuid4(),
        name="Other Company",
        billing_address="Other Address",
        status=CompanyStatus.ACTIVE
    )
    await other_company.insert()

    uid2 = uuid.uuid4().hex[:8]
    customer2_user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_cust_other_{uid2}",
        email=f"cust_other_{uid2}@company.com",
        role=UserRole.CUSTOMER_USER,
        customer_company_id=other_company.id,
        is_active=True
    )
    await customer2_user.insert()

    app.dependency_overrides[get_current_customer_user] = lambda: customer2_user
    idor_resp = await async_client.get(f"/api/v1/customer/requests/{req_id}/tracking")
    assert idor_resp.status_code == 404

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_pod_recipient_details_and_admin_rejection_resubmission(async_client: AsyncClient, admin_user, customer_user, driver_user):
    from app.models.delivery import ProofOfDelivery

    ctx = await setup_full_trip(async_client, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]

    app.dependency_overrides[get_current_driver] = lambda: driver_user
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    # Move to ARRIVED
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-transit")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/arrive")

    # 1. Driver submits POD with recipient details
    pod_payload = {
        "receiver_name": "Ramesh Kumar Sharma",
        "receiver_phone": "+91 98765 43210",
        "delivery_confirmed": True,
        "pod_signature_url": "https://storage.cargox.com/signatures/rec_sign_123.png",
        "notes": "10 parcels received in sound condition"
    }
    pod_res = await async_client.post(f"/api/v1/driver/trips/{trip_id}/pod", json=pod_payload)
    assert pod_res.status_code == 201

    # Verify POD stored with server timestamp and authenticated driver
    stored_pod = await ProofOfDelivery.find_one(ProofOfDelivery.trip_id == uuid.UUID(trip_id))
    assert stored_pod is not None
    assert stored_pod.receiver_name == "Ramesh Kumar Sharma"
    assert stored_pod.receiver_phone == "+91 98765 43210"
    assert stored_pod.delivery_confirmed is True
    assert stored_pod.submitted_by == driver_user.id
    assert stored_pod.submitted_at is not None
    assert stored_pod.status == "SUBMITTED"

    # 2. Admin inspects trip detail and sees POD recipient fields
    detail_res = await async_client.get(f"/api/v1/admin/trips/{trip_id}")
    assert detail_res.status_code == 200
    trip_detail = detail_res.json()
    assert trip_detail["pod"] is not None
    assert trip_detail["pod"]["receiver_name"] == "Ramesh Kumar Sharma"
    assert trip_detail["pod"]["receiver_phone"] == "+91 98765 43210"
    assert trip_detail["pod"]["status"] == "SUBMITTED"

    # 3. Admin rejects POD with reason
    reject_res = await async_client.post(
        f"/api/v1/admin/trips/{trip_id}/reject-pod",
        json={"rejection_reason": "Recipient signature blurry; please re-capture clear signature."}
    )
    assert reject_res.status_code == 200
    reject_data = reject_res.json()
    assert reject_data["status"] == "REJECTED"
    assert "blurry" in reject_data["rejection_reason"]

    # Verify request transitioned back to ARRIVED
    check_req = await DeliveryRequest.find_one(DeliveryRequest.id == uuid.UUID(ctx["request_id"]))
    assert check_req.status == DeliveryRequestStatus.ARRIVED

    # 4. Driver resubmits corrected POD
    resubmit_res = await async_client.post(f"/api/v1/driver/trips/{trip_id}/pod", json={
        "receiver_name": "Ramesh Kumar Sharma",
        "receiver_phone": "+91 98765 43210",
        "delivery_confirmed": True,
        "pod_signature_url": "https://storage.cargox.com/signatures/rec_sign_clean_456.png",
        "notes": "Re-captured crisp recipient signature"
    })
    assert resubmit_res.status_code == 201

    # 5. Admin verifies corrected POD
    verify_res = await async_client.post(f"/api/v1/admin/trips/{trip_id}/verify-pod")
    assert verify_res.status_code == 200

    # 6. Verify status DELIVERED
    check_req_final = await DeliveryRequest.find_one(DeliveryRequest.id == uuid.UUID(ctx["request_id"]))
    assert check_req_final.status == DeliveryRequestStatus.DELIVERED

    app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_unauthorized_driver_cannot_submit_pod(async_client: AsyncClient, admin_user, customer_user, driver_user):
    ctx = await setup_full_trip(async_client, admin_user, customer_user, driver_user)
    trip_id = ctx["trip_id"]

    # Move to ARRIVED
    app.dependency_overrides[get_current_driver] = lambda: driver_user
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-pickup")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/start-transit")
    await async_client.post(f"/api/v1/driver/trips/{trip_id}/arrive")

    # Unauthorized driver attempts POD submission
    rogue_driver = User(id=uuid.uuid4(), email="rogue_driver@cargox.com", role=UserRole.DRIVER, is_active=True)
    await rogue_driver.insert()
    app.dependency_overrides[get_current_driver] = lambda: rogue_driver

    bad_pod = await async_client.post(f"/api/v1/driver/trips/{trip_id}/pod", json={
        "receiver_name": "Malicious Submitter",
        "delivery_confirmed": True,
        "pod_signature_url": "https://storage.cargox.com/bad.png"
    })
    assert bad_pod.status_code == 403

    app.dependency_overrides.clear()
