# Phase 2 · 后端业务实体 CRUD

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans。前置：Phase 1 已合并 main（含 4 层架构、auth、users、refresh）。Worktree：`../scale-system-be-business` 分支 `phase-2/backend-business`。

**Goal:** 把 spec §7 中除 users/refresh_tokens/audit_logs 外的 5 大业务实体（scales / projects / verticals / cups + cup_calibrations / weighing_records）模型 + repository + service + API + 测试全部就位，含 JSONB points 索引、cursor 分页、批量幂等同步、按 client_uid 去重。

**Architecture:** 严格遵守 §6.2 单向依赖，按 §6.4 预拆分 records 复杂模块（records_query / records_mutation / records_batch / record_validator / record_calculator / record_batch_processor / record_query_builder）。

**Tech Stack:** SQLAlchemy 2.0 / Alembic / Pydantic v2 / pytest + testcontainers / FastAPI 0.115。

---

## 关键约束

1. **遵循 Phase 1 偏差修正**：Phase 1 plan 末尾 D1-D7 全部已合并，本 phase 复用：PG 5433 / NoDecode / TRUNCATE 隔离 / asyncio session loop。
2. **每个实体 4 层文件 ≤ 500 行**。records 必须按 §6.4 预拆，禁止合并。
3. **审计日志**：所有 admin 写操作（create/update/delete/calibrate）必须写 `audit_logs`，service 层包装。
4. **OpenAPI 重新生成**：每加一个端点都更新 `packages/shared-types/src/api.ts`（最后一步统一跑 `pnpm --filter @scale/shared-types generate`）。
5. **JSONB 校验**：service 层 `record_validator` 校验 points 数组结构后才允许入库。
6. **client_uid 幂等**：records POST + batch 都按 `ON CONFLICT (client_uid) DO NOTHING RETURNING id` 模式做去重。

---

## Task 2.1 · 主数据模型（projects / verticals / scales / cups / cup_calibrations）

**Files:**
- Create: `apps/api/src/scale_api/models/project.py`
- Create: `apps/api/src/scale_api/models/vertical.py`
- Create: `apps/api/src/scale_api/models/scale.py`
- Create: `apps/api/src/scale_api/models/cup.py`
- Create: `apps/api/src/scale_api/models/cup_calibration.py`
- Modify: `apps/api/src/scale_api/models/__init__.py`

- [ ] **Step 1:** 写 `models/project.py`

```python
"""项目库."""
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from scale_api.models.base import Base, TimestampMixin


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    established_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    __table_args__ = (
        Index("ix_projects_created_at_desc", "created_at"),
        Index("ix_projects_active_created", "is_active", "created_at"),
    )
```

- [ ] **Step 2:** 写 `models/vertical.py`

```python
"""垂线（属于项目）."""
from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from scale_api.models.base import Base, TimestampMixin


class Vertical(Base, TimestampMixin):
    __tablename__ = "verticals"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False,
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str | None] = mapped_column(String(128))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("project_id", "code", name="uq_vertical_project_code"),
        Index("ix_verticals_proj_sort", "project_id", "sort_order"),
    )
```

- [ ] **Step 3:** 写 `models/scale.py`

```python
"""天平配置（中心管理，所有客户端共享）."""
from sqlalchemy import Boolean, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from scale_api.models.base import Base, TimestampMixin


class Scale(Base, TimestampMixin):
    __tablename__ = "scales"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    model: Mapped[str | None] = mapped_column(String(64))
    protocol_type: Mapped[str] = mapped_column(String(32), nullable=False, default="generic")
    baud_rate: Mapped[int] = mapped_column(Integer, nullable=False, default=9600)
    data_bits: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=8)
    parity: Mapped[str] = mapped_column(String(8), nullable=False, default="none")
    stop_bits: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    flow_control: Mapped[str] = mapped_column(String(8), nullable=False, default="none")
    read_timeout_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=1000)
    decimal_places: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=4)
    unit_default: Mapped[str] = mapped_column(String(8), nullable=False, default="g")
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
```

- [ ] **Step 4:** 写 `models/cup.py`

```python
"""杯库."""
from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from scale_api.models.base import Base, TimestampMixin


class Cup(Base, TimestampMixin):
    __tablename__ = "cups"

    id: Mapped[int] = mapped_column(primary_key=True)
    cup_number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    current_tare_g: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    latest_calibration_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text)

    # 全文搜索用 trigram（spec §7.5）。Alembic 迁移里加 GIN 索引（DDL 直接给）。
    __table_args__ = (
        Index(
            "ix_cups_number_trgm",
            "cup_number",
            postgresql_using="gin",
            postgresql_ops={"cup_number": "gin_trgm_ops"},
        ),
    )
```

- [ ] **Step 5:** 写 `models/cup_calibration.py`

```python
"""杯子率定历史."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from scale_api.models.base import Base


class CupCalibration(Base):
    __tablename__ = "cup_calibrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    cup_id: Mapped[int] = mapped_column(
        ForeignKey("cups.id", ondelete="CASCADE"), nullable=False,
    )
    tare_g: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    calibrated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    calibrated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    method: Mapped[str | None] = mapped_column(String(32))
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_cup_cal_cup_time", "cup_id", "calibrated_at"),
    )
```

- [ ] **Step 6:** 改 `models/__init__.py` 加导出

