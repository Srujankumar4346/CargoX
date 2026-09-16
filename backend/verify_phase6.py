import os
import sys
from datetime import date
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, engine
from app.models.notification import Notification
from app.models.booking import Booking
from app.models.trip import Trip
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.tracking import ProofOfDelivery
from app.api.routes.bookings import create_booking
from app.schemas.booking import BookingCreate
from app.api.routes.trips import create_trip, update_trip_status
from app.schemas.trip import TripCreate

def run_verification():
    db = SessionLocal()
    
    print("--- Starting Phase 6 Verification ---")
    
    # 1. Clean existing notifications to start fresh
    db.query(Notification).delete()
    db.commit()
    
    # Ensure there's a driver and vehicle
    driver = db.query(Driver).first()
    if not driver:
        driver = Driver(name="Test Driver", phone="1234567890", license_number="DL123", status="AVAILABLE")
        db.add(driver)
        db.commit()
        db.refresh(driver)
    else:
        driver.status = "AVAILABLE"
        db.commit()
        
    vehicle = db.query(Vehicle).first()
    if not vehicle:
        vehicle = Vehicle(registration_number="AP09XYZ", capacity="10 Ton", type="Truck", status="AVAILABLE")
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)
    else:
        vehicle.status = "AVAILABLE"
        db.commit()
    
    # 2. Simulate NEW_BOOKING
    print("\n[Simulating NEW_BOOKING]")
    booking_in = BookingCreate(
        customer_id=1,
        pickup_address="Hyd",
        drop_address="Blr",
        pickup_date=date.today(),
        cargo_type="Electronics",
        cargo_weight=5.0
    )
    booking = create_booking(booking_in, db)
    print(f"Booking created: #{booking.id}")
    
    # Check notifications
    notifications = db.query(Notification).filter(Notification.event_type == "NEW_BOOKING").all()
    print(f"Notifications generated for NEW_BOOKING: {len(notifications)}")
    for n in notifications:
        print(f"  - User: {n.user_type}, Channel: {n.channel}, Title: {n.title}")

    # 3. Simulate VEHICLE_ASSIGNED (TRIP_CREATED)
    print("\n[Simulating VEHICLE_ASSIGNED]")
    trip_in = TripCreate(booking_id=booking.id, vehicle_id=vehicle.id, driver_id=driver.id)
    trip = create_trip(trip_in, db)
    print(f"Trip created: #{trip.id}")
    
    notifications = db.query(Notification).filter(Notification.event_type.in_(["VEHICLE_ASSIGNED", "TRIP_ASSIGNED", "INVOICE_GENERATED"])).all()
    print(f"Notifications generated for ASSIGNMENT: {len(notifications)}")
    for n in notifications:
        print(f"  - Event: {n.event_type}, User: {n.user_type}, Channel: {n.channel}")

    # 4. Simulate TRIP_STARTED (IN TRANSIT)
    print("\n[Simulating TRIP_STARTED]")
    trip = update_trip_status(trip.id, "IN TRANSIT", "Hyderabad Outskirts", db)
    
    notifications = db.query(Notification).filter(Notification.event_type == "TRIP_STARTED").all()
    print(f"Notifications generated for TRIP_STARTED: {len(notifications)}")
    for n in notifications:
        print(f"  - User: {n.user_type}, Channel: {n.channel}")

    # 5. Simulate ARRIVED AT DESTINATION and POD and DELIVERY_COMPLETED
    print("\n[Simulating DELIVERY_COMPLETED]")
    trip = update_trip_status(trip.id, "ARRIVED AT DESTINATION", "Bangalore", db)
    
    pod = ProofOfDelivery(trip_id=trip.id, receiver_name="John", signature_url="sig.png")
    db.add(pod)
    db.commit()
    
    trip = update_trip_status(trip.id, "DELIVERED", "Bangalore Warehouse", db)
    trip = update_trip_status(trip.id, "COMPLETED", "Bangalore Warehouse", db)
    
    notifications = db.query(Notification).filter(Notification.event_type == "DELIVERY_COMPLETED").all()
    print(f"Notifications generated for DELIVERY_COMPLETED: {len(notifications)}")
    for n in notifications:
        print(f"  - User: {n.user_type}, Channel: {n.channel}")

    # 6. Verify duplicate prevention
    print("\n[Verifying Duplicate Prevention]")
    initial_count = db.query(Notification).count()
    print(f"Total notifications before duplicate event: {initial_count}")
    
    # Re-emit the same event
    from app.domain.events import event_dispatcher, DomainEvent
    event_dispatcher.publish(db, DomainEvent(event_type="DELIVERY_COMPLETED", entity_id=trip.id))
    
    final_count = db.query(Notification).count()
    print(f"Total notifications after duplicate event: {final_count}")
    if final_count == initial_count:
        print("✅ Duplicate prevention working correctly.")
    else:
        print("❌ Duplicate prevention failed.")
        
    db.close()

if __name__ == "__main__":
    run_verification()
