from datetime import date
from app.db.database import SessionLocal
from app.models.customer import Customer
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.user import User

def seed():
    db = SessionLocal()
    
    # Create User for Customer
    u1 = db.query(User).filter(User.email == "customer@cargox.com").first()
    if not u1:
        u1 = User(email="customer@cargox.com", hashed_password="pw")
        db.add(u1)
        db.commit()

    # Create customer
    c1 = db.query(Customer).filter(Customer.id == 1).first()
    if not c1:
        c1 = Customer(id=1, user_id=u1.id, full_name="Test Customer", phone_number="1234567890", company_name="Test Co")
        db.add(c1)
    
    # Create vehicles
    v1 = db.query(Vehicle).filter(Vehicle.id == 1).first()
    if not v1:
        v1 = Vehicle(id=1, vehicle_number="AP XX 1234", vehicle_type="Truck", model="Tata", capacity="10.0", fuel_type="Diesel", status="AVAILABLE")
        db.add(v1)
        
    v2 = db.query(Vehicle).filter(Vehicle.id == 2).first()
    if not v2:
        v2 = Vehicle(id=2, vehicle_number="MH 12 AB 1234", vehicle_type="Mini Truck", model="Mahindra", capacity="5.0", fuel_type="Diesel", status="AVAILABLE")
        db.add(v2)
        
    # Create User for Drivers
    ud1 = db.query(User).filter(User.email == "driver1@cargox.com").first()
    if not ud1:
        ud1 = User(email="driver1@cargox.com", hashed_password="pw")
        db.add(ud1)
        db.commit()
        
    ud2 = db.query(User).filter(User.email == "driver2@cargox.com").first()
    if not ud2:
        ud2 = User(email="driver2@cargox.com", hashed_password="pw")
        db.add(ud2)
        db.commit()

    # Create drivers
    d1 = db.query(Driver).filter(Driver.id == 1).first()
    if not d1:
        d1 = Driver(id=1, user_id=ud1.id, full_name="Rahul Sharma", license_number="DL12345", phone_number="9876543210", status="AVAILABLE")
        db.add(d1)
        
    d2 = db.query(Driver).filter(Driver.id == 2).first()
    if not d2:
        d2 = Driver(id=2, user_id=ud2.id, full_name="Ravi Kumar", license_number="DL67890", phone_number="9876543211", status="AVAILABLE")
        db.add(d2)

    db.commit()
    db.close()
    print("Database seeded with test data!")

if __name__ == "__main__":
    seed()