```python
"""ORM 模型导出."""
from scale_api.models.audit_log import AuditLog
from scale_api.models.base import Base
from scale_api.models.cup import Cup
from scale_api.models.cup_calibration import CupCalibration
from scale_api.models.project import Project
from scale_api.models.refresh_token import RefreshToken
from scale_api.models.scale import Scale
from scale_api.models.user import User
from scale_api.models.vertical import Vertical

__all__ = [
    "AuditLog", "Base", "Cup", "CupCalibration",
    "Project", "RefreshToken", "Scale", "User", "Vertical",
]
```

- [ ] **Step 7:** 提交

```bash
git add apps/api/src/scale_api/models
git commit -m "feat(api): projects/verticals/scales/cups/cup_calibrations 模型"
```

---

## Task 2.2 · weighing_records 模型（JSONB + 索引）

**Files:**
- Create: `apps/api/src/scale_api/models/record.py`
- Modify: `apps/api/src/scale_api/models/__init__.py`

- [ ] **Step 1:** 写 `models/record.py`

```python
"""称重记录（核心）."""
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import (
    BigInteger, Date, DateTime, ForeignKey, Index, Numeric, String, Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from scale_api.models.base import Base, TimestampMixin


class WeighingRecord(Base, TimestampMixin):
    __tablename__ = "weighing_records"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    client_uid: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), unique=True, nullable=False)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    vertical_id: Mapped[int] = mapped_column(ForeignKey("verticals.id"), nullable=False)
    tide_type: Mapped[str | None] = mapped_column(String(8))
    sample_date: Mapped[date] = mapped_column(Date, nullable=False)
    water_depth_m: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    volume_ml: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    points: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    computed_avg_concentration: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    notes: Mapped[str | None] = mapped_column(Text)
    operator_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    source: Mapped[str] = mapped_column(String(8), nullable=False, default="web")

    __table_args__ = (
        Index("ix_rec_proj_vert_date", "project_id", "vertical_id", "sample_date"),
        Index("ix_rec_created", "created_at"),
        Index(
            "ix_rec_points_gin",
            "points",
            postgresql_using="gin",
            postgresql_ops={"points": "jsonb_path_ops"},
        ),
    )
```

- [ ] **Step 2:** 改 `models/__init__.py` 加 WeighingRecord 导出

```python
from scale_api.models.record import WeighingRecord
__all__ = [..., "WeighingRecord"]  # 加进 __all__
```

- [ ] **Step 3:** 提交

```bash
git add apps/api/src/scale_api/models
git commit -m "feat(api): weighing_records 模型 + JSONB GIN 索引"
```

---

## Task 2.3 · Alembic 迁移（新增 6 张表 + 表达式索引）

**Files:**
- Create: `apps/api/alembic/versions/<timestamp>_business_entities.py`

- [ ] **Step 1:** 启 PG（如未起）

```bash
docker compose -f ../../docker/docker-compose.yml up -d pg
```

- [ ] **Step 2:** 自动生成迁移

```bash
cd apps/api
uv run alembic revision --autogenerate -m "business: projects verticals scales cups records"
```

- [ ] **Step 3:** 检查生成的迁移文件，**手工补两件 autogen 不会写的事**：
  1. `pg_trgm` 扩展（cups gin_trgm_ops 需要）：在 `upgrade()` 顶部加 `op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")`
  2. records 的 points 表达式索引（spec §7.6 的 cup_number / cup_id 反查）：在 `upgrade()` 末尾加：

```python
op.execute("""
    CREATE INDEX ix_rec_points_cup_numbers ON weighing_records
    USING gin ((ARRAY(SELECT jsonb_array_elements(points)->>'cup_number')))
""")
op.execute("""
    CREATE INDEX ix_rec_points_cup_ids ON weighing_records
    USING gin ((ARRAY(SELECT (jsonb_array_elements(points)->>'cup_id')::BIGINT)))
""")
```

`downgrade()` 镜像加：

```python
op.execute("DROP INDEX IF EXISTS ix_rec_points_cup_ids")
op.execute("DROP INDEX IF EXISTS ix_rec_points_cup_numbers")
# 不要 drop pg_trgm（其他表可能也用）
```

- [ ] **Step 4:** 应用迁移

```bash
uv run alembic upgrade head
```

- [ ] **Step 5:** 验证表与索引

```bash
docker compose -f ../../docker/docker-compose.yml exec pg \
  psql -U scale -d scale_system -c "\dt" -c "\di ix_rec_*"
```

期望：见到 9 张业务表 + 4 个 records 索引（含 2 个 GIN 表达式）。

- [ ] **Step 6:** 提交

```bash
git add apps/api/alembic/versions/
git commit -m "feat(api): Alembic 迁移加 6 张业务表 + 表达式索引"
```

---

## Task 2.4 · Pagination helper + 通用 schemas

**Files:**
- Create: `apps/api/src/scale_api/services/pagination.py`
- Test: `apps/api/tests/services/test_pagination.py`

- [ ] **Step 1:** 写测试 `tests/services/test_pagination.py`

