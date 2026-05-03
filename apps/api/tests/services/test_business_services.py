"""业务 service 直调用单元测试（补充 API 测试不够覆盖的分支）."""
import uuid
from decimal import Decimal

import pytest

from scale_api.core.exceptions import ConflictError, NotFoundError, ValidationError
from scale_api.schemas.cup import CupCalibrationCreate, CupCreate, CupUpdate
from scale_api.schemas.project import ProjectCreate, ProjectUpdate
from scale_api.schemas.record import RecordCreate, RecordPointIn
from scale_api.schemas.scale import (
    ScaleCreate,
    ScaleProbeReport,
    ScaleUpdate,
)
from scale_api.schemas.vertical import VerticalCreate, VerticalUpdate
from scale_api.services.cup_service import CupService
from scale_api.services.project_service import ProjectService
from scale_api.services.record_batch_processor import process_batch
from scale_api.services.record_service import RecordService
from scale_api.services.scale_service import ScaleService
from scale_api.services.vertical_service import VerticalService


@pytest.mark.asyncio
async def test_project_service_full_lifecycle(session) -> None:
    svc = ProjectService(session)
    p = await svc.create(ProjectCreate(name="P-svc"), actor_id=None)
    assert p.id > 0
    p2 = await svc.update(
        p.id, ProjectUpdate(notes="改了", is_active=False), actor_id=None,
    )
    assert p2.notes == "改了"
    assert p2.is_active is False
    await svc.soft_delete(p.id, actor_id=None)
    page = await svc.list_paged(q="P-svc", is_active=False, limit=10, cursor=None)
    assert len(page.items) >= 1


@pytest.mark.asyncio
async def test_project_update_not_found(session) -> None:
    with pytest.raises(NotFoundError):
        await ProjectService(session).update(99999, ProjectUpdate(), actor_id=None)


@pytest.mark.asyncio
async def test_project_update_name_conflict(session) -> None:
    svc = ProjectService(session)
    a = await svc.create(ProjectCreate(name="A"), actor_id=None)
    await svc.create(ProjectCreate(name="B"), actor_id=None)
    with pytest.raises(ConflictError):
        await svc.update(a.id, ProjectUpdate(name="B"), actor_id=None)


@pytest.mark.asyncio
async def test_vertical_service_lifecycle_and_delete_with_records(session) -> None:
    proj = await ProjectService(session).create(ProjectCreate(name="P-V"), actor_id=None)
    vsvc = VerticalService(session)
    v = await vsvc.create(proj.id, VerticalCreate(code="V1"), actor_id=None)
    assert v.id > 0
    v2 = await vsvc.update(v.id, VerticalUpdate(label="新", sort_order=5), actor_id=None)
    assert v2.label == "新"
    items = await vsvc.list_by_project(proj.id)
    assert len(items) == 1
    await vsvc.delete(v.id, actor_id=None)


@pytest.mark.asyncio
async def test_vertical_delete_blocked_when_records_exist(session) -> None:
    proj = await ProjectService(session).create(
        ProjectCreate(name="P-VB"), actor_id=None,
    )
    vsvc = VerticalService(session)
    v = await vsvc.create(proj.id, VerticalCreate(code="V1"), actor_id=None)
    # 给该 vertical 建一条 record
    rec_body = RecordCreate(
        client_uid=uuid.uuid4(),
        project_id=proj.id,
        vertical_id=v.id,
        sample_date="2026-05-04",
        volume_ml=Decimal("1000"),
        points=[
            RecordPointIn(
                pos="0.0",
                cup_id=1,
                cup_number="C1",
                cup_tare_g=Decimal("50"),
                wet_weight_g=Decimal("51"),
            ),
        ],
    )
    await RecordService(session).create(rec_body, operator_id=None, source="test")

    with pytest.raises(ConflictError):
        await vsvc.delete(v.id, actor_id=None)


@pytest.mark.asyncio
async def test_vertical_create_duplicate_code_conflict(session) -> None:
    proj = await ProjectService(session).create(
        ProjectCreate(name="P-Dup"), actor_id=None,
    )
    vsvc = VerticalService(session)
    await vsvc.create(proj.id, VerticalCreate(code="V1"), actor_id=None)
    with pytest.raises(ConflictError):
        await vsvc.create(proj.id, VerticalCreate(code="V1"), actor_id=None)


@pytest.mark.asyncio
async def test_scale_service_lifecycle(session) -> None:
    svc = ScaleService(session)
    s = await svc.create(ScaleCreate(name="S-svc"), actor_id=None)
    s2 = await svc.update(
        s.id, ScaleUpdate(baud_rate=19200, notes="ok"), actor_id=None,
    )
    assert s2.baud_rate == 19200
    items = await svc.list_all()
    assert any(x.id == s.id for x in items)
    res = await svc.validate_config(s.id)
    assert res.ok is True
    await svc.record_probe(
        s.id, ScaleProbeReport(ok=False, samples_count=0, error="超时"), actor_id=None,
    )
    await svc.soft_delete(s.id, actor_id=None)


