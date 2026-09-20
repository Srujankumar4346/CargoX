import pytest
from app.core.config import settings
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.database import init_db, client

# Force the database URL to a test database BEFORE anything connects
settings.DATABASE_URL = "mongodb://localhost:27017/cargox_test_db"

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
    
    # Initialize our test database explicitly, bypassing the hardcoded "cargox" in production init_db
    test_client = AsyncIOMotorClient("mongodb://localhost:27017/cargox_test_db")
    db_module.client = test_client # Mock the global client just in case
    
    # Drop to ensure clean state
    await test_client.drop_database("cargox_test_db")
    
    database = test_client["cargox_test_db"]
    
    from app.models.company import CustomerCompany, RecipientCompany
    from app.models.user import User
    from app.models.fleet import Vehicle, Driver, VehicleAssignment
    from app.models.pricing import PricingConfig, Quotation
    from app.models.delivery import DeliveryRequest, Trip, ProofOfDelivery, LocationHistory
    from app.models.finance import Invoice, Payment, DriverSettlement
    from app.models.notifications import Notification
    from app.models.operations import TripExpense, VehicleMaintenance
    
    await init_beanie(database=database, document_models=[
        CustomerCompany, RecipientCompany,
        User,
        Vehicle, Driver, VehicleAssignment,
        PricingConfig, Quotation,
        DeliveryRequest, Trip, ProofOfDelivery, LocationHistory,
        Invoice, Payment, DriverSettlement,
        Notification,
        TripExpense, VehicleMaintenance,
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

