import uuid
from typing import List, Optional, Tuple
from datetime import datetime, timezone
from fastapi import HTTPException
from app.models.compliance import ComplianceDocument
from app.models.enums import DocumentOwnerType, DocumentType, DocumentVerificationStatus
from app.models.fleet import Vehicle, Driver
from app.models.user import User

MANDATORY_DOCUMENTS = {
    DocumentOwnerType.DRIVER: [DocumentType.DRIVING_LICENSE],
    DocumentOwnerType.VEHICLE: [
        DocumentType.REGISTRATION,
        DocumentType.INSURANCE,
        DocumentType.PUC,
        DocumentType.PERMIT
    ]
}

class ComplianceService:
    @staticmethod
    async def get_document(document_id: uuid.UUID) -> ComplianceDocument:
        doc = await ComplianceDocument.find_one(ComplianceDocument.id == document_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        return doc

    @staticmethod
    async def upload_document(
        owner_type: DocumentOwnerType,
        owner_id: uuid.UUID,
        document_type: DocumentType,
        storage_key: str,
        uploaded_by: User,
        document_number: Optional[str] = None,
        issued_date: Optional[datetime] = None,
        expiry_date: Optional[datetime] = None,
    ) -> ComplianceDocument:
        
        # Verify owner exists
        if owner_type == DocumentOwnerType.DRIVER:
            owner = await Driver.find_one(Driver.id == owner_id)
        else:
            owner = await Vehicle.find_one(Vehicle.id == owner_id)
            
        if not owner:
            raise HTTPException(status_code=404, detail=f"{owner_type.value} not found")

        # Create document
        doc = ComplianceDocument(
            owner_type=owner_type,
            owner_id=owner_id,
            document_type=document_type,
            document_number=document_number,
            issued_date=issued_date,
            expiry_date=expiry_date,
            storage_key=storage_key,
            uploaded_by=uploaded_by.id,
            status=DocumentVerificationStatus.PENDING
        )
        await doc.insert()
        return doc

    @staticmethod
    async def verify_document(
        document_id: uuid.UUID,
        verified_by: User,
        is_verified: bool,
        rejection_reason: Optional[str] = None
    ) -> ComplianceDocument:
        doc = await ComplianceService.get_document(document_id)
        
        if doc.status != DocumentVerificationStatus.PENDING:
            raise HTTPException(status_code=400, detail="Only pending documents can be verified")

        if is_verified:
            doc.status = DocumentVerificationStatus.VERIFIED
            doc.verified_by = verified_by.id
            doc.verified_at = datetime.now(timezone.utc)
            
            # Archive existing verified document of same type
            existing_verified = await ComplianceDocument.find(
                ComplianceDocument.owner_type == doc.owner_type,
                ComplianceDocument.owner_id == doc.owner_id,
                ComplianceDocument.document_type == doc.document_type,
                ComplianceDocument.status == DocumentVerificationStatus.VERIFIED,
                ComplianceDocument.id != doc.id
            ).to_list()
            
            for existing in existing_verified:
                existing.status = DocumentVerificationStatus.ARCHIVED
                await existing.save()
        else:
            doc.status = DocumentVerificationStatus.REJECTED
            doc.rejection_reason = rejection_reason
            
        await doc.save()
        return doc

    @staticmethod
    async def validate_dispatch_eligibility(vehicle_id: uuid.UUID, driver_id: uuid.UUID) -> None:
        """
        Hard block on dispatch if mandatory documents are missing or expired.
        Throws HTTPException(400) if compliance fails.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        
        # Check Driver
        driver_docs = await ComplianceDocument.find(
            ComplianceDocument.owner_type == DocumentOwnerType.DRIVER,
            ComplianceDocument.owner_id == driver_id,
            ComplianceDocument.status == DocumentVerificationStatus.VERIFIED
        ).to_list()
        
        driver_doc_map = {doc.document_type: doc for doc in driver_docs}
        
        for required_type in MANDATORY_DOCUMENTS[DocumentOwnerType.DRIVER]:
            doc = driver_doc_map.get(required_type)
            if not doc:
                raise HTTPException(status_code=400, detail=f"Cannot dispatch: Driver {required_type.value} is missing")
            if doc.expiry_date and doc.expiry_date < now:
                raise HTTPException(status_code=400, detail=f"Cannot dispatch: Driver {required_type.value} is expired")

        # Check Vehicle
        vehicle_docs = await ComplianceDocument.find(
            ComplianceDocument.owner_type == DocumentOwnerType.VEHICLE,
            ComplianceDocument.owner_id == vehicle_id,
            ComplianceDocument.status == DocumentVerificationStatus.VERIFIED
        ).to_list()
        
        vehicle_doc_map = {doc.document_type: doc for doc in vehicle_docs}
        
        for required_type in MANDATORY_DOCUMENTS[DocumentOwnerType.VEHICLE]:
            doc = vehicle_doc_map.get(required_type)
            if not doc:
                raise HTTPException(status_code=400, detail=f"Cannot dispatch: Vehicle {required_type.value} is missing")
            if doc.expiry_date and doc.expiry_date < now:
                raise HTTPException(status_code=400, detail=f"Cannot dispatch: Vehicle {required_type.value} is expired")

    @staticmethod
    async def check_compliance_expirations():
        """
        Scans all VERIFIED documents and emits notifications based on expiry thresholds.
        """
        from app.services.notification_service import NotificationService
        from app.models.notifications import NotificationChannel
        
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        
        docs = await ComplianceDocument.find(
            ComplianceDocument.status == DocumentVerificationStatus.VERIFIED,
            ComplianceDocument.expiry_date != None
        ).to_list()
        
        for doc in docs:
            days_left = (doc.expiry_date - now).days
            
            event_type = None
            title = None
            message = None
            
            if days_left < 0:
                event_type = "COMPLIANCE_EXPIRED"
                title = f"{doc.document_type.value} Expired"
                message = f"The {doc.document_type.value} for {doc.owner_type.value} has expired."
            elif days_left <= 7:
                event_type = "COMPLIANCE_EXPIRING_URGENT"
                title = f"{doc.document_type.value} Expiring Soon (Urgent)"
                message = f"The {doc.document_type.value} for {doc.owner_type.value} expires in {days_left} days."
            elif days_left <= 30:
                event_type = "COMPLIANCE_EXPIRING_SOON"
                title = f"{doc.document_type.value} Expiring Soon"
                message = f"The {doc.document_type.value} for {doc.owner_type.value} expires in {days_left} days."
                
            if event_type:
                admins = await User.find(User.role == 'ADMIN', User.is_active == True).to_list()
                for admin in admins:
                    event_id = f"{event_type}:{doc.id}:{days_left if days_left > 0 else 'EXPIRED'}:{admin.id}"
                    try:
                        await NotificationService.create_notification(
                            event_id=event_id,
                            event_type=event_type,
                            recipient_user_id=admin.id,
                            channel=NotificationChannel.IN_APP,
                            title=title,
                            message=message
                        )
                    except Exception:
                        pass
        
        try:
            await NotificationService.process_pending_notifications()
        except Exception:
            pass
