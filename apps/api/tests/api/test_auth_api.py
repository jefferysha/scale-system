"""Auth API 端到端测试。"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from scale_api.core.security import hash_password
from scale_api.main import app
from scale_api.models.user import User


@pytest_asyncio.fixture
async def client(session):
    """覆写 get_session 让 API 用 test session."""
    from scale_api.db.session import get_session

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


@pytest.mark.asyncio
async def test_login_then_me(client, alice):
    r = await client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "s3cret!", "client_kind": "desktop"},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]

    r2 = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200, r2.text
    assert r2.json()["username"] == "alice"


@pytest.mark.asyncio
async def test_login_bad_password(client, alice):
    r = await client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "wrong", "client_kind": "web"},
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "AUTHENTICATION_FAILED"
