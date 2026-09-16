from sqlalchemy import Column, Numeric, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.enums import QuotationStatus
import uuid
from sqlalchemy.dialects.postgresql import UUID

class PricingConfig(Base):
    __tablename__ = "pricing_configs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    base_rate_per_km = Column(Numeric(12, 2), nullable=False)
    margin_per_km = Column(Numeric(12, 2), nullable=False)
    effective_from = Column(DateTime, nullable=False)
    effective_until = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False)
    
    # Relationships
    quotations = relationship("Quotation", back_populates="pricing_config")

class Quotation(Base):
    __tablename__ = "quotations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    request_id = Column(UUID(as_uuid=True), ForeignKey("delivery_requests.id"), nullable=False)
    pricing_config_id = Column(UUID(as_uuid=True), ForeignKey("pricing_configs.id"), nullable=False)
    distance_km = Column(Numeric(10, 2), nullable=False)
    base_rate_per_km = Column(Numeric(12, 2), nullable=False)
    internal_base_cost = Column(Numeric(12, 2), nullable=False)
    cargox_margin = Column(Numeric(12, 2), nullable=False)
    customer_total_charge = Column(Numeric(12, 2), nullable=False)
    status = Column(Enum(QuotationStatus), default=QuotationStatus.PENDING, nullable=False)
    created_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    
    # Relationships
    pricing_config = relationship("PricingConfig", back_populates="quotations")
    delivery_request = relationship("DeliveryRequest", back_populates="quotation", uselist=False)
