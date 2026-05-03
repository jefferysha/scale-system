"""Projects API 测试."""
import pytest


@pytest.mark.asyncio
async def test_admin_can_create_and_list(client, admin_token):
    r = await client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "P1", "notes": "首个项目"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["name"] == "P1"

    r2 = await client.get(
        "/api/v1/projects?limit=10",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200
    assert len(r2.json()["items"]) >= 1


@pytest.mark.asyncio
async def test_create_duplicate_name_returns_409(client, admin_token):
    await client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Dup"},
    )
    r = await client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Dup"},
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


@pytest.mark.asyncio
async def test_operator_cannot_create(client, operator_token):
    r = await client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"name": "OpProj"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_cursor_pagination(client, admin_token):
    for i in range(5):
        await client.post(
            "/api/v1/projects",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"name": f"PG-{i}"},
        )
    r = await client.get(
        "/api/v1/projects?limit=2",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    j = r.json()
    assert len(j["items"]) == 2
    assert j["next_cursor"] is not None
    r2 = await client.get(
        f"/api/v1/projects?limit=2&cursor={j['next_cursor']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200
    j2 = r2.json()
    assert len(j2["items"]) <= 2
    ids = {p["id"] for p in j["items"] + j2["items"]}
    assert len(ids) == len(j["items"]) + len(j2["items"])


@pytest.mark.asyncio
async def test_update_and_delete(client, admin_token):
    r = await client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Edit"},
    )
    pid = r.json()["id"]
    r2 = await client.put(
        f"/api/v1/projects/{pid}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"notes": "改一下"},
    )
    assert r2.status_code == 200
    assert r2.json()["notes"] == "改一下"

    r3 = await client.delete(
        f"/api/v1/projects/{pid}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r3.status_code == 204
