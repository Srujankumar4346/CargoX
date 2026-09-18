import uuid
import os
import shutil
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form

from app.api.deps import get_current_driver
from app.models.user import User
from app.models.enums import DocumentOwnerType, DocumentType
from app.schemas.compliance import ComplianceDocumentResponse
from app.services.compliance_service import ComplianceService
from app.models.compliance import ComplianceDocument

router = APIRouter()

UPLOAD_DIR = "uploads/compliance"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/documents", response_model=ComplianceDocumentResponse, status_code=status.HTTP_201_CREATED)
async def driver_upload_compliance_document(
    document_type: DocumentType = Form(...),
    document_number: Optional[str] = Form(None),
    issued_date: Optional[datetime] = Form(None),
    expiry_date: Optional[datetime] = Form(None),
    file: UploadFile = File(...),
    current_driver: User = Depends(get_current_driver) # This returns the User, we need their driver record
):
    # Get the driver record
    driver = current_driver.driver
    if not driver:
        raise HTTPException(status_code=403, detail="Not a valid driver")

    file_ext = os.path.splitext(file.filename)[1]
    storage_key = f"{uuid.uuid4().hex}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, storage_key)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    doc = await ComplianceService.upload_document(
        owner_type=DocumentOwnerType.DRIVER,
        owner_id=driver.id,
        document_type=document_type,
        storage_key=storage_key,
        uploaded_by=current_driver,
        document_number=document_number,
        issued_date=issued_date,
        expiry_date=expiry_date
    )
    return doc

@router.get("/documents", response_model=List[ComplianceDocumentResponse])
async def driver_list_compliance_documents(
    current_driver: User = Depends(get_current_driver)
):
    driver = current_driver.driver
    if not driver:
        raise HTTPException(status_code=403, detail="Not a valid driver")
        
    docs = db.query(ComplianceDocument).filter(
        ComplianceDocument.owner_type == DocumentOwnerType.DRIVER,
        ComplianceDocument.owner_id == driver.id
    ).order_by(ComplianceDocument.created_at.desc()).all()
    
    return docs
