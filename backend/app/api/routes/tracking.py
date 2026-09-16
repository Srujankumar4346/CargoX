from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional

from app.db.database import get_db
from app.models.trip import Trip
from app.models.tracking import LocationUpdate, ProofOfDelivery
from app.api.deps import get_current_active_user

router = APIRouter()

# Schemas
class LocationCreate(BaseModel):
    latitude: float
    longitude: float

class LocationResponse(BaseModel):
    id: int
    trip_id: int
    latitude: float
    longitude: float
    timestamp: datetime
    
    class Config:
        from_attributes = True

class PODCreate(BaseModel):
    receiver_name: str
    signature_url: str
    delivery_image_url: Optional[str] = None
    notes: Optional[str] = None

class PODResponse(BaseModel):
    id: int
    trip_id: int
    receiver_name: str
    signature_url: str
    delivery_image_url: Optional[str]
    notes: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Routes
@router.post("/{trip_id}/location", response_model=LocationResponse)
def log_location(trip_id: int, location: LocationCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_active_user)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    if current_user["role"] == "CUSTOMER":
        raise HTTPException(status_code=403, detail="Customers cannot log locations")
    elif current_user["role"] == "DRIVER" and trip.driver_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to log location for this trip")
    
    if trip.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="Cannot log location for COMPLETED trip")

    loc = LocationUpdate(
        trip_id=trip_id,
        latitude=location.latitude,
        longitude=location.longitude
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc

@router.get("/{trip_id}/location", response_model=List[LocationResponse])
def get_location_history(
    trip_id: int, 
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    if current_user["role"] == "CUSTOMER" and trip.booking.customer_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this trip's location history")
    elif current_user["role"] == "DRIVER" and trip.driver_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this trip's location history")
        
    locations = db.query(LocationUpdate).filter(LocationUpdate.trip_id == trip_id).order_by(LocationUpdate.timestamp.asc()).offset(skip).limit(limit).all()
    return locations

@router.post("/{trip_id}/pod", response_model=PODResponse)
def submit_pod(trip_id: int, pod_data: PODCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_active_user)):
    trip = db.query(Trip).filter(Trip.id == trip_id).with_for_update().first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    if current_user["role"] == "CUSTOMER":
        raise HTTPException(status_code=403, detail="Customers cannot submit PODs")
    elif current_user["role"] == "DRIVER" and trip.driver_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to submit POD for this trip")
        
    if trip.status not in ["DELIVERED", "ARRIVED AT DESTINATION"]:
        raise HTTPException(status_code=400, detail=f"Cannot submit POD when trip is {trip.status}")
        
    existing_pod = db.query(ProofOfDelivery).filter(ProofOfDelivery.trip_id == trip_id).first()
    if existing_pod:
        raise HTTPException(status_code=400, detail="POD already submitted for this trip")

    # Upload validation logic should occur in a dedicated upload endpoint, but assuming URLs are passed here:
    # We rely on the /mobile/upload-document or similar endpoints for the actual file upload security.
    
    pod = ProofOfDelivery(
        trip_id=trip_id,
        receiver_name=pod_data.receiver_name,
        signature_url=pod_data.signature_url,
        delivery_image_url=pod_data.delivery_image_url,
        notes=pod_data.notes
    )
    db.add(pod)
    db.commit()
    db.refresh(pod)
    return pod
