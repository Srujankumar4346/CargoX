import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import status

from app.main import app
from app.api.deps import get_current_admin, get_current_customer_user, get_current_driver
from app.models.user import User
from app.models.company import CustomerCompany, RecipientCompany
from app.models.delivery import DeliveryRequest, Trip
from app.models.fleet import Vehicle, Driver, VehicleAssignment
from app.models.enums import (
    UserRole, CompanyStatus, DeliveryRequestStatus,
    VehicleType, VehicleStatus, DriverStatus
)
from app.core.config import settings

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


# ─────────────────────────────────────────────────────────────────────────────
# 1. Team & User Management: Revoke Admin & Role-Aware Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_admin_revoke_admin_to_customer_user(async_client, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    # Create secondary admin
    sec_admin = User(
        id=uuid.uuid4(),
        clerk_user_id="user_secondary_admin",
        email="secondary_admin@cargox.com",
        role=UserRole.ADMIN,
        is_active=True
    )
    await sec_admin.insert()

    # Demote to CUSTOMER_USER (the canonical role)
    resp = await async_client.put(
        f"/api/v1/admin/users/{str(sec_admin.id)}/role",
        json={"role": "CUSTOMER_USER"}
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["role"] == "CUSTOMER_USER"

    updated = await User.get(sec_admin.id)
    assert updated.role == UserRole.CUSTOMER_USER


@pytest.mark.anyio
async def test_revoke_admin_rejects_customer_string(async_client, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    target = User(
        id=uuid.uuid4(),
        clerk_user_id="user_test_reject",
        email="reject@cargox.com",
        role=UserRole.ADMIN,
        is_active=True
    )
    await target.insert()

    # Must reject "CUSTOMER" since only "CUSTOMER_USER", "ADMIN", "DRIVER" are valid
    resp = await async_client.put(
        f"/api/v1/admin/users/{str(target.id)}/role",
        json={"role": "CUSTOMER"}
    )
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.anyio
async def test_primary_admin_cannot_be_demoted_conflict(async_client, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    settings.CARGOX_PRIMARY_ADMIN_CLERK_ID = "primary_admin_clerk_999"
    primary = User(
        id=uuid.uuid4(),
        clerk_user_id="primary_admin_clerk_999",
        email="head_admin@cargox.com",
        role=UserRole.ADMIN,
        is_active=True
    )
    await primary.insert()

    resp = await async_client.put(
        f"/api/v1/admin/users/{str(primary.id)}/role",
        json={"role": "CUSTOMER_USER"}
    )
    assert resp.status_code == status.HTTP_409_CONFLICT
    assert "Primary administrator cannot be demoted" in resp.json()["detail"]


# ─────────────────────────────────────────────────────────────────────────────
# 2. Driver Creation & Clerk Linkage Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_admin_create_driver_provisions_driver_user(async_client, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    driver_email = f"driver_{uuid.uuid4().hex[:6]}@gmail.com"
    payload = {
        "name": "Ramesh Kumar",
        "email": driver_email,
        "phone": "9876543210",
        "license_number": f"DL{uuid.uuid4().hex[:10].upper()}",
        "aadhaar_number": "123456789012",
        "age": 32
    }

    resp = await async_client.post("/api/v1/admin/drivers", json=payload)
    assert resp.status_code == status.HTTP_201_CREATED
    driver_data = resp.json()
    assert driver_data["name"] == "Ramesh Kumar"
    assert driver_data["status"] == "AVAILABLE"

    # Verify a User account was provisioned with role = DRIVER
    driver_user_record = await User.find_one(User.email == driver_email)
    assert driver_user_record is not None
    assert driver_user_record.role == UserRole.DRIVER
    assert driver_user_record.id == uuid.UUID(driver_data["user_id"])


@pytest.mark.anyio
async def test_clerk_login_links_to_precreated_driver_account():
    from app.api.deps import get_current_user
    driver_email = f"driver_clerk_{uuid.uuid4().hex[:6]}@gmail.com"

    # Pre-existing user created by Admin
    pre_user = User(
        id=uuid.uuid4(),
        clerk_user_id=None,
        email=driver_email,
        role=UserRole.DRIVER,
        is_active=True
    )
    await pre_user.insert()

    # Simulate first Clerk token verification with this email
    token_data = {
        "sub": "clerk_driver_sub_12345",
        "email": driver_email
    }

    authenticated_user = await get_current_user(token_data=token_data)
    assert authenticated_user.id == pre_user.id
    assert authenticated_user.clerk_user_id == "clerk_driver_sub_12345"
    assert authenticated_user.role == UserRole.DRIVER


# ─────────────────────────────────────────────────────────────────────────────
# 3. Fleet Status: Delete & Preservation Rules Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_vehicle_list_annotates_is_deletable(async_client, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    # Pristine vehicle
    v1 = Vehicle(
        registration_number="TS09AB1001",
        type=VehicleType.OPEN,
        capacity_tons=5.0,
        status=VehicleStatus.AVAILABLE
    )
    await v1.insert()

    # Vehicle with historical assignment
    v2 = Vehicle(
        registration_number="TS09AB1002",
        type=VehicleType.OPEN,
        capacity_tons=10.0,
        status=VehicleStatus.AVAILABLE
    )
    await v2.insert()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    assignment = VehicleAssignment(
        trip_id=uuid.uuid4(),
        vehicle_id=v2.id,
        driver_id=uuid.uuid4(),
        assigned_at=now,
        released_at=now
    )
    await assignment.insert()

    resp = await async_client.get("/api/v1/admin/vehicles")
    assert resp.status_code == status.HTTP_200_OK
    items = resp.json()

    item1 = next(item for item in items if item["id"] == str(v1.id))
    assert item1["is_deletable"] is True

    item2 = next(item for item in items if item["id"] == str(v2.id))
    assert item2["is_deletable"] is False


@pytest.mark.anyio
async def test_historical_vehicle_deletion_preserves_record_in_maintenance(async_client, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    v = Vehicle(
        registration_number="TS09AB9999",
        type=VehicleType.OPEN,
        capacity_tons=8.0,
        status=VehicleStatus.AVAILABLE
    )
    await v.insert()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    assignment = VehicleAssignment(
        trip_id=uuid.uuid4(),
        vehicle_id=v.id,
        driver_id=uuid.uuid4(),
        assigned_at=now,
        released_at=now
    )
    await assignment.insert()

    # Delete request
    resp = await async_client.delete(f"/api/v1/admin/vehicles/{str(v.id)}")
    assert resp.status_code == status.HTTP_204_NO_CONTENT

    # Verify vehicle was NOT deleted from DB, but preserved in MAINTENANCE status
    stored = await Vehicle.get(v.id)
    assert stored is not None
    assert stored.status == VehicleStatus.MAINTENANCE


# ─────────────────────────────────────────────────────────────────────────────
# 4. Location & Navigation Coordinates Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_delivery_request_preserves_coordinates(async_client, customer_user):
    app.dependency_overrides[get_current_customer_user] = lambda: customer_user

    payload = {
        "goods_type": "MACHINERY",
        "weight_tons": 4.5,
        "pickup_company_name": "Azad Industries",
        "pickup_address": "Balanagar, Hyderabad",
        "pickup_lat": 17.4700,
        "pickup_lng": 78.4400,
        "destination_company_name": "St. Martins Engineering College",
        "destination_address": "Dhulapally, Secunderabad",
        "destination_lat": 17.5400,
        "destination_lng": 78.4700
    }

    resp = await async_client.post("/api/v1/customer/requests", json=payload)
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()
    assert data["pickup_lat"] == 17.4700
    assert data["pickup_lng"] == 78.4400
    assert data["destination_lat"] == 17.5400
    assert data["destination_lng"] == 78.4700


@pytest.mark.anyio
async def test_driver_cannot_access_admin_portal(async_client, driver_user):
    app.dependency_overrides.clear()
    from app.api.deps import get_current_user
    app.dependency_overrides[get_current_user] = lambda: driver_user

    # Driver role attempting to list users or vehicles
    resp = await async_client.get("/api/v1/admin/users/")
    # get_current_admin raises 403 for DRIVER role
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    app.dependency_overrides.clear()
