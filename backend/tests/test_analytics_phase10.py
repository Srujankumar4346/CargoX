import pytest
import uuid
from decimal import Decimal
from app.models.enums import DeliveryRequestStatus, UserRole, CompanyStatus
from app.models.user import User
from app.api.deps import get_current_admin, get_current_customer_user, get_current_driver
from app.main import app
from datetime import datetime, timedelta, timezone

@pytest.mark.anyio
async def test_analytics_operating_profit(async_client):
    # 0. Setup admin user
    admin_user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"user_admin_{uuid.uuid4().hex[:8]}",
        email=f"admin_{uuid.uuid4().hex[:8]}@cargox.com",
        role=UserRole.ADMIN,
        is_active=True
    )
    await admin_user.insert()
    
    app.dependency_overrides[get_current_admin] = lambda: admin_user

    try:
        # 1. Create a vehicle and maintenance record
        v_resp = await async_client.post("/api/v1/admin/vehicles", json={
            "registration_number": f"MH01-{uuid.uuid4().hex[:4]}",
            "type": "CONTAINER",
            "capacity_tons": 10.0
        })
        assert v_resp.status_code == 201
        vehicle_id = v_resp.json()["id"]

        sched_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        m_resp = await async_client.post(f"/api/v1/admin/vehicles/{vehicle_id}/maintenance", json={
            "maintenance_type": "ROUTINE",
            "scheduled_date": sched_date,
            "description": "Oil change"
        })
        assert m_resp.status_code == 200
        maintenance_id = m_resp.json()["id"]

        s_resp = await async_client.post(f"/api/v1/admin/maintenance/{maintenance_id}/start")
        assert s_resp.status_code == 200
        
        # Check baseline analytics
        dash1 = await async_client.get("/api/v1/admin/analytics/dashboard")
        assert dash1.status_code == 200
        assert float(dash1.json()["total_operating_expenses"]) == 0.0

        # Complete maintenance
        c_resp = await async_client.post(f"/api/v1/admin/maintenance/{maintenance_id}/complete", json={
            "cost": "1500.00",
            "mechanic_notes": "All good"
        })
        assert c_resp.status_code == 200

        # Check analytics after maintenance cost
        dash2 = await async_client.get("/api/v1/admin/analytics/dashboard")
        assert dash2.status_code == 200
        assert float(dash2.json()["total_operating_expenses"]) == 1500.0
        
        # Operating profit should be Total Collected - Total Operating Expenses
        # Here Total Collected is 0, so Operating Profit is -1500
        assert float(dash2.json()["operating_profit"]) == -1500.0
    finally:
        app.dependency_overrides.pop(get_current_admin, None)
