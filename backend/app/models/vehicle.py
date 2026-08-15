from sqlalchemy import Column, Integer, String, ForeignKey, Date
from sqlalchemy.orm import relationship
from app.db.base import Base

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_number = Column(String, unique=True, index=True)
    vehicle_type = Column(String)
    model = Column(String)
    capacity = Column(String)
    fuel_type = Column(String)
    insurance_expiry = Column(Date)
    fitness_expiry = Column(Date)
    pollution_expiry = Column(Date)
    status = Column(String, default="AVAILABLE") # AVAILABLE, ASSIGNED, ON TRIP, MAINTENANCE, INACTIVE
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)

    driver = relationship("Driver", back_populates="vehicles")
