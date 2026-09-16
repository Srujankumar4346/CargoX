from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os
import uuid
import mimetypes

from app.db.database import get_db
from app.models.trip import Trip
from app.schemas.trip import TripResponse
from app.api.routes.trips import update_trip_status
from app.api.routes.tracking import submit_pod, PODCreate, PODResponse
from app.api.deps import get_current_active_user
from app.core.config import settings

router = APIRouter()

@router.get("/trips/today", response_model=List[TripResponse])
def get_todays_trips(db: Session = Depends(get_db), current_user: dict = Depends(get_current_active_user)):
    if current_user["role"] != "DRIVER":
        raise HTTPException(status_code=403, detail="Only drivers can access this endpoint")
        
    trips = db.query(Trip).filter(
        Trip.driver_id == current_user["id"],
        Trip.status != "COMPLETED"
    ).all()
    return trips

@router.get("/trips/{trip_id}", response_model=TripResponse)
def get_trip_details(trip_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_active_user)):
    if current_user["role"] != "DRIVER":
        raise HTTPException(status_code=403, detail="Only drivers can access this endpoint")
        
    trip = db.query(Trip).filter(
        Trip.id == trip_id,
        Trip.driver_id == current_user["id"]
    ).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found or not assigned to you")
    return trip

@router.put("/trips/{trip_id}/status", response_model=TripResponse)
def mobile_update_trip_status(trip_id: int, new_status: str, location: str = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_active_user)):
    if current_user["role"] != "DRIVER":
        raise HTTPException(status_code=403, detail="Only drivers can update status here")
        
    # Delegation to the main trip status updater. The update_trip_status handles object-level auth natively now.
    return update_trip_status(trip_id, new_status, location, db, current_user)

@router.post("/trips/{trip_id}/pod", response_model=PODResponse)
def mobile_submit_pod(trip_id: int, pod_data: PODCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_active_user)):
    if current_user["role"] != "DRIVER":
        raise HTTPException(status_code=403, detail="Only drivers can submit POD here")
        
    # Delegation to the main submit_pod endpoint which handles object-level auth
    return submit_pod(trip_id, pod_data, db, current_user)

@router.post("/trips/{trip_id}/upload-document")
async def upload_pod_document(
    trip_id: int, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_active_user)
):
    if current_user["role"] != "DRIVER":
        raise HTTPException(status_code=403, detail="Only drivers can upload documents")
        
    trip = db.query(Trip).filter(Trip.id == trip_id, Trip.driver_id == current_user["id"]).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found or not assigned to you")
        
    # File upload security validation
    MAX_FILE_SIZE = 5 * 1024 * 1024 # 5 MB
    ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"]
    
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")
        
    mime_type, _ = mimetypes.guess_type(file.filename)
    if not mime_type or mime_type not in ALLOWED_MIME_TYPES:
         raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {ALLOWED_MIME_TYPES}")
         
    # Sanitize filename & generate unique path
    ext = os.path.splitext(file.filename)[1]
    safe_filename = f"trip_{trip_id}_{uuid.uuid4().hex}{ext}"
    
    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, safe_filename)
    
    with open(file_path, "wb") as f:
        f.write(file_content)
        
    # Return a safe URL reference (not Base64)
    file_url = f"/uploads/{safe_filename}"
    return {"url": file_url, "filename": safe_filename}
