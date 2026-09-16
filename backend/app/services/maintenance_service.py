import uuid
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.operations import VehicleMaintenance
from app.models.fleet import Vehicle
from app.models.enums import MaintenanceType, MaintenanceStatus, VehicleStatus, UserRole
from app.models.user import User

class MaintenanceService:
    @staticmethod
    def schedule_maintenance(
        db: Session,
        vehicle_id: uuid.UUID,
        admin_user: User,
        maintenance_type: MaintenanceType,
        scheduled_date: datetime,
        description: str = None
    ) -> VehicleMaintenance:
        
        if admin_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can schedule maintenance")
            
        vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).with_for_update().first()
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
            
        # Check if already has active maintenance
        active_maint = db.query(VehicleMaintenance).filter(
            VehicleMaintenance.vehicle_id == vehicle_id,
            VehicleMaintenance.status.in_([MaintenanceStatus.SCHEDULED, MaintenanceStatus.IN_PROGRESS])
        ).first()
        if active_maint:
            raise HTTPException(status_code=409, detail="Vehicle already has scheduled or in-progress maintenance")
            
        maintenance = VehicleMaintenance(
            vehicle_id=vehicle_id,
            maintenance_type=maintenance_type,
            status=MaintenanceStatus.SCHEDULED,
            scheduled_date=scheduled_date,
            description=description,
            recorded_by=admin_user.id
        )
        db.add(maintenance)
        db.commit()
        db.refresh(maintenance)
        return maintenance

    @staticmethod
    def start_maintenance(db: Session, maintenance_id: uuid.UUID, admin_user: User):
        if admin_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can start maintenance")
            
        # Lock maintenance
        maintenance = db.query(VehicleMaintenance).filter(VehicleMaintenance.id == maintenance_id).with_for_update().first()
        if not maintenance:
            raise HTTPException(status_code=404, detail="Maintenance record not found")
            
        if maintenance.status != MaintenanceStatus.SCHEDULED:
            raise HTTPException(status_code=400, detail=f"Cannot start maintenance from {maintenance.status} state")
            
        # Lock vehicle
        vehicle = db.query(Vehicle).filter(Vehicle.id == maintenance.vehicle_id).with_for_update().first()
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
            
        if vehicle.status == VehicleStatus.ASSIGNED:
            raise HTTPException(status_code=400, detail="Cannot start maintenance on an assigned vehicle")
            
        maintenance.status = MaintenanceStatus.IN_PROGRESS
        vehicle.status = VehicleStatus.MAINTENANCE
        
        db.commit()
        db.refresh(maintenance)
        return maintenance

    @staticmethod
    def complete_maintenance(
        db: Session,
        maintenance_id: uuid.UUID,
        admin_user: User,
        cost: Decimal,
        mechanic_notes: str = None
    ):
        if admin_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can complete maintenance")
            
        if cost <= 0:
            raise HTTPException(status_code=422, detail="Maintenance cost must be positive")
            
        # Lock maintenance
        maintenance = db.query(VehicleMaintenance).filter(VehicleMaintenance.id == maintenance_id).with_for_update().first()
        if not maintenance:
            raise HTTPException(status_code=404, detail="Maintenance record not found")
            
        if maintenance.status != MaintenanceStatus.IN_PROGRESS:
            raise HTTPException(status_code=400, detail=f"Cannot complete maintenance from {maintenance.status} state")
            
        # Lock vehicle
        vehicle = db.query(Vehicle).filter(Vehicle.id == maintenance.vehicle_id).with_for_update().first()
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
            
        if vehicle.status != VehicleStatus.MAINTENANCE:
            raise HTTPException(status_code=400, detail="Vehicle is not in MAINTENANCE state. Transition aborted.")
            
        maintenance.status = MaintenanceStatus.COMPLETED
        maintenance.cost = cost
        maintenance.completed_date = datetime.now(timezone.utc)
        if mechanic_notes:
            maintenance.mechanic_notes = mechanic_notes
            
        vehicle.status = VehicleStatus.AVAILABLE
        
        db.commit()
        db.refresh(maintenance)
        return maintenance

    @staticmethod
    def cancel_maintenance(db: Session, maintenance_id: uuid.UUID, admin_user: User):
        if admin_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can cancel maintenance")
            
        # Lock maintenance
        maintenance = db.query(VehicleMaintenance).filter(VehicleMaintenance.id == maintenance_id).with_for_update().first()
        if not maintenance:
            raise HTTPException(status_code=404, detail="Maintenance record not found")
            
        if maintenance.status in (MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED):
            raise HTTPException(status_code=400, detail=f"Cannot cancel {maintenance.status} maintenance")
            
        # Lock vehicle
        vehicle = db.query(Vehicle).filter(Vehicle.id == maintenance.vehicle_id).with_for_update().first()
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
            
        # Revert vehicle state if it was in progress
        if maintenance.status == MaintenanceStatus.IN_PROGRESS:
            if vehicle.status == VehicleStatus.MAINTENANCE:
                vehicle.status = VehicleStatus.AVAILABLE
                
        maintenance.status = MaintenanceStatus.CANCELLED
        
        db.commit()
        db.refresh(maintenance)
        return maintenance
