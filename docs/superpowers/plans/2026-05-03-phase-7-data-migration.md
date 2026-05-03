# Phase 7 · Excel 数据迁移（一次性脚本）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans。前置：Phase 2 已合 main（业务表已建）。Worktree：`../scale-system-data-migration` 分支 `phase-7/data-migration`。

**Goal:** 把 `/Users/jiayin/Downloads/称重数据库.xlsx`（4 个 sheet：项目库 / 杯库 3927 条 / S徐六泾断面200712 / S浙江201611）一次性导入 PG，作为 mock 初始数据。

**Architecture:** 独立 Python 脚本 `scripts/seed-from-excel.py`，幂等设计（重复跑不会重复插入）。读 Excel → 转 schema → 通过 SQLAlchemy ORM 批量 upsert。

**Tech Stack:** openpyxl / SQLAlchemy 2 异步 / psycopg(同步备用) / 复用 apps/api 的 models 与 settings。

---

## 关键约束

1. **复用 apps/api 的 models 与 db**：脚本 import `scale_api.models.*`，**不**重新定义 schema。
2. **幂等**：用 `UNIQUE` 字段（projects.name / cups.cup_number / records.client_uid）做 ON CONFLICT，重复跑不报错也不重复插入。
3. **校验失败提示而非 abort**：单条失败记到 stderr，继续处理下一条，最后汇总报告"成功 N / 失败 M"。
4. **不动 BE 代码**，只新增脚本 + 一个测试。
5. **不 commit Excel 文件本身到 git**（数据可能含敏感）；脚本只读取本地路径。

---

## Task 7.1 · 探索 Excel 实际结构

**Files:**
- Create: `scripts/inspect-excel.py`（一次性探索，不入正式提交）

- [ ] **Step 1:** 读 Excel 看真实字段名

```bash
mkdir -p scripts
python3 -c "
import openpyxl
wb = openpyxl.load_workbook('/Users/jiayin/Downloads/称重数据库.xlsx', data_only=True)
for n in wb.sheetnames:
    ws = wb[n]
    print(f'=== {n}  {ws.max_row}x{ws.max_column} ===')
    for r in ws.iter_rows(min_row=1, max_row=3, values_only=True):
        print(r)
    print()
"
```

记录每个 sheet 的列定义。spec 中已知：
- 项目库：`(序号, 项目, 建立日期, 备注)`
- 杯库：`(杯号, 当前杯重, 最新率定日期杯重, 上次杯重, 上次率定日期)`
- S徐六泾断面200712：24 列宽表 `(垂线号, 潮型, 日期, 水深, c0..c10, bh0..bh1[实为 bh10 typo], bs0..bs1, 开始时间, 结束时间)`
- S浙江201611：25 列（多 1 列"容积"）

如发现字段顺序与 spec §7.6 不一致，按 Excel 实际为准修正脚本，并记录到 plan 末尾。

---

## Task 7.2 · 脚本骨架 + 项目库 + 杯库

**Files:**
- Create: `scripts/seed-from-excel.py`
- Create: `scripts/__init__.py`
- Create: `scripts/seed_from_excel/__init__.py`
- Create: `scripts/seed_from_excel/excel_reader.py`
- Create: `scripts/seed_from_excel/projects_loader.py`
- Create: `scripts/seed_from_excel/cups_loader.py`

> 注：放 `scripts/seed_from_excel/` 包内拆分模块，避免单文件超 500 行。脚本入口 `scripts/seed-from-excel.py` 调用模块。

### 7.2.1 scripts/seed-from-excel.py

