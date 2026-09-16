from sqlalchemy import Column, String, Numeric, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.enums import InvoiceStatus, PaymentMethod
import uuid
from sqlalchemy.dialects.postgresql import UUID

class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    invoice_number = Column(String, unique=True, index=True, nullable=False)
    request_id = Column(UUID(as_uuid=True), ForeignKey("delivery_requests.id"), nullable=False)
    customer_company_id = Column(UUID(as_uuid=True), ForeignKey("customer_companies.id"), nullable=False)
    quotation_id = Column(UUID(as_uuid=True), ForeignKey("quotations.id"), nullable=False)
    
    # Financials
    subtotal = Column(Numeric(12, 2), nullable=False)
    tax = Column(Numeric(12, 2), nullable=False, default=0.00)
    discount = Column(Numeric(12, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(12, 2), nullable=False)
    amount_paid = Column(Numeric(12, 2), nullable=False, default=0.00)
    amount_due = Column(Numeric(12, 2), nullable=False)
    
    # Status
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.UNPAID, nullable=False)
    
    # Timestamps
    issued_at = Column(DateTime, nullable=False)
    due_at = Column(DateTime, nullable=True)
    
    # Relationships
    delivery_request = relationship("DeliveryRequest", back_populates="invoices")
    customer_company = relationship("CustomerCompany", back_populates="invoices")
    payments = relationship("Payment", back_populates="invoice")

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    
    # Payment Details
    amount = Column(Numeric(12, 2), nullable=False)
    method = Column(Enum(PaymentMethod), nullable=False)
    reference_number = Column(String, unique=True, nullable=True)
    notes = Column(String, nullable=True)
    
    # Timestamps
    paid_at = Column(DateTime, nullable=False)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Relationships
    invoice = relationship("Invoice", back_populates="payments")