@pytest.mark.asyncio
async def test_scale_validate_protocol_violation_raises(session) -> None:
    svc = ScaleService(session)
    with pytest.raises(ValidationError):
        await svc.create(
            ScaleCreate(name="BadSart", protocol_type="sartorius", data_bits=8),
            actor_id=None,
        )


@pytest.mark.asyncio
async def test_cup_service_full_flow(session) -> None:
    svc = CupService(session)
    c = await svc.create(
        CupCreate(cup_number="UC-1", current_tare_g=Decimal("50")),
        actor_id=None,
    )
    c2 = await svc.update(
        c.id, CupUpdate(notes="备注", is_active=True), actor_id=None,
    )
    assert c2.notes == "备注"
    cal = await svc.calibrate(
        c.id,
        CupCalibrationCreate(tare_g=Decimal("50.55"), method="电子天平"),
        actor_id=None,
    )
    assert cal.tare_g == Decimal("50.55")
    items = await svc.list_calibrations(c.id)
    assert len(items) == 1
    page = await svc.list_paged(q="UC", is_active=True, page=1, size=10)
    assert page.total >= 1
    await svc.soft_delete(c.id, actor_id=None)


@pytest.mark.asyncio
async def test_cup_create_duplicate_conflict(session) -> None:
    svc = CupService(session)
    await svc.create(
        CupCreate(cup_number="DUP", current_tare_g=Decimal("50")), actor_id=None,
    )
    with pytest.raises(ConflictError):
        await svc.create(
            CupCreate(cup_number="DUP", current_tare_g=Decimal("51")),
            actor_id=None,
        )


@pytest.mark.asyncio
async def test_record_service_update_and_delete(session) -> None:
    proj = await ProjectService(session).create(
        ProjectCreate(name="P-RecSvc"), actor_id=None,
    )
    v = await VerticalService(session).create(
        proj.id, VerticalCreate(code="V1"), actor_id=None,
    )
    rsvc = RecordService(session)
    r = await rsvc.create(
        RecordCreate(
            client_uid=uuid.uuid4(),
            project_id=proj.id,
            vertical_id=v.id,
            sample_date="2026-05-04",
            volume_ml=Decimal("1000"),
            points=[
                RecordPointIn(
                    pos="0.0",
                    cup_id=1,
                    cup_number="C1",
                    cup_tare_g=Decimal("50"),
                    wet_weight_g=Decimal("51"),
                ),
            ],
        ),
        operator_id=None,
        source="test",
    )
    from scale_api.schemas.record import RecordUpdate

    r2 = await rsvc.update(
        r.id, RecordUpdate(notes="改注释"), actor_id=None,
    )
    assert r2.notes == "改注释"
    await rsvc.delete(r.id, actor_id=None)


@pytest.mark.asyncio
async def test_record_service_update_not_found(session) -> None:
    from scale_api.schemas.record import RecordUpdate

    with pytest.raises(NotFoundError):
        await RecordService(session).update(99999, RecordUpdate(), actor_id=None)


@pytest.mark.asyncio
async def test_batch_processor_mixed(session) -> None:
    proj = await ProjectService(session).create(
        ProjectCreate(name="P-Batch"), actor_id=None,
    )
    v = await VerticalService(session).create(
        proj.id, VerticalCreate(code="V1"), actor_id=None,
    )

    def _mk(client_uid: uuid.UUID, *, bad: bool = False) -> RecordCreate:
        pos = "0.5" if bad else "0.0"
        return RecordCreate(
            client_uid=client_uid,
            project_id=proj.id,
            vertical_id=v.id,
            sample_date="2026-05-04",
            volume_ml=Decimal("1000"),
            points=[
                RecordPointIn(
                    pos=pos,
                    cup_id=1,
                    cup_number="C1",
                    cup_tare_g=Decimal("50"),
                    wet_weight_g=Decimal("51"),
                ),
            ],
        )

    existing = uuid.uuid4()
    await RecordService(session).create(_mk(existing), operator_id=None, source="test")

    new_uid = uuid.uuid4()
    bad_uid = uuid.uuid4()
    results = await process_batch(
        session,
        [_mk(new_uid), _mk(existing), _mk(bad_uid, bad=True)],
        operator_id=None,
        source="batch",
    )
    statuses = sorted(r.status for r in results)
    assert statuses == ["created", "duplicate", "invalid"]
