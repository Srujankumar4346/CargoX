import pytest
import uuid
from fastapi import HTTPException
from app.api.deps import get_current_user, get_current_admin, get_current_customer_user, get_current_driver
from app.models.user import User
from app.models.enums import UserRole
from app.models.company import CustomerCompany
from app.services.authorization import AuthorizationService
from app.main import app

@pytest.fixture(autouse=True)
def cleanup_database():
    yield
    app.dependency_overrides.clear()

@pytest.mark.anyio
async def test_get_current_user_active():
    user = User(
        id=uuid.uuid4(),
        clerk_user_id="user_123",
        email="active@example.com",
        is_active=True,
        role=UserRole.ADMIN
    )
    await user.insert()
    
    result = await get_current_user({"sub": "user_123", "email": "active@example.com"})
    assert result.clerk_user_id == "user_123"

@pytest.mark.anyio
async def test_get_current_user_inactive():
    user = User(
        id=uuid.uuid4(),
        clerk_user_id="user_inactive",
        email="inactive@example.com",
        is_active=False,
        role=UserRole.ADMIN
    )
    await user.insert()
    
    with pytest.raises(HTTPException) as exc:
        await get_current_user({"sub": "user_inactive", "email": "inactive@example.com"})
    assert exc.value.status_code == 403
    assert exc.value.detail == "Inactive user"

@pytest.mark.anyio
async def test_get_current_user_auto_provisioning():
    result = await get_current_user({"sub": "unknown", "email": "unknown@example.com"})
    assert result.clerk_user_id == "unknown"
    assert result.role == UserRole.CUSTOMER_USER

@pytest.mark.anyio
async def test_get_current_admin_success():
    user_mock = User(id=uuid.uuid4(), clerk_user_id="user_123", email="a@a.com", is_active=True, role=UserRole.ADMIN)
    result = await get_current_admin(user_mock)
    assert result == user_mock

@pytest.mark.anyio
async def test_get_current_admin_failure():
    user_mock = User(id=uuid.uuid4(), clerk_user_id="user_123", email="a@a.com", is_active=True, role=UserRole.CUSTOMER_USER)
    with pytest.raises(HTTPException) as exc:
        await get_current_admin(user_mock)
    assert exc.value.status_code == 403

@pytest.mark.anyio
async def test_get_current_customer_success():
    company_id = uuid.uuid4()
    user_mock = User(id=uuid.uuid4(), clerk_user_id="user_123", email="a@a.com", is_active=True, role=UserRole.CUSTOMER_USER, customer_company_id=company_id)
    result = await get_current_customer_user(user_mock)
    assert result == user_mock

@pytest.mark.anyio
async def test_get_current_customer_failure_wrong_role():
    user_mock = User(id=uuid.uuid4(), clerk_user_id="user_123", email="a@a.com", is_active=True, role=UserRole.DRIVER)
    with pytest.raises(HTTPException) as exc:
        await get_current_customer_user(user_mock)
    assert exc.value.status_code == 403

@pytest.mark.anyio
async def test_get_current_customer_auto_creates_company():
    user_mock = User(id=uuid.uuid4(), clerk_user_id="user_123", email="a@a.com", is_active=True, role=UserRole.CUSTOMER_USER, customer_company_id=None)
    await user_mock.insert()
    result = await get_current_customer_user(user_mock)
    assert result.customer_company_id is not None

@pytest.mark.anyio
async def test_get_current_driver_success():
    user_mock = User(id=uuid.uuid4(), clerk_user_id="user_123", email="a@a.com", is_active=True, role=UserRole.DRIVER)
    result = await get_current_driver(user_mock)
    assert result == user_mock

@pytest.mark.anyio
async def test_get_current_driver_failure():
    user_mock = User(id=uuid.uuid4(), clerk_user_id="user_123", email="a@a.com", is_active=True, role=UserRole.CUSTOMER_USER)
    with pytest.raises(HTTPException) as exc:
        await get_current_driver(user_mock)
    assert exc.value.status_code == 403

@pytest.mark.anyio
async def test_authorization_customer_access_allowed():
    company_id = uuid.uuid4()
    user_mock = User(id=uuid.uuid4(), clerk_user_id="123", role=UserRole.CUSTOMER_USER, email='test@example.com', customer_company_id=company_id)
    AuthorizationService.verify_customer_access(user_mock, company_id)

@pytest.mark.anyio
async def test_authorization_customer_access_blocked():
    company_id = uuid.uuid4()
    other_company_id = uuid.uuid4()
    user_mock = User(id=uuid.uuid4(), clerk_user_id="123", role=UserRole.CUSTOMER_USER, email='test@example.com', customer_company_id=company_id)
    with pytest.raises(HTTPException) as exc:
        AuthorizationService.verify_customer_access(user_mock, other_company_id)
    assert exc.value.status_code == 404

@pytest.mark.anyio
async def test_authorization_driver_access_blocked_for_customer():
    user_mock = User(id=uuid.uuid4(), clerk_user_id="123", role=UserRole.CUSTOMER_USER, email='test@example.com')
    with pytest.raises(HTTPException) as exc:
        await AuthorizationService.verify_driver_trip_access(user_mock, uuid.uuid4())
    assert exc.value.status_code == 403

# Skipping `verify_driver_trip_access` specific driver mock tests because it relies on querying Driver collection in Beanie, which requires a real Driver record. We can test it later if needed.
