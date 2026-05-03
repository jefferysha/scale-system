"""Verticals API 测试."""
import pytest


async def _make_project(client, token, name="P-Vert"):
    r = await client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": name},
    )
    return r.json()["id"]


@pytest.mark.asyncio
async def test_list_empty(client, admin_token):
    pid = await _make_project(client, admin_token)
    r = await client.get(
        f"/api/v1/projects/{pid}/verticals",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_create_then_list(client, admin_token):
    pid = await _make_project(client, admin_token)
    r = await client.post(
        f"/api/v1/projects/{pid}/verticals",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": "V1", "label": "近岸", "sort_order": 1},
    )
    assert r.status_code == 201, r.text
    r2 = await client.get(
        f"/api/v1/projects/{pid}/verticals",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert len(r2.json()) == 1
    assert r2.json()[0]["code"] == "V1"


@pytest.mark.asyncio
async def test_duplicate_code_in_same_project_409(client, admin_token):
    pid = await _make_project(client, admin_token)
    await client.post(
        f"/api/v1/projects/{pid}/verticals",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": "V1"},
    )
    r = await client.post(
        f"/api/v1/projects/{pid}/verticals",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": "V1"},
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_same_code_across_projects_ok(client, admin_token):
    p1 = await _make_project(client, admin_token, "P-A")
    p2 = await _make_project(client, admin_token, "P-B")
    r1 = await client.post(
        f"/api/v1/projects/{p1}/verticals",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": "V1"},
    )
    r2 = await client.post(
        f"/api/v1/projects/{p2}/verticals",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": "V1"},
    )
    assert r1.status_code == 201
    assert r2.status_code == 201


@pytest.mark.asyncio
async def test_update_and_delete(client, admin_token):
    pid = await _make_project(client, admin_token)
    r = await client.post(
        f"/api/v1/projects/{pid}/verticals",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": "VX"},
    )
    vid = r.json()["id"]
    r2 = await client.put(
        f"/api/v1/verticals/{vid}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"label": "新标签"},
    )
    assert r2.status_code == 200
    assert r2.json()["label"] == "新标签"
    r3 = await client.delete(
        f"/api/v1/verticals/{vid}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r3.status_code == 204


@pytest.mark.asyncio
async def test_operator_cannot_create(client, admin_token, operator_token):
    pid = await _make_project(client, admin_token)
    r = await client.post(
        f"/api/v1/projects/{pid}/verticals",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"code": "V1"},
    )
    assert r.status_code == 403
