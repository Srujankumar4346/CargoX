from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"))
    amount = Column(Numeric(12, 2))
    payment_method = Column(String) # CASH, BANK_TRANSFER, UPI, CARD, OTHER
    payment_type = Column(String) # ADVANCE, BALANCE
    payment_reference = Column(String, nullable=True)
    transaction_date = Column(DateTime, default=datetime.utcnow)
    recorded_by = Column(String) # E.g., 'Admin'
    notes = Column(String, nullable=True)

    invoice = relationship("Invoice", back_populates="payments")
