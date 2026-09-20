from fastapi import APIRouter, Depends
from typing import List
from app.api.deps import get_current_customer_user
from app.models.user import User
from app.schemas.fleet import DriverRead
from app.services.fleet_service import FleetService

router = APIRouter()

@router.get("/drivers", response_model=List[DriverRead])
async def list_drivers(
    current_user: User = Depends(get_current_customer_user)
):
    """
    Lists all active drivers for customer visibility.
    """
    return await FleetService.list_drivers()
