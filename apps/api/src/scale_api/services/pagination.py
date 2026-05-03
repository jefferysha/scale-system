"""分页 helper：cursor + offset 双模式。"""
import base64
import json
from typing import Any, TypeVar

from sqlalchemy import Select, column, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.schemas.common import CursorPage, OffsetPage

T = TypeVar("T")


def encode_cursor(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True, default=str)
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def decode_cursor(cursor: str) -> dict[str, Any]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(padded.encode()).decode()
        return json.loads(raw)
    except Exception as e:
        raise ValueError(f"invalid cursor: {e}") from e


async def cursor_paginate(
    session: AsyncSession,
    stmt: Select[Any],
    *,
    order_keys: list[str],
    limit: int,
    cursor: str | None,
) -> CursorPage[Any]:
    """简化版：按 (id desc) 单键 cursor。多键场景在 record_query_builder 里特化。"""
    if cursor is not None:
        decoded = decode_cursor(cursor)
        last_id = decoded.get("id")
        if last_id is not None:
            stmt = stmt.where(column(order_keys[0]) < last_id)

    stmt = stmt.limit(limit + 1)
    result = await session.scalars(stmt)
    rows = list(result.all())

    next_cursor: str | None = None
    if len(rows) > limit:
        rows = rows[:limit]
        last = rows[-1]
        next_cursor = encode_cursor({"id": getattr(last, "id")})
    return CursorPage(items=rows, next_cursor=next_cursor)


async def offset_paginate(
    session: AsyncSession,
    stmt: Select[Any],
    *,
    page: int,
    size: int,
) -> OffsetPage[Any]:
    page = max(1, page)
    size = max(1, min(200, size))
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = await session.scalar(count_stmt) or 0

    rows_stmt = stmt.offset((page - 1) * size).limit(size)
    rows = list((await session.scalars(rows_stmt)).all())
    return OffsetPage(items=rows, total=total, page=page, size=size)
