import uuid
from typing import Optional
from datetime import datetime
from beanie import Document
from pydantic import Field
from app.models.enums import DocumentOwnerType, DocumentType, DocumentVerificationStatus

class ComplianceDocument(Document):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, alias="_id")
    owner_type: DocumentOwnerType
    owner_id: uuid.UUID
    document_type: DocumentType
    
    document_number: Optional[str] = None
    issued_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    
    storage_key: str
    
    status: DocumentVerificationStatus = DocumentVerificationStatus.PENDING
    rejection_reason: Optional[str] = None
    
    uploaded_by: uuid.UUID
    verified_by: Optional[uuid.UUID] = None
    verified_at: Optional[datetime] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "compliance_documents"
