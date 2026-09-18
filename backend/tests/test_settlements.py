import pytest
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy import text
from app.db.database import SessionLocal
from app.models.enums import UserRole, DeliveryRequestStatus, ExpensePayer, ExpenseCategory, ExpenseStatus
from app.models.user import User
from app.models.fleet import Driver, VehicleAssignment
from app.models.delivery import DeliveryRequest, Trip
from app.models.operations import TripExpense
from app.api.deps import get_current_admin, get_db
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(autouse=True)
def mock_compliance_service(monkeypatch):
    monkeypatch.setattr("app.services.dispatch_service.ComplianceService.validate_dispatch_eligibility", lambda *args, **kwargs: None)

@pytest.fixture(autouse=True)
def cleanup_database():
    db = SessionLocal()
    yield
    try:
        db.execute(text("DELETE FROM location_histories"))
        db.execute(text("DELETE FROM payments"))
        db.execute(text("DELETE FROM trip_expenses"))
        db.execute(text("DELETE FROM proof_of_deliveries"))
        db.execute(text("DELETE FROM vehicle_assignments"))
        db.execute(text("DELETE FROM trips"))
        db.execute(text("DELETE FROM driver_settlements"))
        db.execute(text("DELETE FROM invoices"))
        db.execute(text("DELETE FROM quotations"))
        db.execute(text("DELETE FROM delivery_requests"))
        db.execute(text("DELETE FROM compliance_documents"))
        db.execute(text("DELETE FROM vehicle_maintenance"))
        db.execute(text("DELETE FROM notifications"))
        db.execute(text("DELETE FROM drivers"))
        db.execute(text("DELETE FROM vehicles"))
        db.execute(text("DELETE FROM pricing_configs"))
        db.execute(text("DELETE FROM users"))
        db.execute(text("DELETE FROM recipient_companies"))
        db.execute(text("DELETE FROM customer_companies"))
        db.commit()
        db.execute(text("UPDATE trips SET settlement_id = NULL"))
        db.execute(text("DELETE FROM location_histories"))
        db.execute(text("DELETE FROM payments"))
        db.execute(text("DELETE FROM trip_expenses"))
        db.execute(text("DELETE FROM proof_of_deliveries"))
        db.execute(text("DELETE FROM vehicle_assignments"))
        db.execute(text("DELETE FROM trips"))
        db.execute(text("DELETE FROM driver_settlements"))
        db.execute(text("DELETE FROM invoices"))
        db.execute(text("DELETE FROM quotations"))
        db.execute(text("DELETE FROM delivery_requests"))
        db.execute(text("DELETE FROM compliance_documents"))
        db.execute(text("DELETE FROM vehicle_maintenance"))
        db.execute(text("DELETE FROM notifications"))
        db.execute(text("DELETE FROM drivers"))
        db.execute(text("DELETE FROM vehicles"))
        db.execute(text("DELETE FROM pricing_configs"))
        db.execute(text("DELETE FROM users"))
        db.execute(text("DELETE FROM recipient_companies"))
        db.execute(text("DELETE FROM customer_companies"))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def admin_user(db_session):
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_admin_{uuid.uuid4().hex[:8]}",
        email=f"admin_{uuid.uuid4().hex[:8]}@cargox.com",
        role=UserRole.ADMIN,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

