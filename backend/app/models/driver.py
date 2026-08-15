from sqlalchemy import Column, Integer, String, ForeignKey, Date
from sqlalchemy.orm import relationship
from app.db.base import Base

class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    full_name = Column(String)
    phone_number = Column(String)
    license_number = Column(String, unique=True)
    license_expiry = Column(Date)
    status = Column(String, default="AVAILABLE") # AVAILABLE, ON TRIP, OFF DUTY, SUSPENDED

    user = relationship("User", back_populates="driver")
    vehicles = relationship("Vehicle", back_populates="driver")
