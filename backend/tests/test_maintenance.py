import pytest
import uuid
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient

from app.models.enums import DeliveryRequestStatus, UserRole, CompanyStatus, MaintenanceType, MaintenanceStatus
from app.models.user import User
from app.api.deps import get_current_admin
from app.main import app

@pytest.fixture(autouse=True)
def cleanup_database():
    yield
    app.dependency_overrides.clear()

@pytest.fixture
async def admin_user():
    user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_admin_{uuid.uuid4().hex[:8]}",
        email=f"admin_{uuid.uuid4().hex[:8]}@cargox.com",
        role=UserRole.ADMIN,
        is_active=True
    )
    await user.insert()
    return user

@pytest.mark.anyio
async def test_maintenance_lifecycle(async_client: AsyncClient, admin_user):
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    v_resp = await async_client.post("/api/v1/admin/vehicles", json={
        "registration_number": f"MH01-{uuid.uuid4().hex[:4]}",
        "type": "CONTAINER",
        "capacity_tons": 10.0
    })
    assert v_resp.status_code == 201
    vehicle_id = v_resp.json()["id"]
    
    # 1. Schedule Maintenance
    sched_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    m_resp = await async_client.post(f"/api/v1/admin/vehicles/{vehicle_id}/maintenance", json={
        "maintenance_type": "ROUTINE",
        "scheduled_date": sched_date,
        "description": "Oil change"
    })
    assert m_resp.status_code == 200
    maintenance_id = m_resp.json()["id"]
    assert m_resp.json()["status"] == "SCHEDULED"

    # Cannot schedule another active maintenance
    m2_resp = await async_client.post(f"/api/v1/admin/vehicles/{vehicle_id}/maintenance", json={
        "maintenance_type": "REPAIR",
        "scheduled_date": sched_date
    })
    assert m2_resp.status_code == 409
    
    # 2. Start Maintenance
    s_resp = await async_client.post(f"/api/v1/admin/maintenance/{maintenance_id}/start")
    assert s_resp.status_code == 200
    assert s_resp.json()["status"] == "IN_PROGRESS"
    
    # Vehicle status should be MAINTENANCE
    v_info = await async_client.get(f"/api/v1/admin/vehicles/{vehicle_id}")
    assert v_info.json()["status"] == "MAINTENANCE"
    
    # 3. Complete Maintenance
    c_resp = await async_client.post(f"/api/v1/admin/maintenance/{maintenance_id}/complete", json={
        "cost": "1500.00",
        "mechanic_notes": "All good"
    })
    assert c_resp.status_code == 200
    assert c_resp.json()["status"] == "COMPLETED"
    assert c_resp.json()["cost"] == "1500.00"
    
    # Vehicle status should be AVAILABLE
    v_info2 = await async_client.get(f"/api/v1/admin/vehicles/{vehicle_id}")
    assert v_info2.json()["status"] == "AVAILABLE"
