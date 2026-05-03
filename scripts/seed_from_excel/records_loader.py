"""宽表 sheet → weighing_records（JSONB points）.

兼容性：
- bh1/bs1 是 bh10/bs10 的 typo（S徐六泾断面 sheet 用 bh1/bs1，S浙江 用 bh10/bs10）
- 旧 sheet 没"容积"列时默认 1000 mL
- verticals 主表行不存在时自动 INSERT
- 杯号在杯库里找不到 → 该点位跳过（带 stderr 提示）

幂等：用 uuid5(NAMESPACE_URL, "scale://import/{project_id}/{vertical_id}/{date}/{start_time}")
稳定生成 client_uid，重跑同一份 Excel 保持一致。
"""
from __future__ import annotations

import sys
import uuid
from datetime import date as date_t
from datetime import datetime
from decimal import Decimal
from typing import Any

from openpyxl.workbook import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.cup import Cup
from scale_api.models.project import Project
from scale_api.models.record import WeighingRecord
from scale_api.models.vertical import Vertical

from ._helpers import safe_str, to_date, to_datetime, to_decimal

PROJECT_SHEETS: list[str] = ["S徐六泾断面200712", "S浙江201611"]

# 6 个点位：标签 → 表头列名候选（兼容 typo）
POINTS: list[tuple[str, list[str], list[str], list[str]]] = [
    ("0.0", ["c0"], ["bh0"], ["bs0"]),
    ("0.2", ["c2"], ["bh2"], ["bs2"]),
    ("0.4", ["c4"], ["bh4"], ["bs4"]),
    ("0.6", ["c6"], ["bh6"], ["bs6"]),
    ("0.8", ["c8"], ["bh8"], ["bs8"]),
    ("1.0", ["c10"], ["bh10", "bh1"], ["bs10", "bs1"]),
]

DEFAULT_VOLUME_ML = Decimal("1000")
NAMESPACE = uuid.NAMESPACE_URL


async def load_records(
    session: AsyncSession, wb: Workbook, *, dry_run: bool,
) -> tuple[int, int]:
    """读取项目 sheet（宽表），生成 weighing_records，返回 (成功, 失败)."""
    ok = 0
    fail = 0

    cup_index = await _build_cup_index(session)
    project_index = await _build_project_index(session)
    vertical_cache: dict[tuple[int, str], Vertical] = {}

    for sheet_name in PROJECT_SHEETS:
        if sheet_name not in wb.sheetnames:
            continue

        project = await _ensure_project(session, project_index, sheet_name, dry_run)
        if project is None:
            # dry-run 且项目库未建出 project → 该 sheet 不处理
            print(
                f"[records:{sheet_name}] 项目 {sheet_name} 不存在（dry-run 且未建），跳过",
                file=sys.stderr,
            )
            continue

        ws = wb[sheet_name]
        rows_iter = ws.iter_rows(values_only=True)
        try:
            header_row = next(rows_iter)
        except StopIteration:
            continue
        col = {str(h).strip(): i for i, h in enumerate(header_row) if h is not None}

        for row in rows_iter:
            try:
                row_ok = await _process_record_row(
                    session=session,
                    sheet_name=sheet_name,
                    row=row,
                    col=col,
                    project=project,
                    cup_index=cup_index,
                    vertical_cache=vertical_cache,
                    dry_run=dry_run,
                )
                if row_ok is None:
                    continue  # 整行被跳过（无垂线号 / 无有效点位）
                if row_ok:
                    ok += 1
                else:
                    fail += 1
            except Exception as e:  # noqa: BLE001
                fail += 1
                print(f"[records:{sheet_name}] 失败 {row} → {e}", file=sys.stderr)

    if not dry_run:
        await session.flush()
    return ok, fail


async def _ensure_project(
    session: AsyncSession,
    project_index: dict[str, Project],
    sheet_name: str,
    dry_run: bool,
) -> Project | None:
    """sheet 名即项目名；缺失时尝试建出（dry-run 不建）."""
    project = project_index.get(sheet_name)
    if project is not None:
        return project
    if dry_run:
        return None
    project = Project(name=sheet_name, is_active=True)
    session.add(project)
    await session.flush()
    project_index[sheet_name] = project
    return project


