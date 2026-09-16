from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (
        Index('ix_trips_booking_id', 'booking_id'),
        Index('ix_trips_driver_id', 'driver_id'),
        Index('ix_trips_vehicle_id', 'vehicle_id'),
        Index('ix_trips_status', 'status'),
    )

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"))
    driver_id = Column(Integer, ForeignKey("drivers.id"))
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"))
    status = Column(String, default="TRIP CREATED") # TRIP CREATED, IN TRANSIT, OUT FOR DELIVERY, DELIVERED, COMPLETED
    created_at = Column(DateTime, default=datetime.utcnow)

    booking = relationship("Booking", back_populates="trip")
    driver = relationship("Driver")
    vehicle = relationship("Vehicle")
    status_history = relationship("TripStatusHistory", back_populates="trip")