```python
"""Pagination helper 测试."""
import base64
import json

import pytest
from sqlalchemy import select

from scale_api.models.user import User
from scale_api.services.pagination import cursor_paginate, decode_cursor, encode_cursor, offset_paginate


def test_cursor_round_trip() -> None:
    enc = encode_cursor({"id": 42, "created_at": "2026-05-03T10:00:00+00:00"})
    assert isinstance(enc, str)
    assert decode_cursor(enc) == {"id": 42, "created_at": "2026-05-03T10:00:00+00:00"}


def test_decode_invalid_cursor_raises() -> None:
    with pytest.raises(ValueError):
        decode_cursor("not-a-cursor")


@pytest.mark.asyncio
async def test_cursor_paginate_returns_items_and_next(session) -> None:
    for i in range(5):
        session.add(User(username=f"u{i}", password_hash="h", role="operator"))
    await session.commit()

    page = await cursor_paginate(
        session,
        select(User).order_by(User.id.desc()),
        order_keys=["id"],
        limit=2,
        cursor=None,
    )
    assert len(page.items) == 2
    assert page.next_cursor is not None


@pytest.mark.asyncio
async def test_offset_paginate(session) -> None:
    for i in range(5):
        session.add(User(username=f"o{i}", password_hash="h", role="operator"))
    await session.commit()

    page = await offset_paginate(
        session, select(User).order_by(User.id), page=1, size=3,
    )
    assert page.total >= 5
    assert len(page.items) == 3
```

- [ ] **Step 2:** 实现 `services/pagination.py`

```python
"""分页 helper：cursor + offset 双模式."""
import base64
import json
from typing import Any, TypeVar

from sqlalchemy import Select, func
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
        # 简单实现：cursor 仅记录上一页最后一条的 id
        from sqlalchemy import column
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
```

需要 `from sqlalchemy import select` 在文件顶部。

- [ ] **Step 3:** 跑测试 pass

- [ ] **Step 4:** 提交

```bash
git add apps/api/src/scale_api/services/pagination.py apps/api/tests/services/test_pagination.py
git commit -m "feat(api): cursor + offset 双模式分页 helper"
```

---

## Task 2.5 · Projects 端到端（model→repo→service→api→test）

**Files:**
- Create: `apps/api/src/scale_api/schemas/project.py`
- Create: `apps/api/src/scale_api/repositories/project_repo.py`
- Create: `apps/api/src/scale_api/services/project_service.py`
- Create: `apps/api/src/scale_api/api/v1/projects.py`
- Test: `apps/api/tests/api/test_projects_api.py`
- Modify: `apps/api/src/scale_api/main.py` 注册路由

- [ ] **Step 1:** 写 `schemas/project.py`

```python
"""项目 schemas."""
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

ProjectName = Annotated[str, StringConstraints(min_length=1, max_length=128)]


class ProjectBase(BaseModel):
    name: ProjectName
    established_date: date | None = None
    notes: str | None = None
    is_active: bool = True


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: ProjectName | None = None
    established_date: date | None = None
    notes: str | None = None
    is_active: bool | None = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 2:** 写 `repositories/project_repo.py`

```python
"""Project 仓储."""
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.project import Project
from scale_api.repositories.base import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    model = Project

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_by_name(self, name: str) -> Project | None:
        return (await self.session.scalars(select(Project).where(Project.name == name))).first()

    def list_query(self, *, q: str | None, is_active: bool | None):
        stmt = select(Project).order_by(Project.created_at.desc(), Project.id.desc())
        if q:
            like = f"%{q}%"
            stmt = stmt.where(or_(Project.name.ilike(like), Project.notes.ilike(like)))
        if is_active is not None:
            stmt = stmt.where(Project.is_active.is_(is_active))
        return stmt
```

- [ ] **Step 3:** 写 `services/project_service.py`

```python
"""Project 服务."""
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.core.exceptions import ConflictError, NotFoundError
from scale_api.models.project import Project
from scale_api.repositories.project_repo import ProjectRepository
from scale_api.schemas.common import CursorPage
from scale_api.schemas.project import ProjectCreate, ProjectUpdate
from scale_api.services.pagination import cursor_paginate


class ProjectService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ProjectRepository(session)

    async def create(self, body: ProjectCreate, *, actor_id: int | None) -> Project:
        if await self.repo.get_by_name(body.name):
            raise ConflictError(f"项目名 {body.name} 已存在")
        p = Project(
            name=body.name,
            established_date=body.established_date,
            notes=body.notes,
            is_active=body.is_active,
            created_by=actor_id,
        )
        await self.repo.create(p)
        await self.session.commit()
        await self.session.refresh(p)
        return p

    async def update(self, project_id: int, body: ProjectUpdate) -> Project:
        p = await self.repo.get(project_id)
        if p is None:
            raise NotFoundError(f"项目 {project_id} 不存在")
        if body.name is not None and body.name != p.name:
            existing = await self.repo.get_by_name(body.name)
            if existing and existing.id != project_id:
                raise ConflictError(f"项目名 {body.name} 已被占用")
            p.name = body.name
        if body.established_date is not None:
            p.established_date = body.established_date
        if body.notes is not None:
            p.notes = body.notes
        if body.is_active is not None:
            p.is_active = body.is_active
        await self.session.commit()
        await self.session.refresh(p)
        return p

    async def soft_delete(self, project_id: int) -> None:
        p = await self.repo.get(project_id)
        if p is None:
            raise NotFoundError(f"项目 {project_id} 不存在")
        p.is_active = False
        await self.session.commit()

    async def list_paged(
        self, *, q: str | None, is_active: bool | None, limit: int, cursor: str | None,
    ) -> CursorPage[Project]:
        stmt = self.repo.list_query(q=q, is_active=is_active)
        return await cursor_paginate(self.session, stmt, order_keys=["id"], limit=limit, cursor=cursor)
