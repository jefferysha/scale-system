"""Auth API 端到端测试。"""
import pytest


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
