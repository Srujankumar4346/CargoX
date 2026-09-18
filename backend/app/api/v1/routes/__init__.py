from fastapi import APIRouter
from app.api.v1.routes.admin_pricing import router as admin_pricing_router
from app.api.v1.routes.admin_fleet import router as admin_fleet_router
from app.api.v1.routes.admin_dispatch import router as admin_dispatch_router
from app.api.v1.routes.admin_invoices import router as admin_invoices_router
from app.api.v1.routes.admin_analytics import router as admin_analytics_router
from app.api.v1.routes.customer_quotations import router as customer_quotations_router
from app.api.v1.routes.customer_invoices import router as customer_invoices_router
from app.api.v1.routes.driver_pwa import router as driver_pwa_router
from app.api.v1.routes.recipients import router as recipients_router
from app.api.v1.routes.requests import router as requests_router
from app.api.v1.routes.customer_tracking import router as customer_tracking_router

from app.api.v1.routes.admin_expenses import router as admin_expenses_router
from app.api.v1.routes.driver_expenses import router as driver_expenses_router
from app.api.v1.routes.admin_maintenance import router as admin_maintenance_router
from app.api.v1.routes.admin_settlements import router as admin_settlements_router
from app.api.v1.routes.admin_compliance import router as admin_compliance_router
from app.api.v1.routes.driver_compliance import router as driver_compliance_router
from app.api.v1.routes.admin_users import router as admin_users_router
from app.api.v1.routes.notifications import router as notifications_router

api_router = APIRouter()
api_router.include_router(admin_pricing_router, prefix="/admin", tags=["Admin Pricing & Quotations"])
api_router.include_router(admin_fleet_router, prefix="/admin", tags=["Admin Fleet Management"])
api_router.include_router(admin_dispatch_router, prefix="/admin", tags=["Admin Dispatch Workflow"])
api_router.include_router(admin_invoices_router, prefix="/admin", tags=["Admin Invoices & Payments"])
api_router.include_router(admin_analytics_router, prefix="/admin/analytics", tags=["Admin Analytics"])
api_router.include_router(admin_expenses_router, prefix="/admin", tags=["Admin Expenses"])
api_router.include_router(admin_maintenance_router, prefix="/admin", tags=["Admin Maintenance"])
api_router.include_router(admin_settlements_router, prefix="/admin", tags=["admin-settlements"])
api_router.include_router(admin_compliance_router, prefix="/admin/compliance", tags=["admin-compliance"])
api_router.include_router(admin_users_router, prefix="/admin/users", tags=["Admin - Users"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(customer_quotations_router, prefix="/customer/quotations", tags=["Customer Quotations"])
api_router.include_router(customer_invoices_router, prefix="/customer/invoices", tags=["Customer Invoices"])
api_router.include_router(driver_pwa_router, prefix="/driver", tags=["Driver PWA"])
api_router.include_router(driver_expenses_router, prefix="/driver", tags=["Driver Expenses"])
api_router.include_router(driver_compliance_router, prefix="/driver/compliance", tags=["driver-compliance"])
api_router.include_router(recipients_router, prefix="/customer/recipients", tags=["Customer Recipients"])
api_router.include_router(requests_router, prefix="/customer/requests", tags=["Customer Requests"])
api_router.include_router(customer_tracking_router, prefix="/customer/requests", tags=["Customer Tracking"])
