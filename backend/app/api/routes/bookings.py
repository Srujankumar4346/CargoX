from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.booking import Booking
from app.services.notifications.notifier import NotificationService
from app.schemas.booking import BookingCreate, BookingResponse

router = APIRouter()

@router.post("/", response_model=BookingResponse)
def create_booking(booking: BookingCreate, db: Session = Depends(get_db)):
    new_booking = Booking(**booking.model_dump())
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)
    
    # Notify Admin
    NotificationService.notify(
        db=db,
        user_type="ADMIN",
        user_id=0,
        title="New Booking Requested",
        message=f"Customer {booking.customer_id} requested a {booking.cargo_weight} Ton booking from {booking.pickup_address} to {booking.drop_address}.",
        channels=["IN_APP"]
    )
    
    return new_booking

@router.get("/", response_model=list[BookingResponse])
def read_bookings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Booking).offset(skip).limit(limit).all()

@router.put("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "REQUESTED":
        raise HTTPException(status_code=400, detail="Only REQUESTED bookings can be cancelled")
    booking.status = "CANCELLED"
    db.commit()
    db.refresh(booking)
    return booking
