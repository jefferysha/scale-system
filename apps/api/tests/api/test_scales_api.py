"""Scales API 测试."""
import pytest


@pytest.mark.asyncio
async def test_create_and_list(client, admin_token):
    r = await client.post(
        "/api/v1/scales",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "S1"},
    )
    assert r.status_code == 201, r.text
    sid = r.json()["id"]

    r2 = await client.get(
        "/api/v1/scales",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200
    assert any(s["id"] == sid for s in r2.json())


@pytest.mark.asyncio
async def test_create_invalid_protocol_combo_422(client, admin_token):
    r = await client.post(
        "/api/v1/scales",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "BadMettler", "protocol_type": "mettler", "stop_bits": 2},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_validate_endpoint_returns_warnings(client, admin_token):
    r = await client.post(
        "/api/v1/scales",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "G1", "protocol_type": "generic"},
    )
    sid = r.json()["id"]
    rv = await client.post(
        f"/api/v1/scales/{sid}/validate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert rv.status_code == 200
    body = rv.json()
    assert body["ok"] is True
    assert any("generic" in w for w in body["warnings"])


@pytest.mark.asyncio
async def test_probe_result_records_audit(client, admin_token):
    r = await client.post(
        "/api/v1/scales",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "ProbeS"},
    )
    sid = r.json()["id"]
    rp = await client.post(
        f"/api/v1/scales/{sid}/probe-result",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"ok": True, "samples_count": 3},
    )
    assert rp.status_code == 200
    assert rp.json()["recorded"] is True


@pytest.mark.asyncio
async def test_operator_cannot_create(client, operator_token):
    r = await client.post(
        "/api/v1/scales",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"name": "OpS"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_update_and_delete(client, admin_token):
    r = await client.post(
        "/api/v1/scales",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "S-Edit"},
    )
    sid = r.json()["id"]
    r2 = await client.put(
        f"/api/v1/scales/{sid}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"baud_rate": 19200},
    )
    assert r2.status_code == 200
    assert r2.json()["baud_rate"] == 19200

    r3 = await client.delete(
        f"/api/v1/scales/{sid}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r3.status_code == 204
