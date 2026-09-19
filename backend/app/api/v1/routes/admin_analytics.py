from fastapi import APIRouter, Depends

from app.api.deps import get_current_admin
from app.models.user import User
from app.schemas.analytics import AdminDashboardRead
from app.services.analytics_service import AnalyticsService

router = APIRouter()

@router.get("/dashboard", response_model=AdminDashboardRead)
async def get_dashboard(
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Returns aggregated dashboard metrics for admins.
    Access restricted to Admin role.
    """
    return await AnalyticsService.get_dashboard()
