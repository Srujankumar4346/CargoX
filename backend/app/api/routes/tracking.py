from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional

from app.db.database import get_db
from app.models.trip import Trip
from app.models.tracking import LocationUpdate, ProofOfDelivery

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
def log_location(trip_id: int, location: LocationCreate, db: Session = Depends(get_db)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # We allow logging location as long as it's not completed
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
def get_location_history(trip_id: int, db: Session = Depends(get_db)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    locations = db.query(LocationUpdate).filter(LocationUpdate.trip_id == trip_id).order_by(LocationUpdate.timestamp.asc()).all()
    return locations

@router.post("/{trip_id}/pod", response_model=PODResponse)
def submit_pod(trip_id: int, pod_data: PODCreate, db: Session = Depends(get_db)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    # Validation from user: POD should only be accepted if trip is ARRIVED AT DESTINATION or DELIVERED.
    # Note: user workflow is: IN TRANSIT -> ARRIVED AT DESTINATION -> DELIVERED -> POD Submitted -> COMPLETED.
    # Wait, the user said: "The driver shouldn't be able to simply click Completed without POD."
    # So the trip status should be DELIVERED to submit POD, and then we might mark it COMPLETED via update_trip_status or directly here.
    if trip.status not in ["DELIVERED", "ARRIVED AT DESTINATION"]:
        raise HTTPException(status_code=400, detail=f"Cannot submit POD when trip is {trip.status}")
        
    # Check if POD already exists
    existing_pod = db.query(ProofOfDelivery).filter(ProofOfDelivery.trip_id == trip_id).first()
    if existing_pod:
        raise HTTPException(status_code=400, detail="POD already submitted for this trip")

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
