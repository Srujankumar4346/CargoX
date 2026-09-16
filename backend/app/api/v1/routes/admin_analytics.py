from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.db.database import get_db
from app.models.user import User
from app.schemas.analytics import AdminDashboardRead
from app.services.analytics_service import AnalyticsService

router = APIRouter()

@router.get("/dashboard", response_model=AdminDashboardRead)
def get_dashboard(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Returns aggregated dashboard metrics for admins.
    Access restricted to Admin role.
    """
    return AnalyticsService.get_dashboard(db)
