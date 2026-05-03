# ruff: noqa: N999  # CLI 入口，文件名故意带连字符
"""一次性从称重数据库.xlsx 导入 mock 数据到 PG。

用法:
    cd <repo root>
    docker compose -f docker/docker-compose.yml up -d pg
    cd apps/api && uv run alembic upgrade head && cd ../..
    uv run --project apps/api python scripts/seed-from-excel.py \
        --excel /Users/jiayin/Downloads/称重数据库.xlsx \
        [--dry-run]

幂等：projects.name / cups.cup_number / records.client_uid UNIQUE 去重，
重复跑同一份 Excel 数字保持一致。

Env:
    DATABASE_URL  默认从 apps/api/.env 读
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

# 让脚本能 import apps/api 的代码
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "apps" / "api" / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

from seed_from_excel.cups_loader import load_cups  # noqa: E402
from seed_from_excel.excel_reader import open_workbook  # noqa: E402
from seed_from_excel.projects_loader import load_projects  # noqa: E402
from seed_from_excel.records_loader import load_records  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker  # noqa: E402

from scale_api.db.session import make_engine  # noqa: E402


async def main(excel_path: Path, *, dry_run: bool) -> int:
    wb = open_workbook(excel_path)
    engine = make_engine()
    sm = async_sessionmaker(engine, expire_on_commit=False)

    summary: dict[str, tuple[int, int]] = {
        "projects": (0, 0),
        "cups": (0, 0),
        "records": (0, 0),
    }
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
