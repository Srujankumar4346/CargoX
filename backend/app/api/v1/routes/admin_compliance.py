import uuid
import os
import shutil
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form

from app.api.deps import get_current_admin
from app.models.user import User
from app.models.enums import DocumentOwnerType, DocumentType, DocumentVerificationStatus
from app.schemas.compliance import ComplianceDocumentResponse, ComplianceVerificationRequest, ComplianceDashboardResponse
from app.services.compliance_service import ComplianceService
from app.models.compliance import ComplianceDocument

router = APIRouter()

UPLOAD_DIR = "uploads/compliance"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/documents", response_model=ComplianceDocumentResponse, status_code=status.HTTP_201_CREATED)
async def admin_upload_compliance_document(
    owner_type: DocumentOwnerType = Form(...),
    owner_id: uuid.UUID = Form(...),
    document_type: DocumentType = Form(...),
    document_number: Optional[str] = Form(None),
    issued_date: Optional[datetime] = Form(None),
    expiry_date: Optional[datetime] = Form(None),
    file: UploadFile = File(...),
    current_admin: User = Depends(get_current_admin)
):
    # Simulate secure storage
    file_ext = os.path.splitext(file.filename)[1]
    storage_key = f"{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, storage_key)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    doc = await ComplianceService.upload_document(
        owner_type=owner_type,
        owner_id=owner_id,
        document_type=document_type,
        storage_key=storage_key,
        uploaded_by=current_admin,
        document_number=document_number,
        issued_date=issued_date,
        expiry_date=expiry_date
    )
    return doc

@router.get("/documents", response_model=List[ComplianceDocumentResponse])
async def admin_list_compliance_documents(
    owner_type: Optional[DocumentOwnerType] = None,
    owner_id: Optional[uuid.UUID] = None,
    status: Optional[DocumentVerificationStatus] = None,
    current_admin: User = Depends(get_current_admin)
):
    filters = {}
    if owner_type:
        filters["owner_type"] = owner_type
    if owner_id:
        filters["owner_id"] = owner_id
    if status:
        filters["status"] = status
        
    return await ComplianceDocument.find(filters).sort("-created_at").to_list()

@router.post("/documents/{document_id}/verify", response_model=ComplianceDocumentResponse)
async def admin_verify_compliance_document(
    document_id: uuid.UUID,
    verification: ComplianceVerificationRequest,
    current_admin: User = Depends(get_current_admin)
):
    return await ComplianceService.verify_document(
        document_id=document_id,
        verified_by=current_admin,
        is_verified=verification.is_verified,
        rejection_reason=verification.rejection_reason
    )

@router.get("/dashboard", response_model=ComplianceDashboardResponse)
async def admin_compliance_dashboard(
    current_admin: User = Depends(get_current_admin)
):
    # Fetch all verified documents
    verified_docs = await ComplianceDocument.find(
        ComplianceDocument.status == DocumentVerificationStatus.VERIFIED
    ).to_list()
    
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    # We will simulate the logic here for counts
    # A real dashboard would join Vehicles/Drivers to know which are completely missing docs
    # For now, just aggregate the documents we have
    
    v_valid = 0
    v_expiring = 0
    v_expired = 0
    
    d_valid = 0
    d_expiring = 0
    d_expired = 0
    
    for doc in verified_docs:
        if not doc.expiry_date:
            if doc.owner_type == DocumentOwnerType.VEHICLE: v_valid += 1
            else: d_valid += 1
            continue
            
        days_left = (doc.expiry_date - now).days
        
        if days_left < 0:
            if doc.owner_type == DocumentOwnerType.VEHICLE: v_expired += 1
            else: d_expired += 1
        elif days_left <= 30:
            if doc.owner_type == DocumentOwnerType.VEHICLE: v_expiring += 1
            else: d_expiring += 1
        else:
            if doc.owner_type == DocumentOwnerType.VEHICLE: v_valid += 1
            else: d_valid += 1
            
    return ComplianceDashboardResponse(
        vehicles={"valid": v_valid, "expiring_soon": v_expiring, "expired": v_expired},
        drivers={"valid": d_valid, "expiring_soon": d_expiring, "expired": d_expired}
    )
