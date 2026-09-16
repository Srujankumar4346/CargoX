import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from jose import jwt
from datetime import datetime, timedelta, timezone

from app.main import app
from app.db.base import Base
from app.db.database import get_db
from app.core.config import settings
from app.core.security import get_password_hash

# Setup test DB
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
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create test roles
    from app.models.role import Role
    admin_role = Role(name="ADMIN")
    cust_role = Role(name="CUSTOMER")
    driver_role = Role(name="DRIVER")
    db.add_all([admin_role, cust_role, driver_role])
    db.commit()

    # Create test users
    from app.models.user import User
    from app.models.customer import Customer
    from app.models.driver import Driver
    
    # Admin
    admin = User(email="admin@cargox.test", hashed_password="dummy_hash", role_id=admin_role.id)
    db.add(admin)
    
    # Customer A
    cust_a = User(email="custa@test.com", hashed_password="dummy_hash", role_id=cust_role.id)
    db.add(cust_a)
    
    # Customer B
    cust_b = User(email="custb@test.com", hashed_password="dummy_hash", role_id=cust_role.id)
    db.add(cust_b)
    
    # Driver A
    drv_a = User(email="drva@test.com", hashed_password="dummy_hash", role_id=driver_role.id)
    db.add(drv_a)
    
    db.commit()
    
    # Profiles
    c_a_prof = Customer(user_id=cust_a.id, company_name="Company A", full_name="Cust A", phone_number="222")
    c_b_prof = Customer(user_id=cust_b.id, company_name="Company B", full_name="Cust B", phone_number="333")
    d_a_prof = Driver(user_id=drv_a.id, full_name="Driver A", phone_number="444", license_number="L1")
    
    db.add_all([c_a_prof, c_b_prof, d_a_prof])
    db.commit()
    
    # Create a booking for Customer A
    from app.models.booking import Booking
    booking = Booking(customer_id=c_a_prof.id, pickup_address="P1", drop_address="D1", cargo_type="Box", cargo_weight=10)
    db.add(booking)
    db.commit()
    db.close()
    
    yield
    engine.dispose()
    Base.metadata.drop_all(bind=engine)

def get_token(user_id: int, role: str):
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def test_object_level_authorization(setup_db):
    db = TestingSessionLocal()
    from app.models.customer import Customer
    from app.models.booking import Booking
    
    cust_a = db.query(Customer).filter_by(company_name="Company A").first()
    cust_b = db.query(Customer).filter_by(company_name="Company B").first()
    booking = db.query(Booking).first()
    
    # Test Customer A can view their booking
    token_a = get_token(cust_a.user_id, "CUSTOMER")
    res_a = client.get(f"/api/bookings/{booking.id}", headers={"Authorization": f"Bearer {token_a}"})
    assert res_a.status_code == 200
    assert res_a.json()["id"] == booking.id
    
    # Test Customer B CANNOT view Customer A's booking
    token_b = get_token(cust_b.user_id, "CUSTOMER")
    res_b = client.get(f"/api/bookings/{booking.id}", headers={"Authorization": f"Bearer {token_b}"})
    assert res_b.status_code == 403
    
    # Test Admin CAN view Customer A's booking
    from app.models.user import User
    from app.models.role import Role
    admin = db.query(User).join(Role).filter(Role.name == "ADMIN").first()
    token_admin = get_token(admin.id, "ADMIN")
    res_admin = client.get(f"/api/bookings/{booking.id}", headers={"Authorization": f"Bearer {token_admin}"})
    assert res_admin.status_code == 200
    
    db.close()

def test_rate_limiting():
    # Make multiple quick requests to login to trigger rate limit (5 per minute)
    responses = []
    for _ in range(10):
        res = client.post("/api/auth/login", data={"username": "admin@cargox.test", "password": "wrong_password"})
        responses.append(res.status_code)
    
    # Some should be 401 (wrong password), but after 5 it should be 429 Too Many Requests
    assert 429 in responses

def test_pagination(setup_db):
    db = TestingSessionLocal()
    from app.models.user import User
    from app.models.role import Role
    admin = db.query(User).join(Role).filter(Role.name == "ADMIN").first()
    token_admin = get_token(admin.id, "ADMIN")
    
    # Try fetching bookings with limit=2
    res = client.get("/api/bookings?skip=0&limit=2", headers={"Authorization": f"Bearer {token_admin}"})
    assert res.status_code == 200
    assert len(res.json()) <= 2
    
    db.close()
