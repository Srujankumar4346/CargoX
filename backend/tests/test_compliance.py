import pytest
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from app.models.enums import DocumentOwnerType, DocumentType, DocumentVerificationStatus, UserRole, DeliveryRequestStatus, VehicleStatus, DriverStatus
from app.models.compliance import ComplianceDocument
from app.services.compliance_service import ComplianceService
from app.services.dispatch_service import DispatchService
from app.schemas.dispatch import DispatchRequest
from app.models.fleet import Vehicle, Driver
from app.models.user import User
from app.db.database import SessionLocal

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def admin_user(db_session):
    uid = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_admin_{uid}",
        email=f"admin_{uid}@cargox.com",
        role=UserRole.ADMIN,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def setup_compliance_entities(db_session, admin_user):
    veh = Vehicle(id=uuid.uuid4(), registration_number=f"MH01-{uuid.uuid4().hex[:4]}", type="OPEN", capacity_tons=10.0, status=VehicleStatus.AVAILABLE)
    db_session.add(veh)
    
    drv_user = User(id=uuid.uuid4(), clerk_user_id=f"driver_auth_{uuid.uuid4().hex[:6]}", email=f"driver_{uuid.uuid4().hex[:6]}@cargox.com", role=UserRole.DRIVER, is_active=True)
    db_session.add(drv_user)
    db_session.flush()
    
    drv = Driver(id=uuid.uuid4(), user_id=drv_user.id, name="Test Driver", phone="1234567890", license_number=f"DL-{uuid.uuid4().hex[:6]}", status=DriverStatus.AVAILABLE)
    db_session.add(drv)
    
    db_session.commit()
    return veh.id, drv.id, drv_user

def add_verified_doc(db, owner_type, owner_id, doc_type, uploaded_by, expires_in_days=365):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    doc = ComplianceService.upload_document(
        db=db,
        owner_type=owner_type,
        owner_id=owner_id,
        document_type=doc_type,
        storage_key=f"mock_{uuid.uuid4().hex}",
        uploaded_by=uploaded_by,
        expiry_date=now + timedelta(days=expires_in_days)
    )
    return ComplianceService.verify_document(db, doc.id, uploaded_by, True)

def test_document_upload_and_verification(db_session, admin_user, setup_compliance_entities):
    veh_id, drv_id, drv_user = setup_compliance_entities
    
    # 1. Upload defaults to PENDING
    doc = ComplianceService.upload_document(
        db=db_session,
        owner_type=DocumentOwnerType.DRIVER,
        owner_id=drv_id,
        document_type=DocumentType.DRIVING_LICENSE,
        storage_key="test_key",
        uploaded_by=drv_user
    )
    
    assert doc.status == DocumentVerificationStatus.PENDING
    
    # 2. Verify transitions to VERIFIED
    verified_doc = ComplianceService.verify_document(
        db=db_session,
        document_id=doc.id,
        verified_by=admin_user,
        is_verified=True
    )
    
    assert verified_doc.status == DocumentVerificationStatus.VERIFIED
    
    # 3. New upload and verify archives the old one
    doc2 = ComplianceService.upload_document(
        db=db_session,
        owner_type=DocumentOwnerType.DRIVER,
        owner_id=drv_id,
        document_type=DocumentType.DRIVING_LICENSE,
        storage_key="test_key_2",
        uploaded_by=drv_user
    )
    
    ComplianceService.verify_document(
        db=db_session,
        document_id=doc2.id,
        verified_by=admin_user,
        is_verified=True
    )
    
    db_session.refresh(verified_doc)
    assert verified_doc.status == DocumentVerificationStatus.ARCHIVED
    assert doc2.status == DocumentVerificationStatus.VERIFIED

def test_dispatch_compliance_enforcement(db_session, admin_user, setup_compliance_entities):
    veh_id, drv_id, drv_user = setup_compliance_entities
    
    # Missing documents should block
    with pytest.raises(HTTPException) as exc:
        ComplianceService.validate_dispatch_eligibility(db_session, veh_id, drv_id)
    assert exc.value.status_code == 400
    assert "missing" in str(exc.value.detail)

    # Add ALL mandatory docs EXCEPT one (PUC)
    add_verified_doc(db_session, DocumentOwnerType.DRIVER, drv_id, DocumentType.DRIVING_LICENSE, admin_user)
    add_verified_doc(db_session, DocumentOwnerType.VEHICLE, veh_id, DocumentType.REGISTRATION, admin_user)
    add_verified_doc(db_session, DocumentOwnerType.VEHICLE, veh_id, DocumentType.INSURANCE, admin_user)
    add_verified_doc(db_session, DocumentOwnerType.VEHICLE, veh_id, DocumentType.PERMIT, admin_user)
    
    with pytest.raises(HTTPException) as exc:
        ComplianceService.validate_dispatch_eligibility(db_session, veh_id, drv_id)
    assert exc.value.status_code == 400
    assert "PUC is missing" in str(exc.value.detail)
    
    # Add an EXPIRED PUC
    add_verified_doc(db_session, DocumentOwnerType.VEHICLE, veh_id, DocumentType.PUC, admin_user, expires_in_days=-1)
    
    with pytest.raises(HTTPException) as exc:
        ComplianceService.validate_dispatch_eligibility(db_session, veh_id, drv_id)
    assert exc.value.status_code == 400
    assert "PUC is expired" in str(exc.value.detail)
    
    # Add VALID PUC
    add_verified_doc(db_session, DocumentOwnerType.VEHICLE, veh_id, DocumentType.PUC, admin_user, expires_in_days=30)
    
    # Now it should pass without throwing
    ComplianceService.validate_dispatch_eligibility(db_session, veh_id, drv_id)

def test_compliance_notifications(db_session, admin_user, setup_compliance_entities):
    veh_id, drv_id, _ = setup_compliance_entities
    
    add_verified_doc(db_session, DocumentOwnerType.VEHICLE, veh_id, DocumentType.INSURANCE, admin_user, expires_in_days=29)
    add_verified_doc(db_session, DocumentOwnerType.VEHICLE, veh_id, DocumentType.PUC, admin_user, expires_in_days=6)
    add_verified_doc(db_session, DocumentOwnerType.VEHICLE, veh_id, DocumentType.PERMIT, admin_user, expires_in_days=-2)
    
    # Run the cron task
    ComplianceService.check_compliance_expirations(db_session)
    
    # Verify notifications were created
    from app.models.notifications import Notification
    
    n1 = db_session.query(Notification).filter(Notification.event_type == "COMPLIANCE_EXPIRING_SOON").first()
    assert n1 is not None
    assert "INSURANCE" in n1.message
    
    n2 = db_session.query(Notification).filter(Notification.event_type == "COMPLIANCE_EXPIRING_URGENT").first()
    assert n2 is not None
    assert "PUC" in n2.message
    
    n3 = db_session.query(Notification).filter(Notification.event_type == "COMPLIANCE_EXPIRED").first()
    assert n3 is not None
    assert "PERMIT for VEHICLE has expired" in n3.message