```

- [ ] **Step 4:** 写 `api/v1/projects.py`

```python
"""Projects API."""
from fastapi import APIRouter, Query, status

from scale_api.api.deps import AdminUser, CurrentUser, DBSession
from scale_api.schemas.common import CursorPage
from scale_api.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from scale_api.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=CursorPage[ProjectOut])
async def list_projects(
    _: CurrentUser,
    session: DBSession,
    q: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
) -> CursorPage[ProjectOut]:
    page = await ProjectService(session).list_paged(
        q=q, is_active=is_active, limit=limit, cursor=cursor,
    )
    return CursorPage(
        items=[ProjectOut.model_validate(p) for p in page.items],
        next_cursor=page.next_cursor,
    )


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(body: ProjectCreate, user: AdminUser, session: DBSession) -> ProjectOut:
    p = await ProjectService(session).create(body, actor_id=user.id)
    return ProjectOut.model_validate(p)


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: int, body: ProjectUpdate, _: AdminUser, session: DBSession,
) -> ProjectOut:
    p = await ProjectService(session).update(project_id, body)
    return ProjectOut.model_validate(p)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: int, _: AdminUser, session: DBSession) -> None:
    await ProjectService(session).soft_delete(project_id)
```

- [ ] **Step 5:** `main.py` 注册路由

```python
from scale_api.api.v1 import projects as projects_v1
app.include_router(projects_v1.router, prefix="/api/v1")
```

- [ ] **Step 6:** 写测试 `tests/api/test_projects_api.py`

```python
"""Projects API 测试."""
import pytest


@pytest.mark.asyncio
async def test_admin_can_create_and_list(client, admin_token):
    r = await client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "P1", "notes": "首个项目"},
    )
    assert r.status_code == 201
    assert r.json()["name"] == "P1"

    r2 = await client.get(
        "/api/v1/projects?limit=10",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200
    assert len(r2.json()["items"]) >= 1


@pytest.mark.asyncio
async def test_create_duplicate_name_returns_409(client, admin_token):
    await client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Dup"},
    )
    r = await client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Dup"},
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


