"""杯库 sheet → cups + cup_calibrations."""
from __future__ import annotations

import sys
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from openpyxl.workbook import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.cup import Cup
from scale_api.models.cup_calibration import CupCalibration

from ._helpers import to_date, to_decimal

BATCH = 200


@dataclass(slots=True)
class _PendingCal:
    """缓存一条率定记录的字段，等待 flush 拿到 cup.id 再写入。"""

    cup_number: str
    tare_g: Decimal
    calibrated_at: datetime
    method: str


async def load_cups(
    session: AsyncSession, wb: Workbook, *, dry_run: bool,
) -> tuple[int, int]:
    """读取"杯库" sheet，返回 (成功, 失败) 统计。

    Excel 表头：(杯号, 当前杯重, 最新率定日期, 上次杯重, 上次率定日期)
    注：列名"最新率定日期杯重"实际只存日期；当前杯重在第 2 列。
    幂等：cups.cup_number UNIQUE 去重；已存在视为成功，不再追加 calibration。
    率定记录策略：每个 cup 至少 1 条 current；若有"上次"则再加 1 条 previous。
    批处理：每攒 BATCH 条 cup 就 flush + 同步插 calibration。
    """
    if "杯库" not in wb.sheetnames:
        print("[cups] 未找到 sheet '杯库'，跳过", file=sys.stderr)
        return 0, 0

    ws = wb["杯库"]
    ok = 0
    fail = 0
    pending_cups: list[Cup] = []
    pending_cals: list[_PendingCal] = []

    for row in ws.iter_rows(min_row=2, values_only=True):
        try:
            padded = (list(row) + [None] * 5)[:5]
            number_raw, current_raw, latest_date_raw, prev_raw, prev_date_raw = padded
            if number_raw is None:
                continue
            cup_number = str(number_raw).strip()
            if not cup_number:
                continue

            current_tare = to_decimal(current_raw)
            if current_tare is None:
                fail += 1
                print(
                    f"[cups] 杯号 {cup_number} 无当前杯重，跳过",
                    file=sys.stderr,
                )
                continue

            existing = (
                await session.scalars(
                    select(Cup).where(Cup.cup_number == cup_number)
                )
            ).first()
            if existing:
                ok += 1
                continue

            latest_date = to_date(latest_date_raw)
            prev_tare = to_decimal(prev_raw)
            prev_date = to_date(prev_date_raw)

            cup = Cup(
                cup_number=cup_number,
                current_tare_g=current_tare,
                latest_calibration_date=latest_date,
                is_active=True,
            )
            pending_cups.append(cup)
            ok += 1

            if latest_date is not None:
                pending_cals.append(
                    _PendingCal(
                        cup_number=cup_number,
                        tare_g=current_tare,
                        calibrated_at=datetime.combine(
                            latest_date, datetime.min.time()
                        ),
                        method="import:current",
                    )
                )
            if prev_tare is not None and prev_date is not None:
                pending_cals.append(
                    _PendingCal(
                        cup_number=cup_number,
                        tare_g=prev_tare,
                        calibrated_at=datetime.combine(
                            prev_date, datetime.min.time()
                        ),
                        method="import:previous",
                    )
                )

            if not dry_run and len(pending_cups) >= BATCH:
                await _flush_batch(session, pending_cups, pending_cals)
                pending_cups.clear()
                pending_cals.clear()
        except Exception as e:  # noqa: BLE001
            fail += 1
            print(f"[cups] 失败: {row} → {e}", file=sys.stderr)

    if not dry_run and (pending_cups or pending_cals):
        await _flush_batch(session, pending_cups, pending_cals)

    return ok, fail


async def _flush_batch(
    session: AsyncSession,
    cups: list[Cup],
    cals: list[_PendingCal],
) -> None:
    """先 flush cups 拿 id，再用 number→id 映射建 CupCalibration。"""
    if not cups and not cals:
        return
    session.add_all(cups)
    await session.flush()
    if not cals:
        return
    number_to_id = {c.cup_number: c.id for c in cups}
    cal_objs = [
        CupCalibration(
            cup_id=number_to_id[c.cup_number],
            tare_g=c.tare_g,
            calibrated_at=c.calibrated_at,
            method=c.method,
        )
        for c in cals
        if c.cup_number in number_to_id
    ]
    if cal_objs:
        session.add_all(cal_objs)
        await session.flush()
