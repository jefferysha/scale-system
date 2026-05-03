"""Records API 端到端测试（≥ 8 用例）."""
import uuid

import pytest


async def _setup_proj_vert(client, token) -> tuple[int, int]:
    pr = await client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "P-Rec"},
    )
    pid = pr.json()["id"]
    vr = await client.post(
        f"/api/v1/projects/{pid}/verticals",
        headers={"Authorization": f"Bearer {token}"},
        json={"code": "V1"},
    )
    vid = vr.json()["id"]
    return pid, vid


def _make_payload(pid: int, vid: int, *, client_uid: str | None = None) -> dict:
    return {
        "client_uid": client_uid or str(uuid.uuid4()),
        "project_id": pid,
        "vertical_id": vid,
        "tide_type": "大潮",
        "sample_date": "2026-05-04",
        "volume_ml": "1000",
        "points": [
            {
                "pos": "0.0",
                "cup_id": 325,
                "cup_number": "325",
                "cup_tare_g": "50.6112",
                "wet_weight_g": "51.1221",
            },
            {
                "pos": "0.6",
                "cup_id": 326,
                "cup_number": "326",
                "cup_tare_g": "50.5",
                "wet_weight_g": "50.8",
            },
        ],
    }


@pytest.mark.asyncio
async def test_post_creates_record_with_avg(client, admin_token):
    pid, vid = await _setup_proj_vert(client, admin_token)
    r = await client.post(
        "/api/v1/records/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=_make_payload(pid, vid),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["computed_avg_concentration"] is not None
    # 平均 = (0.5109 + 0.3) / 2 = 0.40545
    assert body["computed_avg_concentration"].startswith("0.40")


@pytest.mark.asyncio
async def test_duplicate_client_uid_returns_same_record(client, admin_token):
    pid, vid = await _setup_proj_vert(client, admin_token)
    cuid = str(uuid.uuid4())
    r1 = await client.post(
        "/api/v1/records/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=_make_payload(pid, vid, client_uid=cuid),
    )
    assert r1.status_code == 201
    rid = r1.json()["id"]

    r2 = await client.post(
        "/api/v1/records/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=_make_payload(pid, vid, client_uid=cuid),
    )
    assert r2.status_code == 201
    assert r2.json()["id"] == rid


@pytest.mark.asyncio
async def test_missing_volume_returns_422(client, admin_token):
    pid, vid = await _setup_proj_vert(client, admin_token)
    payload = _make_payload(pid, vid)
    payload.pop("volume_ml")
    r = await client.post(
        "/api/v1/records/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=payload,
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_invalid_pos_returns_422(client, admin_token):
    pid, vid = await _setup_proj_vert(client, admin_token)
    payload = _make_payload(pid, vid)
    payload["points"][0]["pos"] = "0.5"
    r = await client.post(
        "/api/v1/records/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=payload,
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_list_filter_by_project(client, admin_token):
    p1, v1 = await _setup_proj_vert(client, admin_token)
    # 创建第二个 project
    pr2 = await client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "P-Other"},
    )
    p2 = pr2.json()["id"]
    vr2 = await client.post(
        f"/api/v1/projects/{p2}/verticals",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"code": "V1"},
    )
    v2 = vr2.json()["id"]
    await client.post(
        "/api/v1/records/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=_make_payload(p1, v1),
    )
    await client.post(
        "/api/v1/records/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=_make_payload(p2, v2),
    )
    r = await client.get(
        f"/api/v1/records/?project_id={p1}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["project_id"] == p1


@pytest.mark.asyncio
async def test_cursor_pagination(client, admin_token):
    pid, vid = await _setup_proj_vert(client, admin_token)
    for _ in range(4):
        await client.post(
            "/api/v1/records/",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=_make_payload(pid, vid),
        )
    r1 = await client.get(
        "/api/v1/records/?limit=2",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    j1 = r1.json()
    assert len(j1["items"]) == 2
    assert j1["next_cursor"] is not None
    r2 = await client.get(
        f"/api/v1/records/?limit=2&cursor={j1['next_cursor']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    j2 = r2.json()
    ids = {r["id"] for r in j1["items"] + j2["items"]}
    assert len(ids) == len(j1["items"]) + len(j2["items"])


@pytest.mark.asyncio
async def test_batch_with_mixed_results(client, admin_token):
    pid, vid = await _setup_proj_vert(client, admin_token)
    cuid = str(uuid.uuid4())
    # 先放一条已存在
    await client.post(
        "/api/v1/records/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=_make_payload(pid, vid, client_uid=cuid),
    )
    new_cuid = str(uuid.uuid4())
    bad_cuid = str(uuid.uuid4())
    bad = _make_payload(pid, vid, client_uid=bad_cuid)
    bad["points"][0]["pos"] = "0.5"  # 非法点位 → invalid

    r = await client.post(
        "/api/v1/records/batch",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "records": [
                _make_payload(pid, vid, client_uid=new_cuid),
                _make_payload(pid, vid, client_uid=cuid),
                bad,
            ],
        },
    )
    assert r.status_code == 200, r.text
    statuses = [item["status"] for item in r.json()["results"]]
    assert "created" in statuses
    assert "duplicate" in statuses
    assert "invalid" in statuses


@pytest.mark.asyncio
async def test_operator_cannot_delete(client, admin_token, operator_token):
    pid, vid = await _setup_proj_vert(client, admin_token)
    rc = await client.post(
        "/api/v1/records/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=_make_payload(pid, vid),
    )
    rid = rc.json()["id"]
    r = await client.delete(
        f"/api/v1/records/{rid}",
        headers={"Authorization": f"Bearer {operator_token}"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_export_csv(client, admin_token):
    pid, vid = await _setup_proj_vert(client, admin_token)
    await client.post(
        "/api/v1/records/",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=_make_payload(pid, vid),
    )
    r = await client.get(
        "/api/v1/records/export",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    text = r.text
    assert "id,project_id" in text
