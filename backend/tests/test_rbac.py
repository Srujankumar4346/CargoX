import pytest
from fastapi import HTTPException
from unittest.mock import MagicMock, patch
from app.api.deps import get_current_user, get_current_admin, get_current_customer_user, get_current_driver
from app.models.user import User
from app.models.enums import UserRole

def test_get_current_user_active():
    db_mock = MagicMock()
    user_mock = User(id="1", clerk_user_id="user_123", is_active=True, role=UserRole.ADMIN)
    db_mock.query().filter().first.return_value = user_mock
    
    result = get_current_user({"sub": "user_123"}, db=db_mock)
    assert result.clerk_user_id == "user_123"

def test_get_current_user_inactive():
    db_mock = MagicMock()
    user_mock = User(id="1", clerk_user_id="user_123", is_active=False, role=UserRole.ADMIN)
    db_mock.query().filter().first.return_value = user_mock
    
    with pytest.raises(HTTPException) as exc:
        get_current_user({"sub": "user_123"}, db=db_mock)
    assert exc.value.status_code == 403
    assert exc.value.detail == "Inactive user"

def test_get_current_user_auto_provisioning():
    db_mock = MagicMock()
    # First call returns None (user not found), second call (if rollback happens) returns None
    db_mock.query().filter().first.return_value = None
    
    # We must patch the User instance's is_active because the mock db won't set defaults
    with patch('app.api.deps.User') as user_cls_mock:
        user_instance = MagicMock()
        user_instance.is_active = True
        user_instance.clerk_user_id = "unknown"
        user_cls_mock.return_value = user_instance
        
        result = get_current_user({"sub": "unknown"}, db=db_mock)
        
        db_mock.add.assert_called_once_with(user_instance)
        db_mock.commit.assert_called_once()
        assert result.clerk_user_id == "unknown"

def test_get_current_admin_success():
    user_mock = User(id="1", clerk_user_id="user_123", is_active=True, role=UserRole.ADMIN)
    result = get_current_admin(user_mock)
    assert result == user_mock

def test_get_current_admin_failure():
    user_mock = User(id="1", clerk_user_id="user_123", is_active=True, role=UserRole.CUSTOMER_USER)
    with pytest.raises(HTTPException) as exc:
        get_current_admin(user_mock)
    assert exc.value.status_code == 403

def test_get_current_customer_success():
    user_mock = User(id="1", clerk_user_id="user_123", is_active=True, role=UserRole.CUSTOMER_USER, customer_company_id="company_1")
    result = get_current_customer_user(user_mock)
    assert result == user_mock

def test_get_current_customer_failure_wrong_role():
    user_mock = User(id="1", clerk_user_id="user_123", is_active=True, role=UserRole.DRIVER)
    with pytest.raises(HTTPException) as exc:
        get_current_customer_user(user_mock)
    assert exc.value.status_code == 403

def test_get_current_customer_failure_no_company():
    user_mock = User(id="1", clerk_user_id="user_123", is_active=True, role=UserRole.CUSTOMER_USER, customer_company_id=None)
    with pytest.raises(HTTPException) as exc:
        get_current_customer_user(user_mock)
    assert exc.value.status_code == 403

def test_get_current_driver_success():
    user_mock = User(id="1", clerk_user_id="user_123", is_active=True, role=UserRole.DRIVER)
    result = get_current_driver(user_mock)
    assert result == user_mock

def test_get_current_driver_failure():
    user_mock = User(id="1", clerk_user_id="user_123", is_active=True, role=UserRole.CUSTOMER_USER)
    with pytest.raises(HTTPException) as exc:
        get_current_driver(user_mock)
    assert exc.value.status_code == 403

from app.services.authorization import AuthorizationService
import uuid

def test_authorization_customer_access_allowed():
    company_id = uuid.uuid4()
    user_mock = User(role=UserRole.CUSTOMER_USER, customer_company_id=company_id)
    # Should not raise
    AuthorizationService.verify_customer_access(user_mock, company_id)

def test_authorization_customer_access_blocked():
    company_id = uuid.uuid4()
    other_company_id = uuid.uuid4()
    user_mock = User(role=UserRole.CUSTOMER_USER, customer_company_id=company_id)
    with pytest.raises(HTTPException) as exc:
        AuthorizationService.verify_customer_access(user_mock, other_company_id)
    assert exc.value.status_code == 404

def test_authorization_driver_access_blocked_for_customer():
    user_mock = User(role=UserRole.CUSTOMER_USER)
    with pytest.raises(HTTPException) as exc:
        AuthorizationService.verify_driver_trip_access(user_mock, uuid.uuid4())
    assert exc.value.status_code == 403

def test_authorization_driver_access_allowed():
    driver_id = uuid.uuid4()
    user_mock = MagicMock(role=UserRole.DRIVER)
    user_mock.driver.id = driver_id
    # Should not raise
    AuthorizationService.verify_driver_trip_access(user_mock, driver_id)

def test_authorization_driver_access_blocked():
    driver_id = uuid.uuid4()
    other_driver_id = uuid.uuid4()
    user_mock = MagicMock(role=UserRole.DRIVER)
    user_mock.driver.id = driver_id
    with pytest.raises(HTTPException) as exc:
        AuthorizationService.verify_driver_trip_access(user_mock, other_driver_id)
    assert exc.value.status_code == 404

def test_authorization_driver_access_released():
    driver_id = uuid.uuid4()
    user_mock = MagicMock(role=UserRole.DRIVER)
    user_mock.driver.id = driver_id
    with pytest.raises(HTTPException) as exc:
        AuthorizationService.verify_driver_trip_access(user_mock, driver_id, is_released=True)
    assert exc.value.status_code == 404

