"""宽表 sheet → weighing_records（Task 7.3 实现）."""
from __future__ import annotations

from openpyxl.workbook import Workbook
from sqlalchemy.ext.asyncio import AsyncSession


async def load_records(
    session: AsyncSession, wb: Workbook, *, dry_run: bool,
) -> tuple[int, int]:
    """占位实现，下一 Task 完成。"""
    _ = (session, wb, dry_run)
    return 0, 0
