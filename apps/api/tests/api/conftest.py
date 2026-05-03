"""tests/api 公共 fixtures：HTTP client + 默认 admin alice。"""
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from scale_api.core.security import hash_password
from scale_api.db.session import get_session
from scale_api.main import app
from scale_api.models.user import User


@pytest_asyncio.fixture
async def client(session):
    """覆写 get_session，让 API 用测试 session。"""

    async def _override():
        yield session

    app.dependency_overrides[get_session] = _override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def alice(session):
    u = User(username="alice", password_hash=hash_password("s3cret!"), role="admin")
    session.add(u)
    await session.commit()
    return u
