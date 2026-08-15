from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    pickup_address = Column(String)
    pickup_latitude = Column(Float, nullable=True)
    pickup_longitude = Column(Float, nullable=True)
    drop_address = Column(String)
    drop_latitude = Column(Float, nullable=True)
    drop_longitude = Column(Float, nullable=True)
    cargo_type = Column(String)
    cargo_weight = Column(Float) # in tons or KG
    status = Column(String, default="REQUESTED") # REQUESTED, CONFIRMED, CANCELLED
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="bookings")
    trip = relationship("Trip", back_populates="booking", uselist=False)