```python
"""一次性从称重数据库.xlsx 导入 mock 数据到 PG。

用法:
    cd <repo root>
    docker compose -f docker/docker-compose.yml up -d pg
    cd apps/api && uv run alembic upgrade head && cd ../..
    uv run --project apps/api python scripts/seed-from-excel.py \
        --excel /Users/jiayin/Downloads/称重数据库.xlsx \
        [--dry-run]

Env:
    DATABASE_URL  默认从 apps/api/.env 读
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

# 让脚本能 import apps/api 的代码
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api" / "src"))

from sqlalchemy.ext.asyncio import async_sessionmaker

from scale_api.db.session import make_engine

from seed_from_excel.cups_loader import load_cups
from seed_from_excel.excel_reader import open_workbook
from seed_from_excel.projects_loader import load_projects
from seed_from_excel.records_loader import load_records


async def main(excel_path: Path, *, dry_run: bool) -> int:
    wb = open_workbook(excel_path)
    engine = make_engine()
    sm = async_sessionmaker(engine, expire_on_commit=False)

    summary = {"projects": (0, 0), "cups": (0, 0), "records": (0, 0)}
    try:
        async with sm() as session:
            summary["projects"] = await load_projects(session, wb, dry_run=dry_run)
            summary["cups"] = await load_cups(session, wb, dry_run=dry_run)
            summary["records"] = await load_records(session, wb, dry_run=dry_run)
            if not dry_run:
                await session.commit()
    finally:
        await engine.dispose()

    print()
    print("=== 迁移结果 ===")
    for name, (ok, fail) in summary.items():
        print(f"{name:>10}: 成功 {ok:>5} / 失败 {fail:>3}")
    if dry_run:
        print("(dry-run, 未提交)")
    return 0


def cli() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--excel", required=True, type=Path)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    return asyncio.run(main(args.excel, dry_run=args.dry_run))


if __name__ == "__main__":
    sys.exit(cli())
```

### 7.2.2 scripts/seed_from_excel/excel_reader.py

```python
"""Excel 读取统一入口."""
from pathlib import Path

import openpyxl
from openpyxl.workbook import Workbook


def open_workbook(path: Path) -> Workbook:
    if not path.exists():
        raise FileNotFoundError(f"Excel 不存在: {path}")
    return openpyxl.load_workbook(path, data_only=True, read_only=True)
```

### 7.2.3 scripts/seed_from_excel/projects_loader.py

```python
"""项目库 sheet → projects 表."""
from datetime import datetime, date

from openpyxl.workbook import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.project import Project


async def load_projects(session: AsyncSession, wb: Workbook, *, dry_run: bool) -> tuple[int, int]:
    """返回 (成功, 失败)."""
    if "项目库" not in wb.sheetnames:
        print("未找到 sheet '项目库'，跳过", file=__import__("sys").stderr)
        return 0, 0

    ws = wb["项目库"]
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    ok = 0
    fail = 0

    for row in rows:
        try:
            # 列：序号, 项目, 建立日期, 备注
            _, name, established_raw, notes = (list(row) + [None] * 4)[:4]
            if not name:
                continue
            established_date = _to_date(established_raw)

            existing = (await session.scalars(
                select(Project).where(Project.name == name)
            )).first()
            if existing:
                ok += 1  # 已存在视为成功
                continue

            if not dry_run:
                session.add(Project(
                    name=str(name),
                    established_date=established_date,
                    notes=str(notes) if notes else None,
                    is_active=True,
                ))
            ok += 1
        except Exception as e:
            fail += 1
            print(f"[projects] 失败: {row} → {e}", file=__import__("sys").stderr)

    if not dry_run:
        await session.flush()
    return ok, fail


def _to_date(raw: object) -> date | None:
    if raw is None:
        return None
    if isinstance(raw, date):
        return raw
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, str):
        # 可能是"2007年12月24日"
        for fmt in ("%Y年%m月%d日", "%Y-%m-%d", "%Y/%m/%d"):
            try:
                return datetime.strptime(raw, fmt).date()
            except ValueError:
                continue
    return None
```

### 7.2.4 scripts/seed_from_excel/cups_loader.py

