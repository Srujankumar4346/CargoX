import pytest
from app.core.config import settings
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.anyio
async def test_db_url():
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        response = await client.get('/health')
        assert response.status_code == 200
        from app.models.user import User
        await User.insert(User(email='test@example.com', role='ADMIN', clerk_user_id='123', is_active=True))
        users = await User.find_all().to_list()
        assert len(users) == 1