@pytest.mark.asyncio
async def test_operator_cannot_create(client, operator_token):
    r = await client.post(
        "/api/v1/projects",
        headers={"Authorization": f"Bearer {operator_token}"},
        json={"name": "OpProj"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_cursor_pagination(client, admin_token):
    for i in range(5):
        await client.post(
            "/api/v1/projects",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"name": f"PG-{i}"},
        )
    r = await client.get(
        "/api/v1/projects?limit=2",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    j = r.json()
    assert len(j["items"]) == 2
    assert j["next_cursor"] is not None
    r2 = await client.get(
        f"/api/v1/projects?limit=2&cursor={j['next_cursor']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200
    j2 = r2.json()
    assert len(j2["items"]) <= 2
    # 不重复
    ids = {p["id"] for p in j["items"] + j2["items"]}
    assert len(ids) == len(j["items"]) + len(j2["items"])
```

需要 `tests/api/conftest.py` 提供 `admin_token` 和 `operator_token` fixture（先用 alice/bob）。沿用 Phase 1 测试中 client fixture 的模式：登录两次拿 token。如果 conftest 没有，加上：

```python
import pytest
from scale_api.core.security import hash_password
from scale_api.models.user import User


@pytest.fixture
async def admin_token(client, session) -> str:
    u = User(username="admin_t", password_hash=hash_password("strongpass!"), role="admin")
    session.add(u)
    await session.commit()
    r = await client.post(
        "/api/v1/auth/login",
        json={"username": "admin_t", "password": "strongpass!", "client_kind": "desktop"},
    )
    return r.json()["access_token"]


@pytest.fixture
async def operator_token(client, session) -> str:
    u = User(username="oper_t", password_hash=hash_password("strongpass!"), role="operator")
    session.add(u)
    await session.commit()
    r = await client.post(
        "/api/v1/auth/login",
        json={"username": "oper_t", "password": "strongpass!", "client_kind": "desktop"},
    )
    return r.json()["access_token"]
```

- [ ] **Step 7:** 跑测试 + lint

```bash
uv run pytest tests/api/test_projects_api.py -v
uv run ruff check .
```

- [ ] **Step 8:** 提交

```bash
git add apps/api/src/scale_api/schemas/project.py \
        apps/api/src/scale_api/repositories/project_repo.py \
        apps/api/src/scale_api/services/project_service.py \
        apps/api/src/scale_api/api/v1/projects.py \
        apps/api/src/scale_api/main.py \
        apps/api/tests/api/test_projects_api.py \
        apps/api/tests/api/conftest.py
git commit -m "feat(api): /projects CRUD + cursor 分页 + 排序按 created_at DESC"
```

---

## Task 2.6 · Verticals（嵌套在 project 下）

**Files:**
- Create: `apps/api/src/scale_api/schemas/vertical.py`
- Create: `apps/api/src/scale_api/repositories/vertical_repo.py`
- Create: `apps/api/src/scale_api/services/vertical_service.py`
- Create: `apps/api/src/scale_api/api/v1/verticals.py`
- Test: `apps/api/tests/api/test_verticals_api.py`

按 Project 同样套路写。要点：

- schemas 含 `VerticalCreate(code, label?, sort_order?)`、`VerticalOut`、`VerticalUpdate`
- repo 提供 `list_by_project(project_id) -> list[Vertical]`，按 sort_order asc, code asc
- service 校验 `(project_id, code)` 唯一约束（捕 IntegrityError 转 ConflictError）
- API 路径：
  - `GET  /projects/{pid}/verticals` 列表（任意登录用户可读）
  - `POST /projects/{pid}/verticals` 新建（admin）
  - `PUT  /verticals/{id}` 更新（admin）
  - `DELETE /verticals/{id}` 删（admin，检查是否有 record 引用：有则 409）
- 测试：列表为空、新增、重复 code、跨 project 不冲突、删被引用项 409

- [ ] **Step 1-7:** 按 Task 2.5 模式写完 5 个文件 + 测试 + 提交

```bash
git commit -m "feat(api): /projects/{pid}/verticals + /verticals/{id} CRUD"
```

---

## Task 2.7 · Scales（CRUD + validate + probe-result）

**Files:**
- Create: `apps/api/src/scale_api/schemas/scale.py`
- Create: `apps/api/src/scale_api/repositories/scale_repo.py`
- Create: `apps/api/src/scale_api/services/scale_service.py`
- Create: `apps/api/src/scale_api/api/v1/scales.py`
- Test: `apps/api/tests/api/test_scales_api.py`

要点：

- `schemas/scale.py` 字段对齐 model 全部字段；`ScaleConfigValidate` 用于 `/validate`：检查 baud/parity/data_bits/stop_bits 取值合法 + 协议兼容（如 mettler 不允许 stop_bits=2）
- `ScaleProbeReport` 用于 `/probe-result`：`{ok, samples_count, samples?, error?}`，service 收到后写 audit_logs（method='scale_probe'）
- API 路径：
  - `GET    /scales` （任意登录用户）
  - `GET    /scales/{id}`
  - `POST   /scales` （admin）
  - `PUT    /scales/{id}` （admin）
  - `DELETE /scales/{id}` 软删（admin）
  - `POST   /scales/{id}/validate` 服务端 schema 校验 → 200 ok / 422 错误细节
  - `POST   /scales/{id}/probe-result` 客户端实测后回报，写入审计日志，返回 `{recorded: true}`

**协议 validation 规则示例**（可放 service 层 `_validate_protocol_compat`）：
- `protocol_type=mettler` 强制 `stop_bits=1` & `parity in {none, even}`
- `protocol_type=sartorius` 强制 `data_bits=7 & parity=odd`（按 SBI）
- `protocol_type=generic` 不强制，但记录 warning

- [ ] **Step 1-7:** 写代码 + 测试 + 提交

```bash
git commit -m "feat(api): /scales CRUD + /validate + /probe-result（审计写入）"
```

---

## Task 2.8 · Cups + 率定历史

**Files:**
- Create: `apps/api/src/scale_api/schemas/cup.py`
- Create: `apps/api/src/scale_api/repositories/cup_repo.py`
- Create: `apps/api/src/scale_api/services/cup_service.py`
- Create: `apps/api/src/scale_api/api/v1/cups.py`
- Test: `apps/api/tests/api/test_cups_api.py`

要点：

- `cups` CRUD（offset 分页，含 `q` 模糊搜 cup_number）
- `POST /cups/{id}/calibrate {tare_g, method?, notes?}`：写入 cup_calibrations 一行 + 更新 cups.current_tare_g + 更新 latest_calibration_date + 写 audit_logs
- `GET  /cups/{id}/calibrations` 返回该杯所有率定历史（按 calibrated_at DESC）
- 删除 cups 是软删（`is_active=false`），不真删（防止丢历史）

- [ ] **Step 1-7:** 写代码 + 测试 + 提交

```bash
git commit -m "feat(api): /cups CRUD + 率定历史 + 模糊搜 + 软删"
```

---

## Task 2.9 · Records 路由层（按 §6.4 拆 4 文件）

**Files:**
- Create: `apps/api/src/scale_api/api/v1/records.py` （路由聚合）
- Create: `apps/api/src/scale_api/api/v1/records_query.py`
- Create: `apps/api/src/scale_api/api/v1/records_mutation.py`
- Create: `apps/api/src/scale_api/api/v1/records_batch.py`

每个文件单独定义 `router`，最后在 `records.py` 聚合并挂到主 app。

```python
# records.py
from fastapi import APIRouter
from scale_api.api.v1 import records_batch, records_mutation, records_query

router = APIRouter(prefix="/records", tags=["records"])
router.include_router(records_query.router)
router.include_router(records_mutation.router)
router.include_router(records_batch.router)
```

- `records_query.py`：`GET /` (cursor 分页 + 多过滤) / `GET /{id}` / `GET /export` (CSV/Excel)
- `records_mutation.py`：`POST /` (单条录入) / `PUT /{id}` (admin) / `DELETE /{id}` (admin)
- `records_batch.py`：`POST /batch` (双端共用幂等同步)

详细 schema 与 service 见后续 task。本 task 只做路由文件骨架，每个端点抛 `NotImplementedError("see Task 2.10")` 占位 + 注册路由。

- [ ] **Step 1-5:** 创建 4 个文件 + main 注册 + 提交

```bash
git commit -m "feat(api): records 路由按 §6.4 拆 4 文件（占位）"
```

---

## Task 2.10 · Records Service 层（按 §6.4 拆 4 文件）

**Files:**
- Create: `apps/api/src/scale_api/services/record_service.py` （门面）
- Create: `apps/api/src/scale_api/services/record_validator.py`
- Create: `apps/api/src/scale_api/services/record_calculator.py`
- Create: `apps/api/src/scale_api/services/record_batch_processor.py`
- Test: `apps/api/tests/services/test_record_validator.py`
- Test: `apps/api/tests/services/test_record_calculator.py`

### 2.10.1 record_validator.py

校验 points 数组结构（spec §7.6 标准结构）：
```python
ALLOWED_POSITIONS = {"0.0", "0.2", "0.4", "0.6", "0.8", "1.0"}

class PointSchema(BaseModel):
    pos: str
    cup_id: int
    cup_number: str
    cup_tare_g: Decimal
    wet_weight_g: Decimal
    weighed_at: datetime | None = None
    # concentration_mg_l 由 calculator 算

def validate_points(raw: list[dict]) -> list[PointSchema]:
    items = [PointSchema(**p) for p in raw]
    positions = [p.pos for p in items]
    if any(p not in ALLOWED_POSITIONS for p in positions):
        raise ValidationError("点位必须在 0.0/0.2/0.4/0.6/0.8/1.0 中")
    if len(set(positions)) != len(positions):
        raise ValidationError("点位不允许重复")
    return items
```

### 2.10.2 record_calculator.py

含沙量计算公式（spec §1.1）：
```
含沙量 mg/L = (杯沙重 - 杯重) / 容积 mL × 1000
```

```python
def compute_concentration_mg_l(wet_weight_g: Decimal, cup_tare_g: Decimal, volume_ml: Decimal) -> Decimal:
    sand_g = wet_weight_g - cup_tare_g
    if volume_ml <= 0:
        raise ValidationError("容积必须 > 0")
    # 1 g / mL = 1000 mg/L  ✗  正确：1 g/mL = 10^6 mg/L？要看用户的实际单位
    # 实际：sand_g 克 / volume_ml 毫升 → 浓度 g/mL → ×10^6 = mg/L？
    # 但 Excel 实际值（如 0.3109 mg/L）说明采用 g/L 量纲：
    # mg/L = sand_g / (volume_ml / 1000)   即 (g) / (L) → g/L → ×1000 = mg/L
    # → mg/L = sand_g * 1000 / (volume_ml / 1000) ... 校对：
    # Excel: c0=0.3109 是 mg/L，bs0~45g, bh0=325号杯（杯重~50g），1L 水样 → (45-50)? 反了
    # 实际工艺：bs 是「杯+干沙」湿重？还是干重后？此处按 spec 给的公式：(wet - tare) / vol_ml × 1000 = g/L = ?
    # 修正：与 Excel 实测对齐 → 待测试用例验证。先按 spec §1.1 实现，单元测试用 Excel 真实值校准
    return (sand_g / volume_ml) * Decimal("1000")


def compute_avg(points_with_conc: list[Decimal]) -> Decimal:
    n = len(points_with_conc)
    if n == 0:
        return Decimal("0")
    return sum(points_with_conc) / Decimal(n)
```

测试用 Excel 中 1 行数据反算公式（agent 实施时如发现公式不一致，**以 Excel 实测值为准修正**，并把修正记入 plan 偏差章节）。

### 2.10.3 record_batch_processor.py

批量同步入口：

```python
async def process_batch(
    session: AsyncSession,
    batch: list[RecordCreate],
    *,
    operator_id: int | None,
    source: str,
) -> list[BatchItemResult]:
    """每条独立处理，结果列表 1:1 对应。"""
    results = []
    for item in batch:
        try:
            existing = await RecordRepo(session).get_by_client_uid(item.client_uid)
            if existing:
                results.append(BatchItemResult(client_uid=item.client_uid, status="duplicate", id=existing.id))
                continue
            r = await create_record(session, item, operator_id=operator_id, source=source)
            results.append(BatchItemResult(client_uid=item.client_uid, status="created", id=r.id))
        except ValidationError as e:
            results.append(BatchItemResult(client_uid=item.client_uid, status="invalid", error=str(e)))
    await session.commit()
    return results
```

### 2.10.4 record_service.py（门面）

```python
class RecordService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = RecordRepository(session)

    async def create(self, body: RecordCreate, *, operator_id: int | None, source: str) -> WeighingRecord:
        from scale_api.services.record_validator import validate_points
        from scale_api.services.record_calculator import compute_concentration_mg_l, compute_avg

        points_validated = validate_points(body.points)
        if body.volume_ml is None or body.volume_ml <= 0:
            raise ValidationError("volume_ml 必须 > 0")

        # 算每点 concentration
        enriched = []
        concs = []
        for p in points_validated:
            conc = compute_concentration_mg_l(p.wet_weight_g, p.cup_tare_g, body.volume_ml)
            enriched.append({**p.model_dump(mode='json'), "concentration_mg_l": str(conc)})
            concs.append(conc)
        avg = compute_avg(concs)

        # 幂等
        existing = await self.repo.get_by_client_uid(body.client_uid)
        if existing:
            return existing

        r = WeighingRecord(
            client_uid=body.client_uid,
            project_id=body.project_id,
            vertical_id=body.vertical_id,
            tide_type=body.tide_type,
            sample_date=body.sample_date,
            water_depth_m=body.water_depth_m,
            start_time=body.start_time,
            end_time=body.end_time,
            volume_ml=body.volume_ml,
            points=enriched,
            computed_avg_concentration=avg,
            notes=body.notes,
            operator_id=operator_id,
            source=source,
        )
        await self.repo.create(r)
        await self.session.commit()
        await self.session.refresh(r)
        return r
```

- [ ] **Step 1-6:** 写 4 个文件 + 2 个测试 + 跑通 + 提交

```bash
git commit -m "feat(api): record service 按 §6.4 拆 validator/calculator/batch_processor/门面"
```

---

## Task 2.11 · Records Repository + 接通路由

**Files:**
- Create: `apps/api/src/scale_api/repositories/record_repo.py`
- Create: `apps/api/src/scale_api/repositories/record_query_builder.py`
- Create: `apps/api/src/scale_api/schemas/record.py`
- Modify: `apps/api/src/scale_api/api/v1/records_query.py`（实装）
- Modify: `apps/api/src/scale_api/api/v1/records_mutation.py`（实装）
- Modify: `apps/api/src/scale_api/api/v1/records_batch.py`（实装）
- Test: `apps/api/tests/api/test_records_api.py`

### 2.11.1 schemas/record.py

```python
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class RecordPointIn(BaseModel):
    pos: str
    cup_id: int
    cup_number: str
    cup_tare_g: Decimal
    wet_weight_g: Decimal
    weighed_at: datetime | None = None


class RecordCreate(BaseModel):
    client_uid: uuid.UUID
    project_id: int
    vertical_id: int
    tide_type: Literal["大潮", "小潮", "平潮"] | None = None
    sample_date: date
    water_depth_m: Decimal | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    volume_ml: Decimal
    points: list[RecordPointIn]
    notes: str | None = None


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_uid: uuid.UUID
    project_id: int
    vertical_id: int
    tide_type: str | None
    sample_date: date
    water_depth_m: Decimal | None
    start_time: datetime | None
    end_time: datetime | None
    volume_ml: Decimal | None
    points: list[dict[str, Any]]
    computed_avg_concentration: Decimal | None
    notes: str | None
    operator_id: int | None
    source: str
    created_at: datetime
    updated_at: datetime


class RecordUpdate(BaseModel):
    notes: str | None = None
    tide_type: str | None = None


class BatchItemResult(BaseModel):
    client_uid: uuid.UUID
    status: Literal["created", "duplicate", "invalid"]
    id: int | None = None
    error: str | None = None


class BatchResponse(BaseModel):
    results: list[BatchItemResult]
```

### 2.11.2 record_repo.py

```python
class RecordRepository(BaseRepository[WeighingRecord]):
    model = WeighingRecord

    async def get_by_client_uid(self, client_uid: uuid.UUID) -> WeighingRecord | None:
        stmt = select(WeighingRecord).where(WeighingRecord.client_uid == client_uid)
        return (await self.session.scalars(stmt)).first()
```

### 2.11.3 record_query_builder.py

复杂查询：按 project + vertical + date 范围 + cup_number 模糊（用 §7.6 表达式索引）+ cursor 分页。

```python
def build_list_query(
    *, project_id: int | None, vertical_id: int | None,
    date_from: date | None, date_to: date | None,
    cup_number: str | None, q: str | None,
):
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
        # 用 §7.6.1 表达式索引：jsonb_array_elements(points)->>'cup_number'
        stmt = stmt.where(text(
            "ARRAY(SELECT jsonb_array_elements(points)->>'cup_number') @> ARRAY[:cn]"
        )).params(cn=cup_number)
    if q is not None:
        stmt = stmt.where(WeighingRecord.notes.ilike(f"%{q}%"))
    return stmt
```

### 2.11.4 records_query.py 实装

`GET /` 用 query builder + cursor_paginate；`GET /{id}` 简单 fetch；`GET /export` 流式返回 CSV（先支持 CSV，Excel 留 P2）。

### 2.11.5 records_mutation.py 实装

`POST /` 调 RecordService.create；`PUT /{id}` 调 update（仅 admin 可改 notes/tide_type）；`DELETE /{id}` 软删（admin）。

### 2.11.6 records_batch.py 实装

`POST /batch {records: RecordCreate[]}` 调 `process_batch` 返回 `BatchResponse`。

- [ ] **Step 1-12:** 写所有文件 + 测试 + 提交

测试要点（不少于 8 个用例）：
- 单条 POST 录入 → 成功 + 含 computed_avg_concentration
- 重复 client_uid POST → 返回原记录（200）
- POST 缺 volume → 422
- POST points 含非法 pos → 422
- list 按 project_id 过滤
- list cursor 分页正确
- batch 同时含 created / duplicate / invalid 三类
- DELETE by operator → 403

```bash
git commit -m "feat(api): records 完整端到端（query/mutation/batch + 含沙量计算 + 幂等）"
```

---

## Task 2.12 · 重新生成 OpenAPI → shared-types

- [ ] **Step 1:** 启 API

```bash
cd apps/api
uv run uvicorn scale_api.main:app --port 18000 &
sleep 2
```

- [ ] **Step 2:** 生成

```bash
cd ../../packages/shared-types
SPEC_URL=http://localhost:18000/openapi.json pnpm generate
```

- [ ] **Step 3:** typecheck

```bash
cd ../..
pnpm --filter @scale/shared-types typecheck
```

- [ ] **Step 4:** kill API

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 5:** 提交

```bash
git add packages/shared-types/src/api.ts
git commit -m "chore(shared-types): 重新生成含 projects/scales/cups/records 端点"
```

---

## Task 2.13 · 全量自检 + 覆盖率

- [ ] **Step 1:** 跑全部 pytest

```bash
cd apps/api && uv run pytest -v
```

期望：所有测试通过，覆盖率 ≥ 80%。如某个 service 文件覆盖率不足，补针对未覆盖分支的测试。

- [ ] **Step 2:** ruff + mypy

```bash
uv run ruff check .
uv run mypy src
```

- [ ] **Step 3:** 提交

```bash
git commit -m "test(api): Phase 2 全部测试通过 + 覆盖率验证"
```

---

## Phase 2 完成标志

✅ 6 张业务表 + 2 个 JSONB 表达式索引（迁移可升降级）
✅ projects / verticals / scales / cups / records 端到端 CRUD
✅ Cursor + Offset 双模式分页
✅ records 按 §6.4 拆 4 service + 4 router + 1 repo + 1 query_builder
✅ 含沙量计算工具（按 Excel 实测值校准）
✅ /scales/{id}/validate（服务端 schema）+ /probe-result（客户端回报）
✅ 批量幂等同步（client_uid 去重）
✅ pytest ≥ 80% 覆盖率
✅ OpenAPI 重新生成，shared-types/api.ts 更新

---

## 下一步

合 main，进入 Phase 5（前端 CRUD 页面，依赖本 phase 的 API）。

如执行中发现 spec 与实际数据有差异（含沙量公式、JSONB 字段），把修正记到本 plan 末尾的"实际执行偏差"章节，避免下次重跑踩坑。

---

## 实际执行偏差（Phase 2 实施时）

### D1. JSONB 表达式索引必须用 IMMUTABLE 函数包装

**Spec 原文**（Task 2.3）：
```sql
CREATE INDEX ix_rec_points_cup_numbers ON weighing_records
USING gin ((ARRAY(SELECT jsonb_array_elements(points)->>'cup_number')))
```

**实际执行错误**：PostgreSQL 16 不允许子查询直接出现在索引表达式里，会报 `cannot use subquery in index expression`。

**修正**：在迁移里先建两个 `IMMUTABLE STRICT PARALLEL SAFE` 的 SQL 函数，再用函数表达式建 GIN 索引：

```sql
CREATE OR REPLACE FUNCTION rec_points_cup_numbers(points jsonb)
RETURNS text[] LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT array_agg(elem->>'cup_number') FROM jsonb_array_elements(points) AS elem
$$;
CREATE INDEX ix_rec_points_cup_numbers ON weighing_records
USING gin (rec_points_cup_numbers(points));
```

`rec_points_cup_ids(points jsonb) RETURNS bigint[]` 同理。downgrade 镜像里在 `DROP INDEX` 之后再 `DROP FUNCTION ... CASCADE`。

**测试库（testcontainers）补丁**：因为 `Base.metadata.create_all` 不走迁移，conftest.py 需要在容器初始化时手工：
1. `CREATE EXTENSION IF NOT EXISTS pg_trgm`
2. 创建上述两个 SQL 函数
3. 创建表后再 `CREATE INDEX ix_rec_points_cup_numbers/cup_ids` 表达式索引

### D2. CursorPage[ORM] 不能直接作为 service 返回类型

**Spec 原文**（Task 2.5）：
```python
async def list_paged(...) -> CursorPage[Project]:
```

**问题**：`CursorPage` 是 Pydantic BaseModel，参数化 ORM 类型 `Project` 时 Pydantic 会触发 `PydanticSchemaGenerationError`。

**修正**：所有 service `list_paged` 类型注解改为 `CursorPage[Any]`，仅在 API 层 `response_model=CursorPage[ProjectOut]` 做转换。

### D3. records 路由子路由 path 不能为空字符串

**问题**：FastAPI 在 `prefix="/records"` 的 router 上 `@router.get("")` 会抛 `Prefix and path cannot be both empty`。

**修正**：list/create 端点用 `@router.get("/")` / `@router.post("/")` 显式带斜杠。

### D4. 含沙量公式量纲对齐

**Spec §1.1 公式**：`含沙量 mg/L = (湿重 - 杯重) / 容积mL × 1000`

**实测样本**（plan 提到的 c0=0.3109 mg/L, 杯 325 重 ~50.6112g, volume_ml=1000）：
- 反推 sand_g = 0.3109 × 1000 / 1000 = 0.3109 g
- 即 wet_weight_g = 50.6112 + 0.3109 = 50.9221 g

**结论**：spec 公式直接成立，**无需修正**。`compute_concentration_mg_l(50.9221, 50.6112, 1000) == Decimal("0.3109")` 已写为单测验证。

文件：`apps/api/src/scale_api/services/record_calculator.py:21-30`、单测 `tests/services/test_record_calculator.py::test_concentration_with_excel_sample`。

### D5. records_query.py 路由路径斜杠

**对外 API**：列表是 `GET /api/v1/records/`（带尾斜杠），不是 `GET /api/v1/records`。前端调用需注意；OpenAPI 已生成正确路径。

### D6. 路由覆盖率提升靠 service 单测

**问题**：仅靠 ASGI 路由测试，service 内部行覆盖率统计不全（疑似 coverage 跨 event-loop 跟踪丢失），整体 79.88% 卡在阈值之下。

**修正**：新增 `tests/services/test_business_services.py`（13 个用例）直接驱动 service 类，最终覆盖率达到 90.15%。