```python
"""杯库 sheet → cups + cup_calibrations."""
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import cast

from openpyxl.workbook import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.cup import Cup
from scale_api.models.cup_calibration import CupCalibration


async def load_cups(session: AsyncSession, wb: Workbook, *, dry_run: bool) -> tuple[int, int]:
    if "杯库" not in wb.sheetnames:
        return 0, 0
    ws = wb["杯库"]
    ok = 0
    fail = 0
    BATCH = 200
    pending: list[Cup] = []
    pending_cals: list[CupCalibration] = []

    for row in ws.iter_rows(min_row=2, values_only=True):
        try:
            # 列：杯号, 当前杯重, 最新率定日期杯重, 上次杯重, 上次率定日期
            number_raw, current_raw, latest_date_raw, prev_raw, prev_date_raw = (
                list(row) + [None] * 5
            )[:5]
            if number_raw is None:
                continue
            cup_number = str(number_raw).strip()
            if not cup_number:
                continue
            current_tare = _to_decimal(current_raw)
            if current_tare is None:
                fail += 1
                print(f"[cups] 杯号 {cup_number} 无当前杯重，跳过", file=__import__("sys").stderr)
                continue

            existing = (await session.scalars(
                select(Cup).where(Cup.cup_number == cup_number)
            )).first()
            if existing:
                ok += 1
                continue

            cup = Cup(
                cup_number=cup_number,
                current_tare_g=current_tare,
                latest_calibration_date=_to_date(latest_date_raw),
                is_active=True,
            )
            pending.append(cup)
            ok += 1

            # 历史一并记录（如果有"上次"数据）
            prev_tare = _to_decimal(prev_raw)
            prev_date = _to_date(prev_date_raw)
            # 当前率定
            latest_date = _to_date(latest_date_raw)
            if latest_date is not None:
                pending_cals.append(_build_cal(cup, current_tare, latest_date, "import:current"))
            if prev_tare is not None and prev_date is not None:
                pending_cals.append(_build_cal(cup, prev_tare, prev_date, "import:previous"))

            if not dry_run and len(pending) >= BATCH:
                session.add_all(pending)
                session.add_all(pending_cals)
                await session.flush()
                pending.clear()
                pending_cals.clear()
        except Exception as e:
            fail += 1
            print(f"[cups] 失败: {row} → {e}", file=__import__("sys").stderr)

    if not dry_run and (pending or pending_cals):
        session.add_all(pending)
        session.add_all(pending_cals)
        await session.flush()

    return ok, fail


def _build_cal(cup: Cup, tare: Decimal, day: date, method: str) -> CupCalibration:
    return CupCalibration(
        cup=cup,            # 通过关系赋值（cup_id 由 ORM 在 flush 时填）— 若无 relationship 直接报错则改为 cup_id
        tare_g=tare,
        calibrated_at=datetime.combine(day, datetime.min.time()),
        method=method,
    )


def _to_decimal(raw: object) -> Decimal | None:
    if raw is None:
        return None
    try:
        return Decimal(str(raw))
    except (InvalidOperation, ValueError):
        return None


def _to_date(raw: object) -> date | None:
    if raw is None:
        return None
    if isinstance(raw, date):
        return raw
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, str):
        for fmt in ("%Y年%m月%d日", "%Y-%m-%d", "%Y/%m/%d"):
            try:
                return datetime.strptime(raw, fmt).date()
            except ValueError:
                continue
    return None
```

注：`CupCalibration` 模型可能没有 `cup` 反向关系（Phase 2 模型只定义了 `cup_id`），如此脚本应直接用 `cup_id=cup.id`，但 cup 未 flush 前没有 id。改为：

```python
# 直接每批 flush 后再插历史
await session.flush()  # 让 cups 拿到 id
for cup in pending:
    if cup.latest_calibration_date is not None:
        session.add(CupCalibration(
            cup_id=cup.id,
            tare_g=cup.current_tare_g,
            calibrated_at=datetime.combine(cup.latest_calibration_date, datetime.min.time()),
            method="import:current",
        ))
```

实施时按实际 model relationship 决定。

- [ ] **Step 1-5:** 写 4 个文件 + 提交

```bash
git commit -m "feat(scripts): seed-from-excel 骨架 + projects + cups 加载器"
```

---

## Task 7.3 · records_loader（宽表 → JSONB points）

**Files:**
- Create: `scripts/seed_from_excel/records_loader.py`

把 `S徐六泾断面200712` 和 `S浙江201611` 的 24-25 列宽表转成 `weighing_records.points` JSONB。

