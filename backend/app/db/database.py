from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
import os

client = None

# Monkey patch AsyncIOMotorClient for Beanie compatibility with newer Motor versions
if not hasattr(AsyncIOMotorClient, 'append_metadata'):
    AsyncIOMotorClient.append_metadata = lambda self, *args, **kwargs: None

async def init_db():
    global client
    # Render or Docker env may not have a default database in the URL, so we parse it or default to cargox
    db_url = settings.DATABASE_URL
    if not db_url.startswith("mongodb"):
        # Temporarily handle if it's still postgresql string locally
        db_url = "mongodb://localhost:27017/cargox"
        
    client = AsyncIOMotorClient(db_url)
    
    # Extract DB name from URL if possible, or fallback
    db_name = "cargox"
    
    database = client[db_name]
    
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
