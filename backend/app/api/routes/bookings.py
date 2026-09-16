from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.booking import Booking
from app.schemas.booking import BookingCreate, BookingResponse
from app.api.deps import get_current_active_user

router = APIRouter()

@router.post("/", response_model=BookingResponse)
def create_booking(
    booking: BookingCreate, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    # Customers can only book for themselves
    if current_user["role"] == "CUSTOMER" and booking.customer_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only create bookings for your own account")
    # Drivers cannot create bookings
    if current_user["role"] == "DRIVER":
        raise HTTPException(status_code=403, detail="Drivers cannot create bookings")

    new_booking = Booking(**booking.model_dump())
    db.add(new_booking)
    db.commit()
    db.refresh(new_booking)
    
    # Emit Domain Event
    from app.domain.events import event_dispatcher, DomainEvent
    event_dispatcher.publish(db, DomainEvent(event_type="NEW_BOOKING", entity_id=new_booking.id))
    
    return new_booking

@router.get("/", response_model=list[BookingResponse])
def read_bookings(
    skip: int = Query(0, ge=0), 
    limit: int = Query(50, ge=1, le=100), 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    query = db.query(Booking)
    
    if current_user["role"] == "CUSTOMER":
        query = query.filter(Booking.customer_id == current_user["id"])
    elif current_user["role"] == "DRIVER":
        raise HTTPException(status_code=403, detail="Drivers cannot list all bookings")
        
    return query.offset(skip).limit(limit).all()

@router.get("/{booking_id}", response_model=BookingResponse)
def get_booking(booking_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_active_user)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if current_user["role"] == "CUSTOMER" and booking.customer_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to access this booking")
    elif current_user["role"] == "DRIVER":
         raise HTTPException(status_code=403, detail="Drivers cannot access bookings directly")
         
    return booking

@router.put("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking(booking_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_active_user)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if current_user["role"] == "CUSTOMER" and booking.customer_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")
    if current_user["role"] == "DRIVER":
        raise HTTPException(status_code=403, detail="Drivers cannot cancel bookings")

    if booking.status != "REQUESTED":
        raise HTTPException(status_code=400, detail="Only REQUESTED bookings can be cancelled")
        
    booking.status = "CANCELLED"
    db.commit()
    db.refresh(booking)
    return booking