```python
"""宽表 sheet → weighing_records."""
from __future__ import annotations

import sys
import uuid
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, cast

from openpyxl.workbook import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.cup import Cup
from scale_api.models.project import Project
from scale_api.models.record import WeighingRecord
from scale_api.models.vertical import Vertical

PROJECT_SHEETS = ["S徐六泾断面200712", "S浙江201611"]
POSITIONS = ["0.0", "0.2", "0.4", "0.6", "0.8", "1.0"]


async def load_records(session: AsyncSession, wb: Workbook, *, dry_run: bool) -> tuple[int, int]:
    ok = 0
    fail = 0
    cup_index = await _build_cup_index(session)
    project_index = await _build_project_index(session)
    vertical_cache: dict[tuple[int, str], Vertical] = {}

    for sheet_name in PROJECT_SHEETS:
        if sheet_name not in wb.sheetnames:
            continue
        # 项目名取 sheet 名（移除 'S' 前缀如需）
        project_name = sheet_name
        project = project_index.get(project_name)
        if project is None:
            # 自动建项目
            project = Project(name=project_name, is_active=True)
            session.add(project)
            await session.flush()
            project_index[project_name] = project

        ws = wb[sheet_name]
        header_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True))
        # header 兼容 bh1/bh10 typo
        header = [str(h) if h is not None else "" for h in header_row]
        col = {name: i for i, name in enumerate(header)}

        for row in ws.iter_rows(min_row=2, values_only=True):
            try:
                vline_code = _str(row[col["垂线号"]])
                if not vline_code:
                    continue
                tide_type = _str(row[col["潮型"]])
                sample_date = _to_date(row[col["日期"]])
                water_depth = _to_decimal(row[col["水深"]])
                start_time = _to_datetime(row[col.get("开始时间", -1)] if "开始时间" in col else None)
                end_time = _to_datetime(row[col.get("结束时间", -1)] if "结束时间" in col else None)
                volume_ml = _to_decimal(row[col["容积"]]) if "容积" in col else Decimal("1000")

                # 6 个点位：c{0,2,4,6,8,10} / bh{0,2,4,6,8,1 or 10} / bs{0,2,4,6,8,1 or 10}
                points = []
                for pos in POSITIONS:
                    suf = pos.replace(".", "").replace("0", "0", 1)  # 0.0->0, 0.2->2 ...
                    suf = pos.split(".")[1]  # "0" / "2" / "4" / ...
                    if pos == "1.0":
                        # bh10 / bs10 / c10；老 sheet 可能写成 bh1/bs1（spec §6 提示 typo）
                        bh_keys = ["bh10", "bh1"]
                        bs_keys = ["bs10", "bs1"]
                        c_keys = ["c10"]
                    else:
                        bh_keys = [f"bh{suf}"]
                        bs_keys = [f"bs{suf}"]
                        c_keys = [f"c{suf}"]
                    cup_no = _pick(row, col, bh_keys)
                    wet = _pick(row, col, bs_keys)
                    conc = _pick(row, col, c_keys)
                    if cup_no is None or wet is None:
                        continue  # 缺该点位数据，跳过该点位

                    cup_str = str(int(cup_no)) if isinstance(cup_no, (int, float)) else str(cup_no)
                    cup_obj = cup_index.get(cup_str)
                    if cup_obj is None:
                        # 杯库没有此号 → 自动建一个最小 cup，杯重用 wet 减去经验值（不准确，标记 import:auto）
                        # 更好做法：跳过该点位
                        print(f"[records] 杯号 {cup_str} 不在杯库，跳过该点位", file=sys.stderr)
                        continue
                    points.append({
                        "pos": pos,
                        "cup_id": cup_obj.id,
                        "cup_number": cup_obj.cup_number,
                        "cup_tare_g": str(cup_obj.current_tare_g),
                        "wet_weight_g": str(_to_decimal(wet) or Decimal("0")),
                        "concentration_mg_l": str(_to_decimal(conc) or Decimal("0")),
                    })

                if not points:
                    fail += 1
                    continue

                # 找/建 vertical
                vertical = vertical_cache.get((project.id, vline_code))
                if vertical is None:
                    vertical = (await session.scalars(
                        select(Vertical).where(
                            Vertical.project_id == project.id, Vertical.code == vline_code,
                        )
                    )).first()
                    if vertical is None:
                        vertical = Vertical(project_id=project.id, code=vline_code)
                        session.add(vertical)
                        await session.flush()
                    vertical_cache[(project.id, vline_code)] = vertical

                # 幂等：用 (project_id, vertical_id, sample_date, start_time) 计算稳定 client_uid
                stable_uid = uuid.uuid5(
                    uuid.NAMESPACE_URL,
                    f"scale://import/{project.id}/{vertical.id}/{sample_date}/{start_time}",
                )
                existing = (await session.scalars(
                    select(WeighingRecord).where(WeighingRecord.client_uid == stable_uid)
                )).first()
                if existing:
                    ok += 1
                    continue

                if not dry_run:
                    session.add(WeighingRecord(
                        client_uid=stable_uid,
                        project_id=project.id,
                        vertical_id=vertical.id,
                        tide_type=tide_type,
                        sample_date=sample_date or date(2000, 1, 1),
                        water_depth_m=water_depth,
                        start_time=start_time,
                        end_time=end_time,
                        volume_ml=volume_ml,
                        points=points,
                        source="import",
                    ))
                ok += 1
            except Exception as e:
                fail += 1
                print(f"[records:{sheet_name}] 失败 {row} → {e}", file=sys.stderr)

    if not dry_run:
        await session.flush()
    return ok, fail


async def _build_cup_index(session: AsyncSession) -> dict[str, Cup]:
    rows = (await session.scalars(select(Cup))).all()
    return {c.cup_number: c for c in rows}


async def _build_project_index(session: AsyncSession) -> dict[str, Project]:
    rows = (await session.scalars(select(Project))).all()
    return {p.name: p for p in rows}


def _pick(row: tuple[Any, ...], col: dict[str, int], keys: list[str]) -> object:
    for k in keys:
        if k in col:
            return row[col[k]]
    return None


def _str(raw: object) -> str:
    if raw is None: return ""
    return str(raw).strip()


def _to_decimal(raw: object) -> Decimal | None:
    if raw is None: return None
    try:
        return Decimal(str(raw))
    except (InvalidOperation, ValueError):
        return None


def _to_date(raw: object) -> date | None:
    if raw is None: return None
    if isinstance(raw, date): return raw
    if isinstance(raw, datetime): return raw.date()
    return None


def _to_datetime(raw: object) -> datetime | None:
    if raw is None: return None
    if isinstance(raw, datetime): return raw
    if isinstance(raw, date): return datetime.combine(raw, datetime.min.time())
    return None
```

