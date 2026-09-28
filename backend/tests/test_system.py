import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.anyio
async def test_application_startup_and_health(async_client: AsyncClient):
    # Tests that the application starts up and the health check responds
    response = await async_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "alive"}

@pytest.mark.anyio
async def test_route_registration(async_client: AsyncClient):
    # Verify legacy route unreachability and v1 route tree
    response = await async_client.post("/api/auth/login")
    assert response.status_code == 404
    
    # Check that v1 route exists in the application
    response = await async_client.get("/api/v1/customer/quotations/00000000-0000-0000-0000-000000000000")
    # Will fail auth/401 because we aren't mocking auth here, but it shouldn't be 404 Not Found (unless the route is missing entirely)
    assert response.status_code == 401

@pytest.mark.anyio
async def test_database_connectivity(async_client: AsyncClient):
    # Verify we can connect to the local development mongodb environment via Beanie
    # Beanie initializes with Motor so we can ping the database
    from app.db.database import client
    try:
        await client.admin.command('ping')
        success = True
    except Exception as e:
        success = False
    
    # We assert True. If the local mongodb is down in test CI, this might fail, but it tests connectivity logic.
    assert success
