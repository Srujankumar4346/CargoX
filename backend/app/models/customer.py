from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    full_name = Column(String)
    phone_number = Column(String)
    company_name = Column(String, nullable=True)

    user = relationship("User", back_populates="customer")
    bookings = relationship("Booking", back_populates="customer")
