import uuid
from sqlalchemy import Column, String, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base
from app.models.enums import DocumentOwnerType, DocumentType, DocumentVerificationStatus

class ComplianceDocument(Base):
    __tablename__ = "compliance_documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    owner_type = Column(Enum(DocumentOwnerType), nullable=False)
    owner_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    document_type = Column(Enum(DocumentType), nullable=False)
    
    document_number = Column(String, nullable=True)
    issued_date = Column(DateTime, nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    
    storage_key = Column(String, nullable=False)
    
    status = Column(Enum(DocumentVerificationStatus), default=DocumentVerificationStatus.PENDING, nullable=False)
    rejection_reason = Column(String, nullable=True)
    
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
