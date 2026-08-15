from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, DateTime, Date
from sqlalchemy.orm import relationship
from datetime import date
from app.db.base import Base

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"))
    expense_type = Column(String) # FUEL, TOLL, ALLOWANCE, MAINTENANCE, OTHER
    amount = Column(Numeric(12, 2))
    description = Column(String, nullable=True)
    expense_date = Column(Date, default=date.today)
    recorded_by = Column(String) # Driver Name or Admin
    status = Column(String, default="PENDING") # PENDING, APPROVED, REJECTED

    trip = relationship("Trip")
