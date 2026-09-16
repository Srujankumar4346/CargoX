import uuid
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.enums import DocumentOwnerType, DocumentType, DocumentVerificationStatus

class ComplianceDocumentBase(BaseModel):
    owner_type: DocumentOwnerType
    owner_id: uuid.UUID
    document_type: DocumentType
    document_number: Optional[str] = None
    issued_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None

class ComplianceDocumentCreate(ComplianceDocumentBase):
    pass

class ComplianceDocumentResponse(ComplianceDocumentBase):
    id: uuid.UUID
    storage_key: str
    status: DocumentVerificationStatus
    rejection_reason: Optional[str] = None
    uploaded_by: uuid.UUID
    verified_by: Optional[uuid.UUID] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class ComplianceVerificationRequest(BaseModel):
    is_verified: bool
    rejection_reason: Optional[str] = None

class ComplianceDashboardResponse(BaseModel):
    vehicles: dict = Field(default_factory=dict)
    drivers: dict = Field(default_factory=dict)
