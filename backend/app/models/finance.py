from sqlalchemy import Column, String, Numeric, DateTime, Enum, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.enums import InvoiceStatus, PaymentMethod, SettlementStatus
import uuid
from sqlalchemy.dialects.postgresql import UUID

class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    invoice_number = Column(String, unique=True, index=True, nullable=False)
    request_id = Column(UUID(as_uuid=True), ForeignKey("delivery_requests.id"), unique=True, nullable=False)
    customer_company_id = Column(UUID(as_uuid=True), ForeignKey("customer_companies.id"), index=True, nullable=False)
    quotation_id = Column(UUID(as_uuid=True), ForeignKey("quotations.id"), nullable=False)
    
    # Financials
    subtotal = Column(Numeric(12, 2), nullable=False)
    tax = Column(Numeric(12, 2), nullable=False, default=0.00)
    discount = Column(Numeric(12, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(12, 2), nullable=False)
    amount_paid = Column(Numeric(12, 2), nullable=False, default=0.00)
    amount_due = Column(Numeric(12, 2), nullable=False)
    
    # Status
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.UNPAID, index=True, nullable=False)
    
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

class DriverSettlement(Base):
    __tablename__ = "driver_settlements"
    __table_args__ = (
        CheckConstraint("base_pay >= 0", name="chk_settlement_base_pay"),
        CheckConstraint("reimbursements >= 0", name="chk_settlement_reimbursements"),
        CheckConstraint("deductions >= 0", name="chk_settlement_deductions"),
        CheckConstraint("total_payout >= 0", name="chk_total_payout"),
        CheckConstraint("deductions = 0 OR deduction_reason IS NOT NULL", name="chk_deduction_reason"),
    )
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    driver_id = Column(UUID(as_uuid=True), ForeignKey("drivers.id"), nullable=False, index=True)
    
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    
    base_pay = Column(Numeric(12, 2), nullable=False, default=0.00)
    reimbursements = Column(Numeric(12, 2), nullable=False, default=0.00)
    deductions = Column(Numeric(12, 2), nullable=False, default=0.00)
    total_payout = Column(Numeric(12, 2), nullable=False, default=0.00)
    
    deduction_reason = Column(String, nullable=True)
    
    status = Column(Enum(SettlementStatus), nullable=False, default=SettlementStatus.DRAFT, index=True)
    paid_at = Column(DateTime, nullable=True)
    reference_number = Column(String, unique=True, nullable=True)
    
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Relationships
    driver = relationship("Driver")
    trips = relationship("Trip", back_populates="settlement")
