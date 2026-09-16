from sqlalchemy import Column, String, Integer, Enum, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.enums import VehicleType, VehicleStatus, DriverStatus
import uuid
from sqlalchemy.dialects.postgresql import UUID

class Vehicle(Base):
    __tablename__ = "vehicles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    registration_number = Column(String, unique=True, index=True, nullable=False)
    type = Column(Enum(VehicleType), nullable=False)
    capacity_tons = Column(Float, nullable=False)
    status = Column(Enum(VehicleStatus), default=VehicleStatus.AVAILABLE, nullable=False)
    
    # Relationships
    assignments = relationship("VehicleAssignment", back_populates="vehicle")

class Driver(Base):
    __tablename__ = "drivers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    license_number = Column(String, unique=True, nullable=False)
    status = Column(Enum(DriverStatus), default=DriverStatus.AVAILABLE, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="driver")
    assignments = relationship("VehicleAssignment", back_populates="driver")

class VehicleAssignment(Base):
    __tablename__ = "vehicle_assignments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=False)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.id"), nullable=False)
    assigned_at = Column(DateTime, nullable=False)
    released_at = Column(DateTime, nullable=True)
    
    # Relationships
    vehicle = relationship("Vehicle", back_populates="assignments")
    driver = relationship("Driver", back_populates="assignments")
    trip = relationship("Trip", back_populates="assignment", uselist=False)
