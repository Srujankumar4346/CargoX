import pytest
import uuid
from fastapi import status
from app.main import app
from app.models.enums import UserRole
from app.models.user import User
from app.core.config import settings
from app.models.company import CustomerCompany
from app.models.enums import CompanyStatus

@pytest.fixture
def auth_headers_primary_admin(async_client):
    # We simulate the token verification by returning the primary admin clerk id
    clerk_id = "user_primary_admin"
    settings.CARGOX_PRIMARY_ADMIN_CLERK_ID = clerk_id
    
    # Normally deps.py uses decode_token. Since we mock decode_token or get_current_user_token in tests,
    # we override the dependency.
    from app.api.deps import get_current_user_token
    app.dependency_overrides[get_current_user_token] = lambda: {"sub": clerk_id, "email": "admin@cargox.com"}
    yield {"Authorization": "Bearer fake_token"}
    app.dependency_overrides.pop(get_current_user_token, None)

@pytest.fixture
def auth_headers_new_customer(async_client):
    clerk_id = "user_new_customer"
    from app.api.deps import get_current_user_token
    app.dependency_overrides[get_current_user_token] = lambda: {"sub": clerk_id, "email": "new_cust@cargox.com"}
    yield {"Authorization": "Bearer fake_token"}
    app.dependency_overrides.pop(get_current_user_token, None)

@pytest.mark.anyio
async def test_primary_admin_auto_provisioning(async_client, auth_headers_primary_admin):
    # Calling any endpoint that uses get_current_user should provision the admin
    response = await async_client.get("/api/v1/admin/users", headers=auth_headers_primary_admin)
    assert response.status_code == status.HTTP_200_OK
    
    # Verify in DB
    user = await User.find_one(User.clerk_user_id == "user_primary_admin")
    assert user is not None
    assert user.role == UserRole.ADMIN
    assert user.customer_company_id is None

@pytest.mark.anyio
async def test_new_customer_auto_provisioning(async_client, auth_headers_new_customer):
    # Customer trying to access admin endpoint
    response = await async_client.get("/api/v1/admin/users", headers=auth_headers_new_customer)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    
    # Verify in DB that they were provisioned correctly as CUSTOMER_USER with no company
    user = await User.find_one(User.clerk_user_id == "user_new_customer")
    assert user is not None
    assert user.role == UserRole.CUSTOMER_USER
    assert user.customer_company_id is None

@pytest.mark.anyio
async def test_admin_can_update_role(async_client, auth_headers_primary_admin):
    # Seed a target user with valid company
    company_id = uuid.uuid4()
    company = CustomerCompany(id=company_id, name="Target Company", billing_address="123", status=CompanyStatus.ACTIVE)
    await company.insert()
    
    target_user = User(id=uuid.uuid4(), clerk_user_id="user_target", email="target@cargox.com", role=UserRole.CUSTOMER_USER, customer_company_id=company_id, is_active=True)
    await target_user.insert()
    
    response = await async_client.put(
        f"/api/v1/admin/users/{str(target_user.id)}/role",
        headers=auth_headers_primary_admin,
        json={"role": UserRole.ADMIN.value}
    )
    assert response.status_code == status.HTTP_200_OK
    
    # Verify DB
    updated_user = await User.get(target_user.id)
    assert updated_user.role == UserRole.ADMIN
    assert updated_user.customer_company_id is not None # Preserved!

@pytest.mark.anyio
async def test_admin_cannot_demote_primary_admin(async_client, auth_headers_primary_admin):
    # Provision primary admin
    await async_client.get("/api/v1/admin/users", headers=auth_headers_primary_admin)
    primary_admin = await User.find_one(User.clerk_user_id == "user_primary_admin")
    
    response = await async_client.put(
        f"/api/v1/admin/users/{str(primary_admin.id)}/role",
        headers=auth_headers_primary_admin,
        json={"role": UserRole.CUSTOMER_USER.value}
    )
    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json()["detail"] == "Primary administrator cannot be demoted."
