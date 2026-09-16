from sqlalchemy.orm import Session
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
    def create_vehicle(db: Session, vehicle_in: VehicleCreate) -> Vehicle:
        existing = db.query(Vehicle).filter(Vehicle.registration_number == vehicle_in.registration_number).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Vehicle with registration number '{vehicle_in.registration_number}' already exists"
            )

        vehicle = Vehicle(
            id=uuid.uuid4(),
            registration_number=vehicle_in.registration_number,
            type=vehicle_in.type,
            capacity_tons=float(vehicle_in.capacity_tons),
            status=VehicleStatus.AVAILABLE
        )
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)
        return vehicle

    @staticmethod
    def list_vehicles(db: Session, vehicle_status: Optional[VehicleStatus] = None) -> List[Vehicle]:
        query = db.query(Vehicle)
        if vehicle_status:
            query = query.filter(Vehicle.status == vehicle_status)
        return query.all()

    @staticmethod
    def get_vehicle(db: Session, vehicle_id: uuid.UUID) -> Vehicle:
        vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
        if not vehicle:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
        return vehicle

    @staticmethod
    def update_vehicle(db: Session, vehicle_id: uuid.UUID, vehicle_in: VehicleUpdate) -> Vehicle:
        vehicle = FleetService.get_vehicle(db, vehicle_id)
        if vehicle_in.registration_number is not None and vehicle_in.registration_number != vehicle.registration_number:
            existing = db.query(Vehicle).filter(Vehicle.registration_number == vehicle_in.registration_number).first()
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

        db.commit()
        db.refresh(vehicle)
        return vehicle

    @staticmethod
    def create_driver(db: Session, driver_in: DriverCreate) -> Driver:
        # Validate target user exists and role is DRIVER
        user = db.query(User).filter(User.id == driver_in.user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        if user.role != UserRole.DRIVER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User must have role '{UserRole.DRIVER.value}' to be assigned as driver"
            )

        existing_user_driver = db.query(Driver).filter(Driver.user_id == driver_in.user_id).first()
        if existing_user_driver:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A driver profile already exists for this user"
            )

        existing_license = db.query(Driver).filter(Driver.license_number == driver_in.license_number).first()
        if existing_license:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Driver with license number '{driver_in.license_number}' already exists"
            )

        driver = Driver(
            id=uuid.uuid4(),
            user_id=driver_in.user_id,
            name=driver_in.name,
            phone=driver_in.phone,
            license_number=driver_in.license_number,
            status=DriverStatus.AVAILABLE
        )
        db.add(driver)
        db.commit()
        db.refresh(driver)
        return driver

    @staticmethod
    def list_drivers(db: Session, driver_status: Optional[DriverStatus] = None) -> List[Driver]:
        query = db.query(Driver)
        if driver_status:
            query = query.filter(Driver.status == driver_status)
        return query.all()

    @staticmethod
    def get_driver(db: Session, driver_id: uuid.UUID) -> Driver:
        driver = db.query(Driver).filter(Driver.id == driver_id).first()
        if not driver:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")
        return driver

    @staticmethod
    def update_driver(db: Session, driver_id: uuid.UUID, driver_in: DriverUpdate) -> Driver:
        driver = FleetService.get_driver(db, driver_id)
        if driver_in.license_number is not None and driver_in.license_number != driver.license_number:
            existing = db.query(Driver).filter(Driver.license_number == driver_in.license_number).first()
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

        db.commit()
        db.refresh(driver)
        return driver
