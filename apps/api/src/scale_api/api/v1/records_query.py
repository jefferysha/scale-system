"""Records 查询路由（list / paged / get / export）."""
import csv
import io
from datetime import date

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from scale_api.api.deps import CurrentUser, DBSession
from scale_api.core.exceptions import NotFoundError
from scale_api.repositories.record_query_builder import build_list_query
from scale_api.repositories.record_repo import RecordRepository
from scale_api.schemas.common import CursorPage, OffsetPage
from scale_api.schemas.record import RecordOut
from scale_api.services.pagination import cursor_paginate, offset_paginate

router = APIRouter()


@router.get("/", response_model=CursorPage[RecordOut])
async def list_records(
    _: CurrentUser,
    session: DBSession,
    project_id: int | None = Query(default=None),
    vertical_id: int | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    cup_number: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
) -> CursorPage[RecordOut]:
    stmt = build_list_query(
        project_id=project_id,
        vertical_id=vertical_id,
        date_from=date_from,
        date_to=date_to,
        cup_number=cup_number,
        q=q,
    )
    page = await cursor_paginate(
        session, stmt, order_keys=["id"], limit=limit, cursor=cursor,
    )
    return CursorPage(
        items=[RecordOut.model_validate(r) for r in page.items],
        next_cursor=page.next_cursor,
    )


@router.get("/paged", response_model=OffsetPage[RecordOut])
async def list_records_paged(
    _: CurrentUser,
    session: DBSession,
    project_id: int | None = Query(default=None),
    vertical_id: int | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    cup_number: str | None = Query(default=None),
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=200),
) -> OffsetPage[RecordOut]:
    """offset 分页：返回 total / page / size，前端可显示完整 1 2 3 … N 页码。"""
    stmt = build_list_query(
        project_id=project_id,
        vertical_id=vertical_id,
        date_from=date_from,
        date_to=date_to,
        cup_number=cup_number,
        q=q,
    )
    page_data = await offset_paginate(session, stmt, page=page, size=size)
    return OffsetPage(
        items=[RecordOut.model_validate(r) for r in page_data.items],
        total=page_data.total,
        page=page_data.page,
        size=page_data.size,
    )


@router.get("/export")
async def export_records(
    _: CurrentUser,
    session: DBSession,
    project_id: int | None = Query(default=None),
    vertical_id: int | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
) -> StreamingResponse:
    """CSV 导出（Excel 留 P2）."""
    stmt = build_list_query(
        project_id=project_id,
        vertical_id=vertical_id,
        date_from=date_from,
        date_to=date_to,
    )
    rows = list((await session.scalars(stmt)).all())

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "id",
            "project_id",
            "vertical_id",
            "tide_type",
            "sample_date",
            "volume_ml",
            "computed_avg_concentration",
            "notes",
        ],
    )
    for r in rows:
        writer.writerow(
            [
                r.id,
                r.project_id,
                r.vertical_id,
                r.tide_type or "",
                r.sample_date.isoformat(),
                str(r.volume_ml or ""),
                str(r.computed_avg_concentration or ""),
                r.notes or "",
            ],
        )
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="records.csv"'},
    )


@router.get("/{record_id}", response_model=RecordOut)
async def get_record(
    record_id: int, _: CurrentUser, session: DBSession,
) -> RecordOut:
    r = await RecordRepository(session).get(record_id)
    if r is None:
        raise NotFoundError(f"记录 {record_id} 不存在")
    return RecordOut.model_validate(r)
