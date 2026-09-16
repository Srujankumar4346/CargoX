import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI
from unittest.mock import MagicMock
from app.api.v1.routes.customer_quotations import router as customer_router
from app.api.v1.routes.admin_pricing import router as admin_router
from app.api.deps import get_current_customer_user, get_current_admin
from app.db.database import get_db
from app.models.user import User
from app.models.enums import UserRole, QuotationStatus
from datetime import datetime, timezone, timedelta
import uuid

app = FastAPI()
app.include_router(customer_router, prefix="/api/v1/customer/quotations")
app.include_router(admin_router, prefix="/api/v1/admin")

# Mock classes
class MockDeliveryRequest:
    def __init__(self, request_id, customer_company_id):
        self.id = request_id
        self.customer_company_id = customer_company_id

class MockQuotation:
    def __init__(self, quotation_id, request_id):
        self.id = quotation_id
        self.request_id = request_id
        self.distance_km = 100.5
        self.customer_total_charge = 500.0
        self.status = QuotationStatus.PENDING
        self.created_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self.expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=1)
        self.pricing_config_id = uuid.uuid4()
        self.base_rate_per_km = 2.5
        self.internal_base_cost = 251.25
        self.cargox_margin = 248.75

def test_customer_schema_hides_internal_cost():
    company_id = uuid.uuid4()
    req_id = uuid.uuid4()
    quot_id = uuid.uuid4()
    
    def override_get_current_customer():
        return User(id="1", role=UserRole.CUSTOMER_USER, customer_company_id=company_id)
        
    db_mock = MagicMock()
    db_mock.query().filter().first.side_effect = [
        MockQuotation(quot_id, req_id),
        MockDeliveryRequest(req_id, company_id)
    ]
        
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer
    app.dependency_overrides[get_db] = lambda: db_mock
    
    client = TestClient(app)
    response = client.get(f"/api/v1/customer/quotations/{quot_id}")
    
    assert response.status_code == 200
    data = response.json()
    assert "customer_total_charge" in data
    assert "internal_base_cost" not in data

def test_admin_schema_shows_internal_cost():
    req_id = uuid.uuid4()
    quot_id = uuid.uuid4()
    
    def override_get_current_admin():
        return User(id="1", role=UserRole.ADMIN)
        
    db_mock = MagicMock()
    db_mock.query().filter().first.return_value = MockQuotation(quot_id, req_id)
        
    app.dependency_overrides[get_current_admin] = override_get_current_admin
    app.dependency_overrides[get_db] = lambda: db_mock
    
    client = TestClient(app)
    response = client.get(f"/api/v1/admin/quotations/{quot_id}")
    
    assert response.status_code == 200
    data = response.json()
    assert "internal_base_cost" in data

def test_cross_company_access_blocked():
    company_a_id = uuid.uuid4()
    company_b_id = uuid.uuid4()
    req_id = uuid.uuid4()
    quot_id = uuid.uuid4()
    
    def override_get_current_customer():
        return User(id="1", role=UserRole.CUSTOMER_USER, customer_company_id=company_a_id)
        
    db_mock = MagicMock()
    db_mock.query().filter().first.side_effect = [
        MockQuotation(quot_id, req_id),
        MockDeliveryRequest(req_id, company_b_id) # belongs to company B
    ]
        
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer
    app.dependency_overrides[get_db] = lambda: db_mock
    
    client = TestClient(app)
    response = client.get(f"/api/v1/customer/quotations/{quot_id}")
    
    assert response.status_code == 404

def test_nonexistent_quotation_blocked():
    company_id = uuid.uuid4()
    quot_id = uuid.uuid4()
    
    def override_get_current_customer():
        return User(id="1", role=UserRole.CUSTOMER_USER, customer_company_id=company_id)
        
    db_mock = MagicMock()
    db_mock.query().filter().first.return_value = None # None found
        
    app.dependency_overrides[get_current_customer_user] = override_get_current_customer
    app.dependency_overrides[get_db] = lambda: db_mock
    
    client = TestClient(app)
    response = client.get(f"/api/v1/customer/quotations/{quot_id}")
    
    assert response.status_code == 404
