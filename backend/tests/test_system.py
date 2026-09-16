import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from sqlalchemy import text

client = TestClient(app)

def test_application_startup_and_health():
    # Tests that the application starts up and the health check responds
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "alive"}

def test_route_registration():
    # Verify legacy route unreachability and v1 route tree
    # Assuming legacy routes like /api/auth/login are gone
    response = client.post("/api/auth/login")
    assert response.status_code == 404
    
    # Check that v1 route exists in the application
    response = client.get("/api/v1/customer/quotations/00000000-0000-0000-0000-000000000000")
    # Will fail auth/401 because we aren't mocking auth here, but it shouldn't be 404 Not Found (unless the route is missing entirely)
    # Wait, if auth fails it might throw 401. Let's check status.
    assert response.status_code == 401

def test_database_connectivity():
    # Verify we can connect to the local development postgres environment
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        success = True
    except Exception as e:
        success = False
    
    # We assert True. If the local postgres is down in test CI, this might fail, but it tests connectivity logic.
    assert success
