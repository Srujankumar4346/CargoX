import pytest
from app.core.config import settings
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture(autouse=True)
async def setup_db():
    settings.DATABASE_URL = 'mongodb://localhost:27017/cargox_test'
    from app.db.database import init_db
    await init_db()
    from app.db.database import client
    await client.drop_database('cargox_test')
    await init_db() # re-init after drop just in case

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.mark.anyio
async def test_db_url():
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        response = await client.get('/health')
        assert response.status_code == 200
        from app.models.user import User
        await User.insert(User(email='test@example.com', role='ADMIN', clerk_user_id='123', is_active=True))
        users = await User.find_all().to_list()
        assert len(users) == 1

