from fastapi import APIRouter
from app.api.routes import bookings, vehicles, drivers, trips, financials, tracking, intelligence, notifications

api_router = APIRouter()
api_router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["vehicles"])
api_router.include_router(drivers.router, prefix="/drivers", tags=["drivers"])
api_router.include_router(trips.router, prefix="/trips", tags=["trips"])
api_router.include_router(financials.router, prefix="/financials", tags=["financials"])
api_router.include_router(tracking.router, prefix="/tracking", tags=["tracking"])
api_router.include_router(intelligence.router, prefix="/intelligence", tags=["intelligence"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
