import uuid
from decimal import Decimal
from datetime import datetime, timezone
from fastapi import HTTPException

from beanie.operators import In
from app.models.operations import VehicleMaintenance
from app.models.fleet import Vehicle
from app.models.enums import MaintenanceType, MaintenanceStatus, VehicleStatus, UserRole
from app.models.user import User

class MaintenanceService:
    @staticmethod
    async def schedule_maintenance(
        vehicle_id: uuid.UUID,
        admin_user: User,
        maintenance_type: MaintenanceType,
        scheduled_date: datetime,
        description: str = None
    ) -> VehicleMaintenance:
        
        if admin_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can schedule maintenance")
            
        vehicle = await Vehicle.find_one(Vehicle.id == vehicle_id)
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
            
        # Check if already has active maintenance
        active_maint = await VehicleMaintenance.find_one(
            VehicleMaintenance.vehicle_id == vehicle_id,
            In(VehicleMaintenance.status, [MaintenanceStatus.SCHEDULED.value, MaintenanceStatus.IN_PROGRESS.value])
        )
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
        await maintenance.insert()
        return maintenance

    @staticmethod
    async def start_maintenance(maintenance_id: uuid.UUID, admin_user: User):
        if admin_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can start maintenance")
            
        # Lock maintenance
        maintenance = await VehicleMaintenance.find_one(VehicleMaintenance.id == maintenance_id)
        if not maintenance:
            raise HTTPException(status_code=404, detail="Maintenance record not found")
            
        if maintenance.status != MaintenanceStatus.SCHEDULED:
            raise HTTPException(status_code=400, detail=f"Cannot start maintenance from {maintenance.status.value} state")
            
        # Lock vehicle
        vehicle = await Vehicle.find_one(Vehicle.id == maintenance.vehicle_id)
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
            
        if vehicle.status == VehicleStatus.ASSIGNED:
            raise HTTPException(status_code=400, detail="Cannot start maintenance on an assigned vehicle")
            
        maintenance.status = MaintenanceStatus.IN_PROGRESS
        vehicle.status = VehicleStatus.MAINTENANCE
        
        await maintenance.save()
        await vehicle.save()
        return maintenance

    @staticmethod
    async def complete_maintenance(
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
        maintenance = await VehicleMaintenance.find_one(VehicleMaintenance.id == maintenance_id)
        if not maintenance:
            raise HTTPException(status_code=404, detail="Maintenance record not found")
            
        if maintenance.status != MaintenanceStatus.IN_PROGRESS:
            raise HTTPException(status_code=400, detail=f"Cannot complete maintenance from {maintenance.status.value} state")
            
        # Lock vehicle
        vehicle = await Vehicle.find_one(Vehicle.id == maintenance.vehicle_id)
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
        
        await maintenance.save()
        await vehicle.save()
        return maintenance

    @staticmethod
    async def cancel_maintenance(maintenance_id: uuid.UUID, admin_user: User):
        if admin_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Only admins can cancel maintenance")
            
        # Lock maintenance
        maintenance = await VehicleMaintenance.find_one(VehicleMaintenance.id == maintenance_id)
        if not maintenance:
            raise HTTPException(status_code=404, detail="Maintenance record not found")
            
        if maintenance.status in (MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED):
            raise HTTPException(status_code=400, detail=f"Cannot cancel {maintenance.status.value} maintenance")
            
        # Lock vehicle
        vehicle = await Vehicle.find_one(Vehicle.id == maintenance.vehicle_id)
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
            
        # Revert vehicle state if it was in progress
        if maintenance.status == MaintenanceStatus.IN_PROGRESS:
            if vehicle.status == VehicleStatus.MAINTENANCE:
                vehicle.status = VehicleStatus.AVAILABLE
                await vehicle.save()
                
        maintenance.status = MaintenanceStatus.CANCELLED
        
        await maintenance.save()
        return maintenance
