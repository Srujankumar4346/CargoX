from fastapi import APIRouter, Depends, HTTPException, status, Query
import uuid
from typing import List, Optional

from app.api.deps import get_current_admin
from app.models.user import User
from app.models.enums import VehicleStatus, DriverStatus
from app.schemas.fleet import VehicleCreate, VehicleUpdate, VehicleRead, DriverCreate, DriverUpdate, DriverRead
from app.services.fleet_service import FleetService

router = APIRouter()

@router.post("/vehicles", response_model=VehicleRead, status_code=status.HTTP_201_CREATED)
@router.post("/fleet/vehicles", response_model=VehicleRead, status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    vehicle_in: VehicleCreate,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Creates a new vehicle record. Admin privileges required.
    """
    return await FleetService.create_vehicle(vehicle_in)

@router.get("/vehicles", response_model=List[VehicleRead])
@router.get("/fleet/vehicles", response_model=List[VehicleRead])
async def list_vehicles(
    status: Optional[VehicleStatus] = Query(None, description="Filter by vehicle status (e.g. AVAILABLE)"),
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Lists all vehicles, optionally filtered by status. Admin privileges required.
    """
    return await FleetService.list_vehicles(status)

@router.get("/vehicles/{vehicle_id}", response_model=VehicleRead)
@router.get("/fleet/vehicles/{vehicle_id}", response_model=VehicleRead)
async def get_vehicle(
    vehicle_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Gets details of a vehicle. Admin privileges required.
    """
    return await FleetService.get_vehicle(vehicle_id)

@router.patch("/vehicles/{vehicle_id}", response_model=VehicleRead)
@router.patch("/fleet/vehicles/{vehicle_id}", response_model=VehicleRead)
async def update_vehicle(
    vehicle_id: uuid.UUID,
    vehicle_in: VehicleUpdate,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Updates a vehicle profile or status. Admin privileges required.
    """
    return await FleetService.update_vehicle(vehicle_id, vehicle_in)

@router.delete("/vehicles/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/fleet/vehicles/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(
    vehicle_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Deletes a vehicle. Admin privileges required.
    """
    await FleetService.delete_vehicle(vehicle_id)
    return None

@router.post("/drivers", response_model=DriverRead, status_code=status.HTTP_201_CREATED)
@router.post("/fleet/drivers", response_model=DriverRead, status_code=status.HTTP_201_CREATED)
async def create_driver(
    driver_in: DriverCreate,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Creates a new driver profile linked to a User account with DRIVER role.
    Admin privileges required.
    """
    return await FleetService.create_driver(driver_in)

@router.get("/drivers", response_model=List[DriverRead])
@router.get("/fleet/drivers", response_model=List[DriverRead])
async def list_drivers(
    status: Optional[DriverStatus] = Query(None, description="Filter by driver status (e.g. AVAILABLE)"),
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Lists all drivers, optionally filtered by status. Admin privileges required.
    """
    return await FleetService.list_drivers(status)

@router.get("/drivers/{driver_id}", response_model=DriverRead)
@router.get("/fleet/drivers/{driver_id}", response_model=DriverRead)
async def get_driver(
    driver_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Gets details of a driver. Admin privileges required.
    """
    return await FleetService.get_driver(driver_id)

@router.patch("/drivers/{driver_id}", response_model=DriverRead)
@router.patch("/fleet/drivers/{driver_id}", response_model=DriverRead)
async def update_driver(
    driver_id: uuid.UUID,
    driver_in: DriverUpdate,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Updates a driver profile or status. Admin privileges required.
    """
    return await FleetService.update_driver(driver_id, driver_in)

@router.delete("/drivers/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
@router.delete("/fleet/drivers/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_driver(
    driver_id: uuid.UUID,
    current_admin: User = Depends(get_current_admin),
    ):
    """
    Deletes a driver. Admin privileges required.
    """
    await FleetService.delete_driver(driver_id)
    return None