def setup_trip_for_driver(db_session, admin_user):
    from app.models.company import CustomerCompany
    company = CustomerCompany(id=uuid.uuid4(), name=f"Company {uuid.uuid4().hex[:6]}", billing_address="123 Corporate Way, Mumbai", status="ACTIVE")
    db_session.add(company)
    
    driver_user = User(id=uuid.uuid4(), clerk_user_id=f"user_driver_{uuid.uuid4().hex[:8]}", email=f"driver_{uuid.uuid4().hex[:8]}@cargox.com", role=UserRole.DRIVER, is_active=True)
    db_session.add(driver_user)
    db_session.commit()

    driver = Driver(id=uuid.uuid4(), user_id=driver_user.id, name="Settlement Driver", phone="+919999999999", license_number="DL-1234")
    db_session.add(driver)
    
    req = DeliveryRequest(
        id=uuid.uuid4(),
        request_number=f"REQ-{uuid.uuid4().hex[:4]}",
        customer_company_id=company.id,
        goods_type="PALLETIZED",
        weight_tons=5.0,
        pickup_company_name="Origin",
        pickup_address="Origin",
        destination_company_name="Dest",
        destination_address="Dest",
        distance_km=100.0,
        status=DeliveryRequestStatus.COMPLETED,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db_session.add(req)
    
    completed_date = datetime.now(timezone.utc)
    trip = Trip(
        id=uuid.uuid4(),
        request_id=req.id,
        assigned_at=completed_date,
        completed_at=completed_date
    )
    db_session.add(trip)
    
    assignment = VehicleAssignment(
        id=uuid.uuid4(),
        trip_id=trip.id,
        vehicle_id=uuid.uuid4(), # fake vehicle, but FK not checked in this simplified setup or we might need actual vehicle.
        driver_id=driver.id,
        assigned_at=completed_date
    )
    # Actually we need a real vehicle if there's a FK constraint on vehicles
    from app.models.fleet import Vehicle
    veh = Vehicle(id=assignment.vehicle_id, registration_number=f"MH01-{uuid.uuid4().hex[:4]}", type="CONTAINER", capacity_tons=10.0, status="AVAILABLE")
    db_session.add(veh)
    db_session.add(assignment)
    db_session.commit()
    return driver.id, trip.id

def test_settlement_lifecycle_and_immutability(client, db_session, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    driver_id, trip_id = setup_trip_for_driver(db_session, admin_user)

    # Add driver-paid expense
    exp = TripExpense(
        trip_id=trip_id, amount=Decimal("500.00"), category=ExpenseCategory.TOLL,
        status=ExpenseStatus.APPROVED, date=datetime.now(timezone.utc),
        paid_by=ExpensePayer.DRIVER, recorded_by=admin_user.id
    )
    db_session.add(exp)
    
    # Add CargoX-paid expense (should not be reimbursed)
    exp2 = TripExpense(
        trip_id=trip_id, amount=Decimal("1000.00"), category=ExpenseCategory.FUEL,
        status=ExpenseStatus.APPROVED, date=datetime.now(timezone.utc),
        paid_by=ExpensePayer.CARGOX, recorded_by=admin_user.id
    )
    db_session.add(exp2)
    db_session.commit()

    # Generate
    now = datetime.now(timezone.utc)
    gen_resp = client.post("/api/v1/admin/settlements/generate", json={
        "driver_id": str(driver_id),
        "period_start": (now - timedelta(days=1)).isoformat(),
        "period_end": (now + timedelta(days=1)).isoformat(),
        "base_pay": "5000.00",
        "deductions": "200.00",
        "deduction_reason": "Advance"
    })
    if gen_resp.status_code != 200:
        print("GENERATE ERROR:", gen_resp.json())
    assert gen_resp.status_code == 200
    s = gen_resp.json()
    assert s["status"] == "DRAFT"
    assert s["base_pay"] == "5000.00"
    assert s["reimbursements"] == "500.00" # Only DRIVER paid
    assert s["deductions"] == "200.00"
    assert s["total_payout"] == "5300.00"

    s_id = s["id"]

    # Submit
    sub_resp = client.post(f"/api/v1/admin/settlements/{s_id}/submit")
    assert sub_resp.status_code == 200
    assert sub_resp.json()["status"] == "PENDING_PAYMENT"

    # Try to add another expense to this frozen trip -> Should fail
    add_exp_resp = client.post(f"/api/v1/admin/trips/{trip_id}/expenses", json={
        "amount": "100.00", "category": "OTHER", "paid_by": "DRIVER"
    })
    assert add_exp_resp.status_code == 400

    # Pay
    pay_resp = client.post(f"/api/v1/admin/settlements/{s_id}/pay", json={
        "reference_number": "TXN12345"
    })
    assert pay_resp.status_code == 200
    assert pay_resp.json()["status"] == "PAID"
    assert pay_resp.json()["paid_at"] is not None

def test_concurrency_protection(client, db_session, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    app.dependency_overrides[get_db] = lambda: db_session

    driver_id, trip_id = setup_trip_for_driver(db_session, admin_user)
    
    # We will simulate concurrent requests using an async helper or threading, 
    # but since TestClient is sync, it's hard to test pure database FOR UPDATE locks concurrently in pytest.
    # The FOR UPDATE logic is present in the code. We can at least ensure two sequential calls don't double count.
    
    now = datetime.now(timezone.utc)
    payload = {
        "driver_id": str(driver_id),
        "period_start": (now - timedelta(days=1)).isoformat(),
        "period_end": (now + timedelta(days=1)).isoformat(),
        "base_pay": "5000.00"
    }

    # Call 1
    resp1 = client.post("/api/v1/admin/settlements/generate", json=payload)
    if resp1.status_code != 200:
        print("GENERATE CONCURRENCY ERROR:", resp1.json())
    assert resp1.status_code == 200

    # Call 2
    resp2 = client.post("/api/v1/admin/settlements/generate", json=payload)
    # Should fail because no eligible trips left (settlement_id is populated)
    assert resp2.status_code == 400

def test_historical_reassignment_ownership(db_session, admin_user):
    # Driver A assigned -> released -> Driver B assigned -> completed
    from app.models.company import CustomerCompany
    company = CustomerCompany(id=uuid.uuid4(), name=f"Company {uuid.uuid4().hex[:6]}", billing_address="Address", status="ACTIVE")
    db_session.add(company)
    
    driver_user_A = User(id=uuid.uuid4(), clerk_user_id=f"ua_{uuid.uuid4().hex[:8]}", email=f"a_{uuid.uuid4().hex[:8]}@c.com", role=UserRole.DRIVER, is_active=True)
    driver_user_B = User(id=uuid.uuid4(), clerk_user_id=f"ub_{uuid.uuid4().hex[:8]}", email=f"b_{uuid.uuid4().hex[:8]}@c.com", role=UserRole.DRIVER, is_active=True)
    db_session.add_all([driver_user_A, driver_user_B])
    db_session.commit()

    driver_A = Driver(id=uuid.uuid4(), user_id=driver_user_A.id, name="Driver A", phone="+919999999991", license_number="DL-A")
    driver_B = Driver(id=uuid.uuid4(), user_id=driver_user_B.id, name="Driver B", phone="+919999999992", license_number="DL-B")
    db_session.add_all([driver_A, driver_B])
    
    req = DeliveryRequest(
        id=uuid.uuid4(), request_number=f"REQ-{uuid.uuid4().hex[:4]}", customer_company_id=company.id,
        goods_type="BOXES", weight_tons=1.0, pickup_company_name="Origin", pickup_address="Origin",
        destination_company_name="Dest", destination_address="Dest", distance_km=10.0,
        status=DeliveryRequestStatus.COMPLETED, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc)
    )
    db_session.add(req)
    
    now = datetime.now(timezone.utc)
    trip = Trip(id=uuid.uuid4(), request_id=req.id, assigned_at=now, completed_at=now)
    db_session.add(trip)
    
    from app.models.fleet import Vehicle
    veh = Vehicle(id=uuid.uuid4(), registration_number=f"MH01-{uuid.uuid4().hex[:4]}", type="OPEN", capacity_tons=2.0, status="AVAILABLE")
    db_session.add(veh)
    
    # Assignment A (Released)
    assign_a = VehicleAssignment(id=uuid.uuid4(), trip_id=trip.id, vehicle_id=veh.id, driver_id=driver_A.id, assigned_at=now)
    db_session.add(assign_a)
    db_session.commit()
    
    # Release A, Assign B
    assign_a.released_at = now
    assign_b = VehicleAssignment(id=uuid.uuid4(), trip_id=trip.id, vehicle_id=veh.id, driver_id=driver_B.id, assigned_at=now)
    db_session.add(assign_b)
    db_session.commit()

    # Try generate for A -> Should fail, no eligible trips because only assignment B is active at completion
    from app.services.settlement_service import SettlementService
    from fastapi import HTTPException
    import pytest
    with pytest.raises(HTTPException) as exc:
        SettlementService.generate_settlement(db_session, admin_user, driver_A.id, now - timedelta(days=1), now + timedelta(days=1), Decimal("5000"), Decimal("0"), None)
    assert exc.value.status_code == 400

    # Generate for B -> Should succeed and include trip
    s = SettlementService.generate_settlement(db_session, admin_user, driver_B.id, now - timedelta(days=1), now + timedelta(days=1), Decimal("5000"), Decimal("0"), None)
    assert len(s.trips) == 1
    assert s.trips[0].id == trip.id

def test_deduction_validation_and_negative_payout(db_session, admin_user):
    driver_id, _ = setup_trip_for_driver(db_session, admin_user)
    from app.services.settlement_service import SettlementService
    now = datetime.now(timezone.utc)
    
    # Test deduction > 0 without reason
    from fastapi import HTTPException
    import pytest
    with pytest.raises(HTTPException) as exc:
        SettlementService.generate_settlement(db_session, admin_user, driver_id, now - timedelta(days=1), now + timedelta(days=1), Decimal("5000"), Decimal("100"), None)
    assert exc.value.status_code == 400
    assert "Deduction reason is required" in exc.value.detail
    
    # Test total_payout < 0
    with pytest.raises(HTTPException) as exc:
        SettlementService.generate_settlement(db_session, admin_user, driver_id, now - timedelta(days=1), now + timedelta(days=1), Decimal("5000"), Decimal("6000"), "Advance")
    assert exc.value.status_code == 400
    assert "Deductions cannot exceed total compensation" in exc.value.detail

def test_expense_mutation_and_deletion_immutability(db_session, admin_user):
    driver_id, trip_id = setup_trip_for_driver(db_session, admin_user)
    exp = TripExpense(trip_id=trip_id, amount=Decimal("500.00"), category=ExpenseCategory.TOLL, status=ExpenseStatus.APPROVED, date=datetime.now(timezone.utc), paid_by=ExpensePayer.DRIVER, recorded_by=admin_user.id)
    db_session.add(exp)
    db_session.commit()
    
    from app.services.settlement_service import SettlementService
    from app.services.expense_service import ExpenseService
    now = datetime.now(timezone.utc)
    s = SettlementService.generate_settlement(db_session, admin_user, driver_id, now - timedelta(days=1), now + timedelta(days=1), Decimal("5000"), Decimal("0"), None)
    
    # DRAFT - can theoretically mutate expenses? The requirement says PENDING_PAYMENT -> immutable
    SettlementService.submit_settlement(db_session, s.id) # Now PENDING_PAYMENT
    
    from fastapi import HTTPException
    import pytest
    with pytest.raises(HTTPException) as exc:
        ExpenseService.update_expense(db_session, exp.id, amount=Decimal("600"), admin_user=admin_user)
    assert exc.value.status_code == 400
    
    with pytest.raises(HTTPException) as exc:
        ExpenseService.change_expense_status(db_session, exp.id, ExpenseStatus.REJECTED, admin_user=admin_user)
    assert exc.value.status_code == 400
    
    with pytest.raises(HTTPException) as exc:
        ExpenseService.delete_expense(db_session, exp.id, admin_user=admin_user)
    assert exc.value.status_code == 400

def test_settlement_financial_immutability(db_session, admin_user):
    driver_id, _ = setup_trip_for_driver(db_session, admin_user)
    from app.services.settlement_service import SettlementService
    now = datetime.now(timezone.utc)
    s = SettlementService.generate_settlement(db_session, admin_user, driver_id, now - timedelta(days=1), now + timedelta(days=1), Decimal("5000"), Decimal("0"), None)
    
    # Update works in DRAFT
    s = SettlementService.update_settlement(db_session, s.id, base_pay=Decimal("5500"))
    assert s.base_pay == Decimal("5500")
    
    # Move to PENDING_PAYMENT
    SettlementService.submit_settlement(db_session, s.id)
    
    from fastapi import HTTPException
    import pytest
    # Update fails in PENDING_PAYMENT
    with pytest.raises(HTTPException) as exc:
        SettlementService.update_settlement(db_session, s.id, base_pay=Decimal("6000"))
    assert exc.value.status_code == 400

def test_invalid_state_transitions(db_session, admin_user):
    driver_id, _ = setup_trip_for_driver(db_session, admin_user)
    from app.services.settlement_service import SettlementService
    now = datetime.now(timezone.utc)
    s = SettlementService.generate_settlement(db_session, admin_user, driver_id, now - timedelta(days=1), now + timedelta(days=1), Decimal("5000"), Decimal("0"), None)
    
    from fastapi import HTTPException
    import pytest
    
    # DRAFT -> PAID (fails)
    with pytest.raises(HTTPException) as exc:
        SettlementService.pay_settlement(db_session, s.id, "TXN123")
    assert exc.value.status_code == 400
    
    SettlementService.submit_settlement(db_session, s.id) # -> PENDING_PAYMENT
    
    # PENDING_PAYMENT -> CANCELLED (fails)
    with pytest.raises(HTTPException) as exc:
        SettlementService.cancel_settlement(db_session, s.id)
    assert exc.value.status_code == 400
    
    SettlementService.pay_settlement(db_session, s.id, "TXN123") # -> PAID
    
    # PAID -> CANCELLED (fails)
    with pytest.raises(HTTPException) as exc:
        SettlementService.cancel_settlement(db_session, s.id)
    assert exc.value.status_code == 400
