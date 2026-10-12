import pytest
from app.core.config import settings
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.database import init_db, client

import os
from motor.motor_asyncio import AsyncIOMotorClient

# Resolve target test database URL
_db_base_url = os.getenv("DATABASE_URL", settings.DATABASE_URL)
if "mongodb+srv://" in _db_base_url or "mongodb://" in _db_base_url:
    # Use cargox_test_db database
    if "?" in _db_base_url:
        _prefix, _query = _db_base_url.split("?", 1)
        _base = _prefix.rstrip("/")
        if not _base.endswith("/cargox_test_db"):
            _target_db_url = f"{_base}/cargox_test_db?{_query}"
        else:
            _target_db_url = _db_base_url
    else:
        _base = _db_base_url.rstrip("/")
        _target_db_url = f"{_base}/cargox_test_db"
else:
    _target_db_url = "mongodb://localhost:27017/cargox_test_db"

settings.DATABASE_URL = _target_db_url

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture(autouse=True)
async def setup_db():
    """
    Initialize Beanie with the test database and drop it before every test.
    This guarantees clean isolation for each test execution.
    """
    from motor.motor_asyncio import AsyncIOMotorClient
    from beanie import init_beanie
    import app.db.database as db_module
    
    test_client = AsyncIOMotorClient(settings.DATABASE_URL)
    db_module.client = test_client # Mock the global client
    
    # Clean test collections
    database = test_client["cargox_test_db"]
    try:
        await test_client.drop_database("cargox_test_db")
    except Exception:
        pass
    
    from app.models.company import CustomerCompany, RecipientCompany
    from app.models.user import User
    from app.models.fleet import Vehicle, Driver, VehicleAssignment
    from app.models.pricing import PricingConfig, Quotation
    from app.models.delivery import DeliveryRequest, Trip, ProofOfDelivery, LocationHistory
    from app.models.finance import Invoice, Payment, DriverSettlement
    from app.models.notifications import Notification
    from app.models.operations import TripExpense, VehicleMaintenance
    from app.models.settings import SystemSettings
    
    await init_beanie(database=database, document_models=[
        CustomerCompany, RecipientCompany,
        User,
        Vehicle, Driver, VehicleAssignment,
        PricingConfig, Quotation,
        DeliveryRequest, Trip, ProofOfDelivery, LocationHistory,
        Invoice, Payment, DriverSettlement,
        Notification,
        TripExpense, VehicleMaintenance, SystemSettings,
    ])
    
    yield

    
    # Optional: cleanup after test
    # await client.drop_database("cargox_test_db")

@pytest.fixture
async def async_client():
    """
    Provides an asynchronous HTTP client for testing FastAPI endpoints.
    Replaces the synchronous TestClient to prevent event loop conflicts with Beanie.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver", follow_redirects=True) as client:
        yield client

