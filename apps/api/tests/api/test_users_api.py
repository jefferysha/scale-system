"""Users API 测试。"""
import pytest


@pytest.mark.asyncio
async def test_admin_can_create_user(client, alice):
    # alice 是 admin（fixture）
    login = await client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "s3cret!", "client_kind": "desktop"},
    )
    token = login.json()["access_token"]

    r = await client.post(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {token}"},
        json={"username": "bob", "password": "abcdefgh", "role": "operator"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["username"] == "bob"
    assert r.json()["role"] == "operator"


@pytest.mark.asyncio
async def test_operator_cannot_create_user(client, session):
    from scale_api.core.security import hash_password
    from scale_api.models.user import User

    op = User(username="oper", password_hash=hash_password("12345678"), role="operator")
    session.add(op)
    await session.commit()
    login = await client.post(
        "/api/v1/auth/login",
        json={"username": "oper", "password": "12345678", "client_kind": "desktop"},
    )
    token = login.json()["access_token"]
    r = await client.post(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {token}"},
        json={"username": "x", "password": "abcdefgh", "role": "operator"},
    )
    assert r.status_code == 403
