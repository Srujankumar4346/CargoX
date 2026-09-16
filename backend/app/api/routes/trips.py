from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date
import uuid
from app.db.database import get_db
from app.models.trip import Trip
from app.models.booking import Booking
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.trip_status_history import TripStatusHistory
from app.models.invoice import Invoice
from app.models.tracking import ProofOfDelivery
from app.schemas.trip import TripCreate, TripResponse
from app.domain.events import event_dispatcher, DomainEvent
from app.api.deps import get_current_active_user, get_current_admin

router = APIRouter()

@router.post("/", response_model=TripResponse)
def create_trip(
    trip: TripCreate, 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_admin)
):
    # Concurrency safe assignment
    # Lock booking, vehicle, driver
    booking = db.query(Booking).filter(Booking.id == trip.booking_id).with_for_update().first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status not in ["REQUESTED", "CONFIRMED"]:
        raise HTTPException(status_code=400, detail="Booking is not in a valid state for assignment")

    vehicle = db.query(Vehicle).filter(Vehicle.id == trip.vehicle_id).with_for_update().first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if vehicle.status != "AVAILABLE":
        raise HTTPException(status_code=400, detail="Vehicle is not available")
    try:
        capacity_val = float(vehicle.capacity.lower().replace("ton", "").strip())
        if booking.cargo_weight > capacity_val:
            raise HTTPException(status_code=400, detail="Cargo weight exceeds vehicle capacity")
    except ValueError:
        pass

    driver = db.query(Driver).filter(Driver.id == trip.driver_id).with_for_update().first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    if driver.status != "AVAILABLE":
        raise HTTPException(status_code=400, detail="Driver is not available")

    # Create Trip
    db_trip = Trip(booking_id=trip.booking_id, driver_id=trip.driver_id, vehicle_id=trip.vehicle_id)
    db.add(db_trip)
    
    # Update Statuses
    booking.status = "VEHICLE + DRIVER ASSIGNED"
    vehicle.status = "ASSIGNED"
    driver.status = "ASSIGNED"
    
    db.flush() # Flush to get db_trip.id before commit
    
    # Create History
    history = TripStatusHistory(trip_id=db_trip.id, status="TRIP CREATED")
    db.add(history)
    
    # Generate Invoice
    base_charge = float(booking.cargo_weight) * 3000.0
    taxes = base_charge * 0.10
    total_amount = base_charge + taxes
    invoice_number = f"INV-CX-{uuid.uuid4().hex[:8].upper()}"
    
    invoice = Invoice(
        invoice_number=invoice_number,
        booking_id=booking.id,
        customer_id=booking.customer_id,
        issue_date=date.today(),
        base_charge=base_charge,
        taxes=taxes,
        discount=0,
        total_amount=total_amount,
        amount_paid=0,
        amount_due=total_amount,
        currency="INR",
        status="PENDING"
    )
    db.add(invoice)
    db.commit()
    
    db.refresh(db_trip)
    db.refresh(invoice)
    
    # Notify Driver & Customer
    event_dispatcher.publish(db, DomainEvent(event_type="VEHICLE_ASSIGNED", entity_id=db_trip.id))
    event_dispatcher.publish(db, DomainEvent(event_type="INVOICE_GENERATED", entity_id=invoice.id))
    
    return db_trip


@router.get("/", response_model=list[TripResponse])
def read_trips(
    skip: int = Query(0, ge=0), 
    limit: int = Query(50, ge=1, le=100), 
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_active_user)
):
    query = db.query(Trip)
    
    if current_user["role"] == "CUSTOMER":
        query = query.join(Booking).filter(Booking.customer_id == current_user["id"])
    elif current_user["role"] == "DRIVER":
        query = query.filter(Trip.driver_id == current_user["id"])
        
    return query.offset(skip).limit(limit).all()


@router.put("/{trip_id}/status", response_model=TripResponse)
def update_trip_status(
    trip_id: int, 
    new_status: str, 
    location: str = None, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_active_user)
):
    trip = db.query(Trip).filter(Trip.id == trip_id).with_for_update().first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    if current_user["role"] == "CUSTOMER":
        raise HTTPException(status_code=403, detail="Customers cannot update trip status")
    elif current_user["role"] == "DRIVER" and trip.driver_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this trip")
    
    valid_transitions = {
        "TRIP CREATED": ["IN TRANSIT"],
        "IN TRANSIT": ["ARRIVED AT DESTINATION"],
        "ARRIVED AT DESTINATION": ["DELIVERED"],
        "DELIVERED": ["COMPLETED"]
    }
    
    if trip.status in valid_transitions and new_status not in valid_transitions[trip.status]:
        raise HTTPException(status_code=400, detail=f"Invalid transition from {trip.status} to {new_status}")
    
    if new_status == "COMPLETED":
        pod = db.query(ProofOfDelivery).filter(ProofOfDelivery.trip_id == trip_id).first()
        if not pod:
            raise HTTPException(status_code=400, detail="Cannot mark trip as COMPLETED without Proof of Delivery")

        # Concurrency safety: Get lock on related records
        booking = db.query(Booking).filter(Booking.id == trip.booking_id).with_for_update().first()
        vehicle = db.query(Vehicle).filter(Vehicle.id == trip.vehicle_id).with_for_update().first()
        driver = db.query(Driver).filter(Driver.id == trip.driver_id).with_for_update().first()

        booking.status = "COMPLETED"
        vehicle.status = "AVAILABLE"
        driver.status = "AVAILABLE"
        
    trip.status = new_status
    history = TripStatusHistory(trip_id=trip_id, status=new_status, location=location)
    db.add(history)
    
    db.commit()
    db.refresh(trip)
    
    event_type = "TRIP_UPDATED"
    if new_status == "IN TRANSIT":
        event_type = "TRIP_STARTED"
    elif new_status == "DELIVERED":
        event_type = "DELIVERED"
    elif new_status == "ARRIVED AT DESTINATION":
        event_type = "ARRIVED_AT_DESTINATION"
    elif new_status == "COMPLETED":
        event_type = "DELIVERY_COMPLETED"
    
    event_dispatcher.publish(db, DomainEvent(event_type=event_type, entity_id=trip.id))
    
    return trip
