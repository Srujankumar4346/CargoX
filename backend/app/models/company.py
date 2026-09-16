from sqlalchemy import Column, Integer, String, Float, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.enums import CompanyStatus
import uuid
from sqlalchemy.dialects.postgresql import UUID

class CustomerCompany(Base):
    __tablename__ = "customer_companies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, index=True, nullable=False)
    billing_address = Column(String, nullable=False)
    gst_number = Column(String, nullable=True)
    status = Column(Enum(CompanyStatus), default=CompanyStatus.PENDING, nullable=False)
    
    # Relationships
    users = relationship("User", back_populates="company")
    recipients = relationship("RecipientCompany", back_populates="customer_company")
    requests = relationship("DeliveryRequest", back_populates="customer_company")
    invoices = relationship("Invoice", back_populates="customer_company")

class RecipientCompany(Base):
    __tablename__ = "recipient_companies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    customer_company_id = Column(UUID(as_uuid=True), ForeignKey("customer_companies.id"), nullable=False)
    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    contact_person = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    
    # Relationships
    customer_company = relationship("CustomerCompany", back_populates="recipients")
