"""项目库 sheet → projects 表."""
from __future__ import annotations

import sys

from openpyxl.workbook import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.project import Project

from ._helpers import to_date


async def load_projects(
    session: AsyncSession, wb: Workbook, *, dry_run: bool,
) -> tuple[int, int]:
    """读取"项目库" sheet，返回 (成功, 失败) 统计。

    Excel 表头：(序号, 项目, 建立日期, 备注)
    注：实际表头第 1 列为 None（无"序号"标题），但数据列顺序一致。
    幂等：projects.name UNIQUE 去重。
    """
    if "项目库" not in wb.sheetnames:
        print("[projects] 未找到 sheet '项目库'，跳过", file=sys.stderr)
        return 0, 0

    ws = wb["项目库"]
    ok = 0
    fail = 0

    for row in ws.iter_rows(min_row=2, values_only=True):
        try:
            padded = (list(row) + [None] * 4)[:4]
            _, name_raw, established_raw, notes_raw = padded
            if not name_raw:
                continue
            name = str(name_raw).strip()
            established_date = to_date(established_raw)
            notes = str(notes_raw).strip() if notes_raw else None

            existing = (
                await session.scalars(select(Project).where(Project.name == name))
            ).first()
            if existing:
                ok += 1
                continue

            if not dry_run:
                session.add(
                    Project(
                        name=name,
                        established_date=established_date,
                        notes=notes,
                        is_active=True,
                    )
                )
            ok += 1
        except Exception as e:  # noqa: BLE001
            fail += 1
            print(f"[projects] 失败: {row} → {e}", file=sys.stderr)

    if not dry_run:
        await session.flush()
    return ok, fail