async def _process_record_row(
    *,
    session: AsyncSession,
    sheet_name: str,
    row: tuple[Any, ...],
    col: dict[str, int],
    project: Project,
    cup_index: dict[str, Cup],
    vertical_cache: dict[tuple[int, str], Vertical],
    dry_run: bool,
) -> bool | None:
    """处理单行宽表 → 1 条 weighing_record；返回 True/False/None。

    None 表示该行被静默跳过（无垂线号或无有效点位），不计成功也不计失败。
    """
    vline_code = safe_str(_pick(row, col, ["垂线号"]))
    if not vline_code:
        return None

    points = _build_points(row, col, cup_index, sheet_name)
    if not points:
        print(
            f"[records:{sheet_name}] 垂线 {vline_code} 无有效点位，跳过",
            file=sys.stderr,
        )
        return False

    tide_type = safe_str(_pick(row, col, ["潮型"])) or None
    raw_date = _pick(row, col, ["日期"])
    sample_date = to_date(raw_date) or date_t(2000, 1, 1)
    water_depth = to_decimal(_pick(row, col, ["水深"]))
    start_raw = _pick(row, col, ["开始时间"])
    end_raw = _pick(row, col, ["结束时间"])
    # 旧 sheet 开始/结束时间多为空；用"日期"列里的 datetime 当 start_time 兜底
    start_time = to_datetime(start_raw) or to_datetime(raw_date)
    end_time = to_datetime(end_raw)
    volume_ml = to_decimal(_pick(row, col, ["容积"])) or DEFAULT_VOLUME_ML

    vertical = await _get_or_create_vertical(
        session=session,
        cache=vertical_cache,
        project_id=project.id,
        code=vline_code,
        dry_run=dry_run,
    )
    if vertical is None:
        # dry-run 且 vertical 不存在 → 仍计成功（模拟会建出来）
        if dry_run:
            return True
        return False

    stable_uid = uuid.uuid5(
        NAMESPACE,
        f"scale://import/{project.id}/{vertical.id}/{sample_date}/{start_time}",
    )
    existing = (
        await session.scalars(
            select(WeighingRecord).where(WeighingRecord.client_uid == stable_uid)
        )
    ).first()
    if existing:
        return True

    if not dry_run:
        session.add(
            WeighingRecord(
                client_uid=stable_uid,
                project_id=project.id,
                vertical_id=vertical.id,
                tide_type=tide_type,
                sample_date=sample_date,
                water_depth_m=water_depth,
                start_time=start_time,
                end_time=end_time,
                volume_ml=volume_ml,
                points=points,
                source="import",
            )
        )
    return True


def _build_points(
    row: tuple[Any, ...],
    col: dict[str, int],
    cup_index: dict[str, Cup],
    sheet_name: str,
) -> list[dict[str, str]]:
    """从一行宽表构建 points list；缺失点位静默跳过（不报错）."""
    points: list[dict[str, str]] = []
    for pos, c_keys, bh_keys, bs_keys in POINTS:
        cup_no = _pick(row, col, bh_keys)
        wet = _pick(row, col, bs_keys)
        conc = _pick(row, col, c_keys)
        if cup_no is None or wet is None:
            continue
        cup_str = _normalize_cup_number(cup_no)
        cup_obj = cup_index.get(cup_str)
        if cup_obj is None:
            print(
                f"[records:{sheet_name}] 杯号 {cup_str} 不在杯库，跳过该点位",
                file=sys.stderr,
            )
            continue
        wet_dec = to_decimal(wet) or Decimal("0")
        conc_dec = to_decimal(conc) or Decimal("0")
        points.append(
            {
                "pos": pos,
                "cup_id": str(cup_obj.id),
                "cup_number": cup_obj.cup_number,
                "cup_tare_g": str(cup_obj.current_tare_g),
                "wet_weight_g": str(wet_dec),
                "concentration_mg_l": str(conc_dec),
            }
        )
    return points


async def _get_or_create_vertical(
    *,
    session: AsyncSession,
    cache: dict[tuple[int, str], Vertical],
    project_id: int,
    code: str,
    dry_run: bool,
) -> Vertical | None:
    key = (project_id, code)
    if key in cache:
        return cache[key]
    vertical = (
        await session.scalars(
            select(Vertical).where(
                Vertical.project_id == project_id, Vertical.code == code
            )
        )
    ).first()
    if vertical is not None:
        cache[key] = vertical
        return vertical
    if dry_run:
        return None
    vertical = Vertical(project_id=project_id, code=code)
    session.add(vertical)
    await session.flush()
    cache[key] = vertical
    return vertical


async def _build_cup_index(session: AsyncSession) -> dict[str, Cup]:
    rows = (await session.scalars(select(Cup))).all()
    return {c.cup_number: c for c in rows}


async def _build_project_index(session: AsyncSession) -> dict[str, Project]:
    rows = (await session.scalars(select(Project))).all()
    return {p.name: p for p in rows}


def _pick(row: tuple[Any, ...], col: dict[str, int], keys: list[str]) -> Any:
    for k in keys:
        idx = col.get(k)
        if idx is not None and idx < len(row):
            return row[idx]
    return None


def _normalize_cup_number(raw: object) -> str:
    """杯号在 Excel 可能是 int 也可能是 str；统一成无小数尾的字符串."""
    if isinstance(raw, bool):
        return str(raw)
    if isinstance(raw, int):
        return str(raw)
    if isinstance(raw, float):
        if raw.is_integer():
            return str(int(raw))
        return str(raw)
    return str(raw).strip()
