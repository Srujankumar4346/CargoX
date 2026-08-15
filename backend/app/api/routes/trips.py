from fastapi import APIRouter, Depends, HTTPException
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
from app.services.notifications.notifier import NotificationService

router = APIRouter()

@router.post("/", response_model=TripResponse)
def create_trip(trip: TripCreate, db: Session = Depends(get_db)):
    # Validate Booking
    booking = db.query(Booking).filter(Booking.id == trip.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status != "REQUESTED" and booking.status != "CONFIRMED":
        raise HTTPException(status_code=400, detail="Booking is not in a valid state for assignment")

    # Validate Vehicle availability & capacity
    vehicle = db.query(Vehicle).filter(Vehicle.id == trip.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if vehicle.status != "AVAILABLE":
        raise HTTPException(status_code=400, detail="Vehicle is not available")
    try:
        # Assuming capacity is a string like "10 Ton", extract number
        capacity_val = float(vehicle.capacity.lower().replace("ton", "").strip())
        if booking.cargo_weight > capacity_val:
            raise HTTPException(status_code=400, detail="Cargo weight exceeds vehicle capacity")
    except ValueError:
        pass # Handle cases where parsing fails, ignore for this simple implementation

    # Validate Driver availability
    driver = db.query(Driver).filter(Driver.id == trip.driver_id).first()
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
    
    db.commit()
    db.refresh(db_trip)
    
    # Notify Driver & Customer
    NotificationService.notify(
        db=db,
        user_type="DRIVER",
        user_id=trip.driver_id,
        title="New Trip Assigned",
        message=f"You have been assigned to Trip #{db_trip.id}.",
        channels=["IN_APP", "SMS"]
    )
    NotificationService.notify(
        db=db,
        user_type="CUSTOMER",
        user_id=booking.customer_id,
        title="Vehicle Assigned",
        message=f"Vehicle has been assigned to your booking #CX100{booking.id}.",
        channels=["IN_APP", "EMAIL"]
    )
    
    # Create History
    history = TripStatusHistory(trip_id=db_trip.id, status="TRIP CREATED")
    db.add(history)
    
    # Generate Invoice
    base_charge = float(booking.cargo_weight) * 3000.0  # INR 3000 per ton
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
    
    return db_trip

@router.put("/{trip_id}/status", response_model=TripResponse)
def update_trip_status(trip_id: int, new_status: str, location: str = None, db: Session = Depends(get_db)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Validation for status flow
    valid_transitions = {
        "TRIP CREATED": ["IN TRANSIT"],
        "IN TRANSIT": ["ARRIVED AT DESTINATION"],
        "ARRIVED AT DESTINATION": ["DELIVERED"],
        "DELIVERED": ["COMPLETED"]
    }
    
    if trip.status in valid_transitions and new_status not in valid_transitions[trip.status]:
        raise HTTPException(status_code=400, detail=f"Invalid transition from {trip.status} to {new_status}")
    
    if new_status == "COMPLETED":
        # Check for POD
        from app.models.tracking import ProofOfDelivery
        pod = db.query(ProofOfDelivery).filter(ProofOfDelivery.trip_id == trip_id).first()
        if not pod:
            raise HTTPException(status_code=400, detail="Cannot mark trip as COMPLETED without Proof of Delivery")

        trip.booking.status = "COMPLETED"
        trip.vehicle.status = "AVAILABLE"
        trip.driver.status = "AVAILABLE"
        
    trip.status = new_status
    history = TripStatusHistory(trip_id=trip_id, status=new_status, location=location)
    db.add(history)
    
    db.commit()
    db.refresh(trip)
    
    NotificationService.notify(
        db=db,
        user_type="CUSTOMER",
        user_id=trip.booking.customer_id,
        title="Trip Status Updated",
        message=f"Trip #{trip.id} status is now {new_status}.",
        channels=["IN_APP", "SMS"]
    )
    
    return trip