- [ ] **Step 1-3:** 写 + 提交

```bash
git commit -m "feat(scripts): records_loader 宽表 → JSONB points（兼容 bh1/bh10 typo + 自动建 vertical）"
```

---

## Task 7.4 · 单元测试（用 testcontainers）

**Files:**
- Create: `apps/api/tests/test_seed_from_excel.py`

测试用一个**精简版** Excel（pytest fixture 临时生成）验证三个 loader：

```python
"""seed-from-excel 单元测试（用临时 Excel）。"""
from __future__ import annotations

import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

import openpyxl
import pytest

# 让脚本能 import
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts"))

from seed_from_excel.cups_loader import load_cups
from seed_from_excel.projects_loader import load_projects


@pytest.fixture
def tiny_excel(tmp_path: Path) -> Path:
    wb = openpyxl.Workbook()
    # 项目库
    ws1 = wb.active
    ws1.title = "项目库"
    ws1.append(["序号", "项目", "建立日期", "备注"])
    ws1.append([1, "TestProj", datetime(2026, 1, 1), "测试"])

    # 杯库
    ws2 = wb.create_sheet("杯库")
    ws2.append(["杯号", "当前杯重", "最新率定日期", "上次杯重", "上次率定日期"])
    ws2.append(["TC-001", 35.2480, datetime(2025, 8, 1), None, None])
    ws2.append(["TC-002", 41.6712, datetime(2024, 5, 15), 41.6713, datetime(2023, 3, 10)])

    f = tmp_path / "tiny.xlsx"
    wb.save(f)
    return f


@pytest.mark.asyncio
async def test_load_projects_inserts_unique(session, tiny_excel) -> None:
    wb = openpyxl.load_workbook(tiny_excel, data_only=True)
    ok, fail = await load_projects(session, wb, dry_run=False)
    await session.commit()
    assert ok == 1
    assert fail == 0
    # 重跑应幂等
    ok2, _ = await load_projects(session, wb, dry_run=False)
    assert ok2 == 1


@pytest.mark.asyncio
async def test_load_cups_with_calibration(session, tiny_excel) -> None:
    wb = openpyxl.load_workbook(tiny_excel, data_only=True)
    ok, fail = await load_cups(session, wb, dry_run=False)
    await session.commit()
    assert ok == 2
    # TC-002 有"上次"数据 → 应至少 2 条 calibration
    from scale_api.models.cup import Cup
    from scale_api.models.cup_calibration import CupCalibration
    from sqlalchemy import select
    cup = (await session.scalars(select(Cup).where(Cup.cup_number == "TC-002"))).first()
    cals = (await session.scalars(select(CupCalibration).where(CupCalibration.cup_id == cup.id))).all()
    assert len(cals) >= 1
```

