import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone, timedelta

from app.main import app
from app.db.database import get_db
from app.db.base import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.config import settings
from app.core.security import get_password_hash

# Setup Test DB
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:Srujan%40123@localhost:5055/cargox_test"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(scope="module")
def setup_e2e_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Setup necessary roles
    from app.models.role import Role
    admin_role = Role(name="ADMIN")
    cust_role = Role(name="CUSTOMER")
    driver_role = Role(name="DRIVER")
    db.add_all([admin_role, cust_role, driver_role])
    db.commit()

    from app.models.user import User
    from app.models.customer import Customer
    from app.models.driver import Driver
    from app.models.vehicle import Vehicle

    admin_user = User(email="admin_e2e@cargox.test", hashed_password="dummy_hash", role_id=admin_role.id)
    cust_user = User(email="cust_e2e@cargox.test", hashed_password="dummy_hash", role_id=cust_role.id)
    drv_user = User(email="drv_e2e@cargox.test", hashed_password="dummy_hash", role_id=driver_role.id)
    db.add_all([admin_user, cust_user, drv_user])
    db.commit()

    cust_prof = Customer(user_id=cust_user.id, company_name="E2E Corp", full_name="E2E Cust", phone_number="123")
    drv_prof = Driver(user_id=drv_user.id, full_name="E2E Driver", phone_number="456", license_number="L-E2E", status="AVAILABLE")
    db.add_all([cust_prof, drv_prof])
    db.commit()
    
    vehicle = Vehicle(vehicle_number="E2E-V1", vehicle_type="Truck", capacity="20 tons", status="AVAILABLE")
    db.add(vehicle)
    db.commit()

    db.close()
    
    yield
    engine.dispose()
    Base.metadata.drop_all(bind=engine)

def get_token(username, password):
    res = client.post("/api/auth/login", data={"username": username, "password": password})
    return res.json()["access_token"]

from unittest.mock import patch

@patch('app.api.routes.auth.verify_password', return_value=True)
def test_rc1_e2e_flow(mock_verify, setup_e2e_db):
    # 1. Customer Login
    cust_token = get_token("cust_e2e@cargox.test", "pass")
    
    db = TestingSessionLocal()
    from app.models.customer import Customer
    from app.models.vehicle import Vehicle
    from app.models.driver import Driver
    
    cust = db.query(Customer).filter_by(company_name="E2E Corp").first()
    vehicle = db.query(Vehicle).filter_by(vehicle_number="E2E-V1").first()
    driver = db.query(Driver).filter_by(license_number="L-E2E").first()
    db.close()

    # 2. Customer Creates Booking
    res = client.post(
        "/api/bookings/", 
        headers={"Authorization": f"Bearer {cust_token}"},
        json={
            "customer_id": cust.id,
            "pickup_address": "Point A",
            "drop_address": "Point B",
            "cargo_type": "Electronics",
            "cargo_weight": 5
        }
    )
    assert res.status_code == 200, res.text
    booking_id = res.json()["id"]

    # 3. Admin Login & Assign
    admin_token = get_token("admin_e2e@cargox.test", "pass")
    res = client.post(
        "/api/trips/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "booking_id": booking_id,
            "vehicle_id": vehicle.id,
            "driver_id": driver.id
        }
    )
    assert res.status_code == 200, res.text
    trip_id = res.json()["id"]

    # 4. Driver Login
    drv_token = get_token("drv_e2e@cargox.test", "pass")
    
    # Driver starts trip (IN TRANSIT)
    res = client.put(
        f"/api/mobile/trips/{trip_id}/status?new_status=IN TRANSIT",
        headers={"Authorization": f"Bearer {drv_token}"}
    )
    assert res.status_code == 200, res.text

    # Driver sends GPS update
    res = client.post(
        f"/api/tracking/{trip_id}/location",
        headers={"Authorization": f"Bearer {drv_token}"},
        json={
            "latitude": 10.0,
            "longitude": 20.0
        }
    )
    assert res.status_code == 200, res.text

    # Driver arrives
    res = client.put(
        f"/api/mobile/trips/{trip_id}/status?new_status=ARRIVED AT DESTINATION",
        headers={"Authorization": f"Bearer {drv_token}"}
    )
    assert res.status_code == 200, res.text

    # Driver submits POD data
    res = client.post(
        f"/api/mobile/trips/{trip_id}/pod",
        headers={"Authorization": f"Bearer {drv_token}"},
        json={
            "receiver_name": "John Doe",
            "signature_url": "/uploads/test.png",
            "notes": "Delivered intact"
        }
    )
    assert res.status_code == 200, res.text

    # Driver marks delivered
    res = client.put(
        f"/api/mobile/trips/{trip_id}/status?new_status=DELIVERED",
        headers={"Authorization": f"Bearer {drv_token}"}
    )
    assert res.status_code == 200, res.text

    # Admin marks complete
    res = client.put(
        f"/api/trips/{trip_id}/status?new_status=COMPLETED",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200, res.text

    # 5. System Verifications
    db = TestingSessionLocal()
    from app.models.booking import Booking
    from app.models.invoice import Invoice
    
    v2 = db.query(Vehicle).filter_by(id=vehicle.id).first()
    d2 = db.query(Driver).filter_by(id=driver.id).first()
    b2 = db.query(Booking).filter_by(id=booking_id).first()
    inv = db.query(Invoice).filter_by(booking_id=booking_id).first()
    
    assert v2.status == "AVAILABLE", "Vehicle should be available"
    assert d2.status == "AVAILABLE", "Driver should be available"
    assert b2.status == "COMPLETED", "Booking should be completed"
    assert inv is not None, "Invoice should be generated"
    assert inv.status == "PENDING"
    db.close()
