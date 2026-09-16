import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_admin
from app.models.user import User
from app.schemas.operations import VehicleMaintenanceCreate, VehicleMaintenanceComplete, VehicleMaintenanceRead
from app.services.maintenance_service import MaintenanceService

router = APIRouter(tags=["Admin Maintenance"])

@router.post("/vehicles/{vehicle_id}/maintenance", response_model=VehicleMaintenanceRead)
def schedule_maintenance(
    vehicle_id: uuid.UUID,
    maint_in: VehicleMaintenanceCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    return MaintenanceService.schedule_maintenance(
        db=db,
        vehicle_id=vehicle_id,
        admin_user=current_admin,
        maintenance_type=maint_in.maintenance_type,
        scheduled_date=maint_in.scheduled_date,
        description=maint_in.description
    )

@router.post("/maintenance/{id}/start", response_model=VehicleMaintenanceRead)
def start_maintenance(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    return MaintenanceService.start_maintenance(db, id, current_admin)

@router.post("/maintenance/{id}/complete", response_model=VehicleMaintenanceRead)
def complete_maintenance(
    id: uuid.UUID,
    maint_in: VehicleMaintenanceComplete,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    return MaintenanceService.complete_maintenance(
        db=db,
        maintenance_id=id,
        admin_user=current_admin,
        cost=maint_in.cost,
        mechanic_notes=maint_in.mechanic_notes
    )

@router.post("/maintenance/{id}/cancel", response_model=VehicleMaintenanceRead)
def cancel_maintenance(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    return MaintenanceService.cancel_maintenance(db, id, current_admin)
