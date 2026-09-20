import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta

from app.models.enums import UserRole, QuotationStatus, DeliveryRequestStatus
from app.models.user import User
from app.models.pricing import Quotation
from app.models.delivery import DeliveryRequest
from app.api.deps import get_current_customer_user, get_current_admin
from app.main import app

@pytest.mark.anyio
async def test_customer_schema_hides_internal_cost(async_client):
    company_id = uuid.uuid4()
    req_id = uuid.uuid4()
    quot_id = uuid.uuid4()
    
    # Insert mock data into database
    req = DeliveryRequest(
        id=req_id,
        customer_company_id=company_id,
        status=DeliveryRequestStatus.SUBMITTED,
        pickup_address="Pickup",
        delivery_address="Dropoff",
        pickup_date=datetime.now(timezone.utc),
        cargo_description="Test",
        cargo_weight_tons=1.0,
        request_number="REQ-1234",
        goods_type="General",
        weight_tons=Decimal("1.0"),
        pickup_company_name="Sender",
        destination_company_name="Receiver",
        destination_address="Dropoff",
        distance_km=Decimal("10.0"),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    await req.insert()
    
    quot = Quotation(
        id=quot_id,
        request_id=req_id,
        distance_km=Decimal("100.5"),
        customer_total_charge=Decimal("500.0"),
        status=QuotationStatus.PENDING,
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        pricing_config_id=uuid.uuid4(),
        base_rate_per_km=Decimal("2.5"),
        internal_base_cost=Decimal("251.25"),
        cargox_margin=Decimal("248.75")
    )
    await quot.insert()

    user = User(id=uuid.uuid4(), role=UserRole.CUSTOMER_USER, customer_company_id=company_id, email="test@test.com", clerk_user_id="test")
    app.dependency_overrides[get_current_customer_user] = lambda: user

    try:
        response = await async_client.get(f"/api/v1/customer/quotations/{quot_id}")
        assert response.status_code == 200
        data = response.json()
        assert "customer_total_charge" in data
        assert "internal_base_cost" not in data
    finally:
        app.dependency_overrides.pop(get_current_customer_user, None)


@pytest.mark.anyio
async def test_admin_schema_shows_internal_cost(async_client):
    req_id = uuid.uuid4()
    quot_id = uuid.uuid4()
    
    quot = Quotation(
        id=quot_id,
        request_id=req_id,
        distance_km=Decimal("100.5"),
        customer_total_charge=Decimal("500.0"),
        status=QuotationStatus.PENDING,
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        pricing_config_id=uuid.uuid4(),
        base_rate_per_km=Decimal("2.5"),
        internal_base_cost=Decimal("251.25"),
        cargox_margin=Decimal("248.75")
    )
    await quot.insert()

    user = User(id=uuid.uuid4(), role=UserRole.ADMIN, email="admin@test.com", clerk_user_id="admin")
    app.dependency_overrides[get_current_admin] = lambda: user

    try:
        response = await async_client.get(f"/api/v1/admin/quotations/{quot_id}")
        assert response.status_code == 200
        data = response.json()
        assert "internal_base_cost" in data
    finally:
        app.dependency_overrides.pop(get_current_admin, None)


@pytest.mark.anyio
async def test_cross_company_access_blocked(async_client):
    company_a_id = uuid.uuid4()
    company_b_id = uuid.uuid4()
    req_id = uuid.uuid4()
    quot_id = uuid.uuid4()
    
    # Request belongs to company B
    req = DeliveryRequest(
        id=req_id,
        customer_company_id=company_b_id,
        status=DeliveryRequestStatus.SUBMITTED,
        pickup_address="Pickup",
        delivery_address="Dropoff",
        pickup_date=datetime.now(timezone.utc),
        cargo_description="Test",
        cargo_weight_tons=1.0,
        request_number="REQ-1234",
        goods_type="General",
        weight_tons=Decimal("1.0"),
        pickup_company_name="Sender",
        destination_company_name="Receiver",
        destination_address="Dropoff",
        distance_km=Decimal("10.0"),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    await req.insert()
    
    quot = Quotation(
        id=quot_id,
        request_id=req_id,
        distance_km=Decimal("100.5"),
        customer_total_charge=Decimal("500.0"),
        status=QuotationStatus.PENDING,
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        pricing_config_id=uuid.uuid4(),
        base_rate_per_km=Decimal("2.5"),
        internal_base_cost=Decimal("251.25"),
        cargox_margin=Decimal("248.75")
    )
    await quot.insert()

    # User is in company A
    user = User(id=uuid.uuid4(), role=UserRole.CUSTOMER_USER, customer_company_id=company_a_id, email="a@test.com", clerk_user_id="a")
    app.dependency_overrides[get_current_customer_user] = lambda: user

    try:
        response = await async_client.get(f"/api/v1/customer/quotations/{quot_id}")
        assert response.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_customer_user, None)


@pytest.mark.anyio
async def test_nonexistent_quotation_blocked(async_client):
    company_id = uuid.uuid4()
    quot_id = uuid.uuid4()
    
    user = User(id=uuid.uuid4(), role=UserRole.CUSTOMER_USER, customer_company_id=company_id, email="c@test.com", clerk_user_id="c")
    app.dependency_overrides[get_current_customer_user] = lambda: user

    try:
        response = await async_client.get(f"/api/v1/customer/quotations/{quot_id}")
        assert response.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_customer_user, None)