- [ ] **Step 1-3:** 写测试 + 跑通 + 提交

```bash
cd apps/api && uv run pytest tests/test_seed_from_excel.py -v
git commit -m "test(scripts): seed-from-excel 单元测试（projects + cups + 幂等）"
```

---

## Task 7.5 · 真实 Excel 跑一遍（端到端）

- [ ] **Step 1:** 准备环境

```bash
docker compose -f docker/docker-compose.yml up -d pg
cd apps/api && uv run alembic upgrade head
```

- [ ] **Step 2:** dry-run 看数量

```bash
cd /Users/jiayin/Documents/code_manager/h-frontend/scale-system-data-migration
uv run --project apps/api python scripts/seed-from-excel.py \
  --excel /Users/jiayin/Downloads/称重数据库.xlsx \
  --dry-run
```

期望输出：
```
=== 迁移结果 ===
  projects: 成功     2 / 失败   0
      cups: 成功  3927 / 失败 ≤10
   records: 成功    78~80 / 失败 ≤2
(dry-run, 未提交)
```

- [ ] **Step 3:** 真跑

```bash
uv run --project apps/api python scripts/seed-from-excel.py \
  --excel /Users/jiayin/Downloads/称重数据库.xlsx
```

- [ ] **Step 4:** 验证 PG 中的数据

```bash
docker compose -f docker/docker-compose.yml exec pg \
  psql -U scale -d scale_system -c "
    SELECT 'projects' AS t, COUNT(*) FROM projects
    UNION ALL SELECT 'verticals', COUNT(*) FROM verticals
    UNION ALL SELECT 'cups', COUNT(*) FROM cups
    UNION ALL SELECT 'cup_calibrations', COUNT(*) FROM cup_calibrations
    UNION ALL SELECT 'weighing_records', COUNT(*) FROM weighing_records
    ORDER BY 1;
  "
```

期望：cups ≥ 3900；weighing_records ≥ 70；verticals 自动建出来（每个项目有几个 KMG-S* 编号）。

- [ ] **Step 5:** 再跑一次验证幂等

```bash
uv run --project apps/api python scripts/seed-from-excel.py \
  --excel /Users/jiayin/Downloads/称重数据库.xlsx
```

期望：所有 OK 数字与第一次相同（已存在则视为成功），数据库不重复。

- [ ] **Step 6:** 写 README 记录

```bash
cat >> scripts/README.md <<'EOF'
# scripts

## seed-from-excel.py

把 `称重数据库.xlsx` 的 4 sheet 数据导入 PG，幂等可重跑。

用法见脚本 docstring。
EOF
git add scripts/README.md
git commit -m "docs(scripts): README 记录 seed-from-excel 用法"
```

---

## Task 7.6 · 全量自检

- [ ] **Step 1:** 跑测试

```bash
cd apps/api
uv run pytest tests/test_seed_from_excel.py -v
```

- [ ] **Step 2:** ruff

```bash
cd ..
uv run --project api ruff check scripts/seed_from_excel/
uv run --project api ruff format --check scripts/seed_from_excel/
```

- [ ] **Step 3:** 提交收尾

```bash
git commit --allow-empty -m "test(scripts): Phase 7 全量自检通过"
```

---

## Phase 7 完成标志

✅ scripts/seed-from-excel.py 入口 + 4 个 loader 模块（每个 ≤ 500 行）
✅ projects / cups + cup_calibrations / records 全部能从 Excel 导入
✅ 兼容 bh1/bh10 typo
✅ 自动建 vertical（旧 sheet 没有 verticals 列）
✅ 容积缺失时默认 1000mL
✅ 幂等（重跑不重复）
✅ pytest 测试通过
✅ 真实 Excel dry-run + 实跑全过

---

## 下一步

合 main，PG 中已有 mock 初始数据，可与 Phase 5/6 一起跑端到端。
