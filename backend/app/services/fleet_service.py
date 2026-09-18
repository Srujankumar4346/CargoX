from fastapi import HTTPException, status
import uuid
from typing import Optional, List
from decimal import Decimal

from app.models.fleet import Vehicle, Driver, VehicleAssignment
from app.models.user import User
from app.models.enums import VehicleStatus, DriverStatus, UserRole
from app.schemas.fleet import VehicleCreate, VehicleUpdate, DriverCreate, DriverUpdate

class FleetService:
    @staticmethod
    async def create_vehicle(vehicle_in: VehicleCreate) -> Vehicle:
        existing = await Vehicle.find_one(Vehicle.registration_number == vehicle_in.registration_number)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Vehicle with registration number '{vehicle_in.registration_number}' already exists"
            )

        vehicle = Vehicle(
            registration_number=vehicle_in.registration_number,
            type=vehicle_in.type,
            capacity_tons=float(vehicle_in.capacity_tons),
            status=VehicleStatus.AVAILABLE
        )
        await vehicle.insert()
        return vehicle

    @staticmethod
    async def list_vehicles(vehicle_status: Optional[VehicleStatus] = None) -> List[Vehicle]:
        if vehicle_status:
            return await Vehicle.find(Vehicle.status == vehicle_status).to_list()
        return await Vehicle.find_all().to_list()

    @staticmethod
    async def get_vehicle(vehicle_id: uuid.UUID) -> Vehicle:
        vehicle = await Vehicle.find_one(Vehicle.id == vehicle_id)
        if not vehicle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
        return vehicle

    @staticmethod
    async def update_vehicle(vehicle_id: uuid.UUID, vehicle_in: VehicleUpdate) -> Vehicle:
        vehicle = await FleetService.get_vehicle(vehicle_id)
        if vehicle_in.registration_number is not None and vehicle_in.registration_number != vehicle.registration_number:
            existing = await Vehicle.find_one(Vehicle.registration_number == vehicle_in.registration_number)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Vehicle with registration number '{vehicle_in.registration_number}' already exists"
                )
            vehicle.registration_number = vehicle_in.registration_number
        
        if vehicle_in.type is not None:
            vehicle.type = vehicle_in.type
        if vehicle_in.capacity_tons is not None:
            vehicle.capacity_tons = float(vehicle_in.capacity_tons)
        if vehicle_in.status is not None:
            vehicle.status = vehicle_in.status

        await vehicle.save()
        return vehicle

    @staticmethod
    async def create_driver(driver_in: DriverCreate) -> Driver:
        # Validate target user exists and role is DRIVER
        user = await User.find_one(User.id == driver_in.user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if user.role != UserRole.DRIVER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User must have role '{UserRole.DRIVER.value}' to be assigned as driver"
            )

        existing_user_driver = await Driver.find_one(Driver.user_id == driver_in.user_id)
        if existing_user_driver:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A driver profile already exists for this user"
            )

        existing_license = await Driver.find_one(Driver.license_number == driver_in.license_number)
        if existing_license:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Driver with license number '{driver_in.license_number}' already exists"
            )

        driver = Driver(
            user_id=driver_in.user_id,
            name=driver_in.name,
            phone=driver_in.phone,
            license_number=driver_in.license_number,
            status=DriverStatus.AVAILABLE
        )
        await driver.insert()
        return driver

    @staticmethod
    async def list_drivers(driver_status: Optional[DriverStatus] = None) -> List[Driver]:
        if driver_status:
            return await Driver.find(Driver.status == driver_status).to_list()
        return await Driver.find_all().to_list()

    @staticmethod
    async def get_driver(driver_id: uuid.UUID) -> Driver:
        driver = await Driver.find_one(Driver.id == driver_id)
        if not driver:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
        return driver

    @staticmethod
    async def update_driver(driver_id: uuid.UUID, driver_in: DriverUpdate) -> Driver:
        driver = await FleetService.get_driver(driver_id)
        if driver_in.license_number is not None and driver_in.license_number != driver.license_number:
            existing = await Driver.find_one(Driver.license_number == driver_in.license_number)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Driver with license number '{driver_in.license_number}' already exists"
                )
            driver.license_number = driver_in.license_number

        if driver_in.name is not None:
            driver.name = driver_in.name
        if driver_in.phone is not None:
            driver.phone = driver_in.phone
        if driver_in.status is not None:
            driver.status = driver_in.status

        await driver.save()
        return driver
