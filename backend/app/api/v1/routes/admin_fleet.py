from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
import uuid
from typing import List, Optional

from app.api.deps import get_current_admin
from app.db.database import get_db
from app.models.user import User
from app.models.enums import VehicleStatus, DriverStatus
from app.schemas.fleet import VehicleCreate, VehicleUpdate, VehicleRead, DriverCreate, DriverUpdate, DriverRead
from app.services.fleet_service import FleetService

router = APIRouter()

@router.post("/vehicles", response_model=VehicleRead, status_code=status.HTTP_201_CREATED)
@router.post("/fleet/vehicles", response_model=VehicleRead, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    vehicle_in: VehicleCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Creates a new vehicle record. Admin privileges required.
    """
    return FleetService.create_vehicle(db, vehicle_in)

@router.get("/vehicles", response_model=List[VehicleRead])
@router.get("/fleet/vehicles", response_model=List[VehicleRead])
def list_vehicles(
    status: Optional[VehicleStatus] = Query(None, description="Filter by vehicle status (e.g. AVAILABLE)"),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Lists all vehicles, optionally filtered by status. Admin privileges required.
    """
    return FleetService.list_vehicles(db, status)

@router.get("/vehicles/{vehicle_id}", response_model=VehicleRead)
@router.get("/fleet/vehicles/{vehicle_id}", response_model=VehicleRead)
def get_vehicle(
    vehicle_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Gets details of a vehicle. Admin privileges required.
    """
    return FleetService.get_vehicle(db, vehicle_id)

@router.patch("/vehicles/{vehicle_id}", response_model=VehicleRead)
@router.patch("/fleet/vehicles/{vehicle_id}", response_model=VehicleRead)
def update_vehicle(
    vehicle_id: uuid.UUID,
    vehicle_in: VehicleUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Updates a vehicle profile or status. Admin privileges required.
    """
    return FleetService.update_vehicle(db, vehicle_id, vehicle_in)

@router.post("/drivers", response_model=DriverRead, status_code=status.HTTP_201_CREATED)
@router.post("/fleet/drivers", response_model=DriverRead, status_code=status.HTTP_201_CREATED)
def create_driver(
    driver_in: DriverCreate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Creates a new driver profile linked to a User account with DRIVER role.
    Admin privileges required.
    """
    return FleetService.create_driver(db, driver_in)

@router.get("/drivers", response_model=List[DriverRead])
@router.get("/fleet/drivers", response_model=List[DriverRead])
def list_drivers(
    status: Optional[DriverStatus] = Query(None, description="Filter by driver status (e.g. AVAILABLE)"),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Lists all drivers, optionally filtered by status. Admin privileges required.
    """
    return FleetService.list_drivers(db, status)

@router.get("/drivers/{driver_id}", response_model=DriverRead)
@router.get("/fleet/drivers/{driver_id}", response_model=DriverRead)
def get_driver(
    driver_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Gets details of a driver. Admin privileges required.
    """
    return FleetService.get_driver(db, driver_id)

@router.patch("/drivers/{driver_id}", response_model=DriverRead)
@router.patch("/fleet/drivers/{driver_id}", response_model=DriverRead)
def update_driver(
    driver_id: uuid.UUID,
    driver_in: DriverUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Updates a driver profile or status. Admin privileges required.
    """
    return FleetService.update_driver(db, driver_id, driver_in)
