from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, DateTime, Date
from sqlalchemy.orm import relationship
from datetime import datetime, date
from app.db.base import Base

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, unique=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"))
    customer_id = Column(Integer, ForeignKey("customers.id"))
    issue_date = Column(Date, default=date.today)
    due_date = Column(Date)
    base_charge = Column(Numeric(12, 2), default=0)
    taxes = Column(Numeric(12, 2), default=0)
    discount = Column(Numeric(12, 2), default=0)
    total_amount = Column(Numeric(12, 2), default=0)
    amount_paid = Column(Numeric(12, 2), default=0)
    amount_due = Column(Numeric(12, 2), default=0)
    currency = Column(String, default="INR")
    status = Column(String, default="PENDING") # PENDING, PARTIALLY_PAID, PAID, CANCELLED, OVERDUE

    booking = relationship("Booking")
    customer = relationship("Customer")
    payments = relationship("Payment", back_populates="invoice")
