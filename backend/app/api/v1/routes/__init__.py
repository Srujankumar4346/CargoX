from fastapi import APIRouter
from app.api.v1.routes.admin_pricing import router as admin_pricing_router
from app.api.v1.routes.admin_fleet import router as admin_fleet_router
from app.api.v1.routes.admin_dispatch import router as admin_dispatch_router
from app.api.v1.routes.customer_quotations import router as customer_quotations_router
from app.api.v1.routes.driver_pwa import router as driver_pwa_router
from app.api.v1.routes.recipients import router as recipients_router
from app.api.v1.routes.requests import router as requests_router
from app.api.v1.routes.customer_tracking import router as customer_tracking_router

api_router = APIRouter()
api_router.include_router(admin_pricing_router, prefix="/admin", tags=["Admin Pricing & Quotations"])
api_router.include_router(admin_fleet_router, prefix="/admin", tags=["Admin Fleet Management"])
api_router.include_router(admin_dispatch_router, prefix="/admin", tags=["Admin Dispatch Workflow"])
api_router.include_router(customer_quotations_router, prefix="/customer/quotations", tags=["Customer Quotations"])
api_router.include_router(driver_pwa_router, prefix="/driver", tags=["Driver PWA"])
api_router.include_router(recipients_router, prefix="/customer/recipients", tags=["Customer Recipients"])
api_router.include_router(requests_router, prefix="/customer/requests", tags=["Customer Requests"])
api_router.include_router(customer_tracking_router, prefix="/customer/requests", tags=["Customer Tracking"])

