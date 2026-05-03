"""WeighingRecord 列表查询构建（多过滤 + JSONB 表达式索引）."""
from datetime import date

from sqlalchemy import Select, func, select

from scale_api.models.record import WeighingRecord


def build_list_query(
    *,
    project_id: int | None = None,
    vertical_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    cup_number: str | None = None,
    q: str | None = None,
) -> Select[tuple[WeighingRecord]]:
    """组装查询语句。按 sample_date desc, id desc 排序。

    cup_number 过滤走 spec §7.6 表达式索引（rec_points_cup_numbers 函数）。
    """
    stmt = select(WeighingRecord).order_by(
        WeighingRecord.sample_date.desc(),
        WeighingRecord.id.desc(),
    )
    if project_id is not None:
        stmt = stmt.where(WeighingRecord.project_id == project_id)
    if vertical_id is not None:
        stmt = stmt.where(WeighingRecord.vertical_id == vertical_id)
    if date_from is not None:
        stmt = stmt.where(WeighingRecord.sample_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(WeighingRecord.sample_date <= date_to)
    if cup_number is not None:
        # rec_points_cup_numbers(points) 返回 text[]，用 @> 数组包含
        stmt = stmt.where(
            func.rec_points_cup_numbers(WeighingRecord.points).op("@>")(
                func.array([cup_number]),
            ),
        )
    if q is not None:
        stmt = stmt.where(WeighingRecord.notes.ilike(f"%{q}%"))
    return stmt
