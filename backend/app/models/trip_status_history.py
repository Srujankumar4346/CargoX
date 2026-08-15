from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class TripStatusHistory(Base):
    __tablename__ = "trip_status_history"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"))
    status = Column(String)
    location = Column(String, nullable=True) # Text input for now
    timestamp = Column(DateTime, default=datetime.utcnow)

    trip = relationship("Trip", back_populates="status_history")
