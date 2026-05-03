"""Cups API 测试."""
import pytest


@pytest.mark.asyncio
async def test_create_and_search(client, admin_token):
    for n in ["325", "326", "401"]:
        r = await client.post(
            "/api/v1/cups",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"cup_number": n, "current_tare_g": "50.6112"},
        )
        assert r.status_code == 201, r.text
    r = await client.get(
        "/api/v1/cups?q=32",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    nums = {c["cup_number"] for c in r.json()["items"]}
    assert "325" in nums
    assert "326" in nums
    assert "401" not in nums


@pytest.mark.asyncio
async def test_duplicate_number_409(client, admin_token):
    await client.post(
        "/api/v1/cups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"cup_number": "Dup", "current_tare_g": "50"},
    )
    r = await client.post(
        "/api/v1/cups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"cup_number": "Dup", "current_tare_g": "51"},
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_calibrate_updates_current_tare_and_history(client, admin_token):
    r = await client.post(
        "/api/v1/cups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"cup_number": "C-cal", "current_tare_g": "50.0000"},
    )
    cid = r.json()["id"]
    rc = await client.post(
        f"/api/v1/cups/{cid}/calibrate",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"tare_g": "50.6112", "method": "天平称重"},
    )
    assert rc.status_code == 201
    rg = await client.get(
        f"/api/v1/cups/{cid}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert rg.json()["current_tare_g"] == "50.6112"
    rh = await client.get(
        f"/api/v1/cups/{cid}/calibrations",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert rh.status_code == 200
    assert len(rh.json()) == 1
    assert rh.json()[0]["tare_g"] == "50.6112"


@pytest.mark.asyncio
async def test_soft_delete(client, admin_token):
    r = await client.post(
        "/api/v1/cups",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"cup_number": "C-del", "current_tare_g": "50"},
    )
    cid = r.json()["id"]
    rd = await client.delete(
        f"/api/v1/cups/{cid}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert rd.status_code == 204
    rg = await client.get(
        f"/api/v1/cups/{cid}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert rg.json()["is_active"] is False


@pytest.mark.asyncio
async def test_operator_cannot_create(client, operator_token):
    r = await client.post(
        "/api/v1/cups",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"cup_number": "X", "current_tare_g": "50"},
    )
    assert r.status_code == 403
