# Phase 1 · 后端骨架（认证 + DB + 用户）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans。前置：Phase 0 已完成。Worktree：`../scale-system-be-skeleton` 分支 `phase-1/backend-skeleton`。

**Goal:** 后端 4 层架构落地，DB schema + Alembic 迁移就位，JWT 认证 + refresh 轮换 + 用户 CRUD 端到端可工作。

**Architecture:** SQLAlchemy 2 异步 + Alembic + asyncpg；4 层（api → service → repository → model）；JWT access + refresh 轮换 + reuse 检测。

**Tech Stack:** FastAPI 0.115 / SQLAlchemy 2.0 / asyncpg / Alembic / Pydantic v2 / passlib + bcrypt / python-jose

---

## Task 1.1 · 配置层 + 数据库会话

**Files:**
- Create: `apps/api/src/scale_api/core/__init__.py`
- Create: `apps/api/src/scale_api/core/config.py`
- Create: `apps/api/src/scale_api/db/__init__.py`
- Create: `apps/api/src/scale_api/db/session.py`
- Test: `apps/api/tests/test_config.py`

- [ ] **Step 1:** 测试 `tests/test_config.py`

```python
"""配置层测试."""
import pytest
from scale_api.core.config import Settings


def test_settings_loads_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@host/db")
    monkeypatch.setenv("JWT_SECRET", "x" * 32)
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://a.com,http://b.com")
    s = Settings()
    assert s.database_url == "postgresql+asyncpg://u:p@host/db"
    assert s.allowed_origins == ["http://a.com", "http://b.com"]
    assert s.access_token_ttl_minutes == 30  # 默认值


def test_settings_rejects_short_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "tooshort")
    monkeypatch.setenv("DATABASE_URL", "x")
    with pytest.raises(ValueError, match="JWT_SECRET"):
        Settings()
```

- [ ] **Step 2:** 跑测试，fail。

- [ ] **Step 3:** 实现 `core/config.py`

```python
"""应用配置（pydantic-settings）."""
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = Field(..., description="postgresql+asyncpg://...")
    jwt_secret: str = Field(..., min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 30
    refresh_token_ttl_days: int = 7
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])
    app_env: str = "development"
    log_level: str = "INFO"

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    @field_validator("jwt_secret")
    @classmethod
    def _check_jwt_secret(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET 必须至少 32 字符")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
```

- [ ] **Step 4:** 测试 pass。

- [ ] **Step 5:** 写 `db/session.py`

```python
"""异步 SQLAlchemy session."""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from scale_api.core.config import get_settings


def make_engine(url: str | None = None) -> AsyncEngine:
    settings = get_settings()
    return create_async_engine(
        url or settings.database_url,
        echo=settings.app_env == "development",
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )


_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def _ensure_engine() -> async_sessionmaker[AsyncSession]:
    global _engine, _sessionmaker
    if _sessionmaker is None:
        _engine = make_engine()
        _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)
    return _sessionmaker


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    sm = _ensure_engine()
    async with sm() as session:
        yield session
```

- [ ] **Step 6:** 提交

```bash
git add apps/api/src/scale_api/core apps/api/src/scale_api/db apps/api/tests/test_config.py
git commit -m "feat(api): 配置层 + 异步 SQLAlchemy session"
```

---

## Task 1.2 · 模型层基础（base + mixin + user + refresh_token + audit_log）

**Files:**
- Create: `apps/api/src/scale_api/models/__init__.py`
- Create: `apps/api/src/scale_api/models/base.py`
- Create: `apps/api/src/scale_api/models/user.py`
- Create: `apps/api/src/scale_api/models/refresh_token.py`
- Create: `apps/api/src/scale_api/models/audit_log.py`

- [ ] **Step 1:** 写 `models/base.py`

```python
"""SQLAlchemy declarative base + mixin."""
from datetime import datetime

from sqlalchemy import DateTime, MetaData, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
```

- [ ] **Step 2:** 写 `models/user.py`

```python
"""User 模型."""
from sqlalchemy import Boolean, CheckConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from scale_api.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('operator','admin')", name="role_valid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(128), unique=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="operator")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
```

- [ ] **Step 3:** 写 `models/refresh_token.py`

```python
"""Refresh token 模型（哈希 + 轮换）."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import INET, UUID
from sqlalchemy.orm import Mapped, mapped_column

from scale_api.models.base import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    jti: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    token_hash: Mapped[str] = mapped_column(String, nullable=False)
    client_kind: Mapped[str] = mapped_column(String(8), nullable=False)  # 'web'|'desktop'
    user_agent: Mapped[str | None] = mapped_column(String)
    ip_address: Mapped[str | None] = mapped_column(INET)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rotated_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    __table_args__ = (
        Index(
            "ix_rtok_user_active",
            "user_id",
            postgresql_where="revoked_at IS NULL",
        ),
    )
```

- [ ] **Step 4:** 写 `models/audit_log.py`

```python
"""审计日志."""
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from scale_api.models.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    entity: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_id: Mapped[int | None] = mapped_column()
    before: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    after: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
```

- [ ] **Step 5:** 写 `models/__init__.py`

```python
"""ORM 模型导出（供 Alembic autogenerate 扫描）."""
from scale_api.models.audit_log import AuditLog
from scale_api.models.base import Base
from scale_api.models.refresh_token import RefreshToken
from scale_api.models.user import User

__all__ = ["AuditLog", "Base", "RefreshToken", "User"]
```

- [ ] **Step 6:** 提交

```bash
git add apps/api/src/scale_api/models
git commit -m "feat(api): users / refresh_tokens / audit_logs 模型"
```

---

## Task 1.3 · Alembic 初始化 + 首迁移

**Files:**
- Create: `apps/api/alembic.ini`
- Create: `apps/api/alembic/env.py`
- Create: `apps/api/alembic/script.py.mako`
- Create: `apps/api/alembic/versions/` （空目录）

- [ ] **Step 1:** 跑

```bash
cd apps/api
uv run alembic init -t async alembic
```

- [ ] **Step 2:** 改 `alembic.ini` 关键项

```ini
[alembic]
script_location = alembic
sqlalchemy.url =   ; 留空，env.py 从 settings 读
file_template = %%(year)d%%(month).2d%%(day).2d_%%(hour).2d%%(minute).2d_%%(slug)s
```

- [ ] **Step 3:** 改 `alembic/env.py`

```python
"""Alembic 环境（异步 + 从 settings 读 URL）."""
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from scale_api.core.config import get_settings
from scale_api.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _sync_url() -> str:
    """alembic offline 不能用 asyncpg，需要同步 URL."""
    return get_settings().database_url.replace("+asyncpg", "+psycopg")


def run_migrations_offline() -> None:
    context.configure(
        url=_sync_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    cfg = config.get_section(config.config_ini_section) or {}
    cfg["sqlalchemy.url"] = get_settings().database_url
    engine = async_engine_from_config(cfg, prefix="sqlalchemy.")
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 4:** 加 psycopg 到 dev 依赖（offline 模式需要）

```bash
uv add --dev psycopg[binary]
```

- [ ] **Step 5:** 启动 PG（如果没起）

```bash
docker compose -f ../../docker/docker-compose.yml up -d pg
```

- [ ] **Step 6:** 生成首版迁移

```bash
cd apps/api
cp .env.example .env
uv run alembic revision --autogenerate -m "initial: users + refresh_tokens + audit_logs"
```

- [ ] **Step 7:** 检查生成的迁移文件，确认包含三张表 + 必要索引。

- [ ] **Step 8:** 应用迁移

```bash
uv run alembic upgrade head
```

- [ ] **Step 9:** 验证表结构

```bash
docker compose -f ../../docker/docker-compose.yml exec pg \
  psql -U scale -d scale_system -c "\dt"
```

期望：4 张表（含 `alembic_version`）。

- [ ] **Step 10:** 提交

```bash
git add apps/api/alembic.ini apps/api/alembic/ apps/api/pyproject.toml
git commit -m "feat(api): Alembic 异步初始化 + 首版迁移"
```

---

## Task 1.4 · 异常体系 + 安全工具（密码哈希 + JWT）

**Files:**
- Create: `apps/api/src/scale_api/core/exceptions.py`
- Create: `apps/api/src/scale_api/core/security.py`
- Test: `apps/api/tests/test_security.py`

- [ ] **Step 1:** 写测试 `tests/test_security.py`

```python
"""安全工具测试."""
import pytest

from scale_api.core.security import (
    InvalidTokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


def test_password_round_trip() -> None:
    h = hash_password("s3cret!")
    assert h != "s3cret!"
    assert verify_password("s3cret!", h)
    assert not verify_password("wrong", h)


def test_access_token_round_trip() -> None:
    token = create_access_token(user_id=1, role="operator")
    payload = decode_token(token)
    assert payload["sub"] == "1"
    assert payload["role"] == "operator"
    assert payload["type"] == "access"


def test_refresh_token_includes_jti() -> None:
    token, jti = create_refresh_token(user_id=1)
    payload = decode_token(token)
    assert payload["sub"] == "1"
    assert payload["type"] == "refresh"
    assert payload["jti"] == str(jti)


def test_decode_invalid_token_raises() -> None:
    with pytest.raises(InvalidTokenError):
        decode_token("not.a.token")


def test_hash_refresh_token_is_deterministic() -> None:
    assert hash_refresh_token("abc") == hash_refresh_token("abc")
    assert hash_refresh_token("abc") != hash_refresh_token("abd")
```

- [ ] **Step 2:** 跑测试，fail。

- [ ] **Step 3:** 写 `core/exceptions.py`

```python
"""业务异常 → HTTP 响应."""
from typing import Any


class BusinessError(Exception):
    code: str = "BUSINESS_ERROR"
    http_status: int = 400

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(BusinessError):
    code = "NOT_FOUND"
    http_status = 404


class ValidationError(BusinessError):
    code = "VALIDATION_ERROR"
    http_status = 422


class ConflictError(BusinessError):
    code = "CONFLICT"
    http_status = 409


class AuthenticationError(BusinessError):
    code = "AUTHENTICATION_FAILED"
    http_status = 401


class AuthorizationError(BusinessError):
    code = "FORBIDDEN"
    http_status = 403


class InvalidTokenError(AuthenticationError):
    code = "INVALID_TOKEN"


class TokenReuseError(AuthenticationError):
    code = "TOKEN_REUSE"
```

- [ ] **Step 4:** 写 `core/security.py`

```python
"""密码哈希 + JWT。"""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from scale_api.core.config import get_settings
from scale_api.core.exceptions import InvalidTokenError

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_ctx.verify(plain, hashed)


def hash_refresh_token(token: str) -> str:
    """SHA-256 哈希（用于入库，避免存原 token）。"""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(user_id: int, role: str) -> str:
    s = get_settings()
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "iat": int(_now().timestamp()),
        "exp": int((_now() + timedelta(minutes=s.access_token_ttl_minutes)).timestamp()),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def create_refresh_token(user_id: int) -> tuple[str, uuid.UUID]:
    s = get_settings()
    jti = uuid.uuid4()
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": str(jti),
        "iat": int(_now().timestamp()),
        "exp": int((_now() + timedelta(days=s.refresh_token_ttl_days)).timestamp()),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm), jti


def decode_token(token: str) -> dict[str, Any]:
    s = get_settings()
    try:
        return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except JWTError as e:
        raise InvalidTokenError(f"token 无效: {e}") from e
```

- [ ] **Step 5:** 测试 pass。

- [ ] **Step 6:** 提交

```bash
git add apps/api/src/scale_api/core/exceptions.py apps/api/src/scale_api/core/security.py apps/api/tests/test_security.py
git commit -m "feat(api): 业务异常体系 + 密码 bcrypt + JWT 工具"
```

---

## Task 1.5 · Repository 基类 + UserRepo + RefreshTokenRepo

**Files:**
- Create: `apps/api/src/scale_api/repositories/__init__.py`
- Create: `apps/api/src/scale_api/repositories/base.py`
- Create: `apps/api/src/scale_api/repositories/user_repo.py`
- Create: `apps/api/src/scale_api/repositories/refresh_token_repo.py`
- Test: `apps/api/tests/conftest.py`
- Test: `apps/api/tests/repositories/test_user_repo.py`

- [ ] **Step 1:** 写 `tests/conftest.py`

```python
"""Pytest fixtures: testcontainers PG + async session."""
from collections.abc import AsyncGenerator

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from testcontainers.postgres import PostgresContainer

from scale_api.models import Base


@pytest_asyncio.fixture(scope="session")
async def pg_container():
    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg


@pytest_asyncio.fixture(scope="session")
async def engine(pg_container):
    url = pg_container.get_connection_url().replace("psycopg2", "asyncpg")
    eng = create_async_engine(url, echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def session(engine) -> AsyncGenerator[AsyncSession, None]:
    sm = async_sessionmaker(engine, expire_on_commit=False)
    async with sm() as s:
        yield s
        await s.rollback()
```

- [ ] **Step 2:** 写测试 `tests/repositories/test_user_repo.py`

```python
"""UserRepository 测试."""
import pytest

from scale_api.models.user import User
from scale_api.repositories.user_repo import UserRepository


@pytest.mark.asyncio
async def test_create_and_get_by_username(session) -> None:
    repo = UserRepository(session)
    u = await repo.create(User(username="alice", password_hash="h", role="operator"))
    await session.commit()
    assert u.id is not None

    found = await repo.get_by_username("alice")
    assert found is not None
    assert found.id == u.id


@pytest.mark.asyncio
async def test_get_by_username_returns_none_when_missing(session) -> None:
    repo = UserRepository(session)
    assert await repo.get_by_username("nope") is None
```

- [ ] **Step 3:** 跑测试，fail。

- [ ] **Step 4:** 写 `repositories/base.py`

```python
"""仓储基类。"""
from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.base import Base

T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    model: type[T]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, entity_id: int) -> T | None:
        return await self.session.get(self.model, entity_id)

    async def create(self, entity: T) -> T:
        self.session.add(entity)
        await self.session.flush()
        return entity

    async def list_all(self, limit: int = 100) -> list[T]:
        stmt = select(self.model).limit(limit)
        result = await self.session.scalars(stmt)
        return list(result.all())
```

- [ ] **Step 5:** 写 `repositories/user_repo.py`

```python
"""User 仓储。"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.user import User
from scale_api.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_by_username(self, username: str) -> User | None:
        stmt = select(User).where(User.username == username)
        return (await self.session.scalars(stmt)).first()

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        return (await self.session.scalars(stmt)).first()
```

- [ ] **Step 6:** 写 `repositories/refresh_token_repo.py`

```python
"""Refresh token 仓储。"""
import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.refresh_token import RefreshToken
from scale_api.repositories.base import BaseRepository


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    model = RefreshToken

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_by_jti(self, jti: uuid.UUID) -> RefreshToken | None:
        stmt = select(RefreshToken).where(RefreshToken.jti == jti)
        return (await self.session.scalars(stmt)).first()

    async def revoke(self, rt: RefreshToken, *, rotated_to: uuid.UUID | None) -> None:
        rt.revoked_at = datetime.utcnow()
        rt.rotated_to = rotated_to
        await self.session.flush()

    async def revoke_all_for_user(self, user_id: int) -> None:
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.utcnow())
        )
        await self.session.execute(stmt)
```

- [ ] **Step 7:** 跑测试 pass。

- [ ] **Step 8:** 提交

```bash
git add apps/api/src/scale_api/repositories apps/api/tests/conftest.py apps/api/tests/repositories
git commit -m "feat(api): Repository 基类 + UserRepo + RefreshTokenRepo"
```

---

## Task 1.6 · Schemas 层（DTO）

**Files:**
- Create: `apps/api/src/scale_api/schemas/__init__.py`
- Create: `apps/api/src/scale_api/schemas/common.py`
- Create: `apps/api/src/scale_api/schemas/user.py`
- Create: `apps/api/src/scale_api/schemas/auth.py`

- [ ] **Step 1:** 写 `schemas/common.py`

```python
"""通用 schemas（错误结构、分页）。"""
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorBody


class CursorPage(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None


class OffsetPage(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
```

- [ ] **Step 2:** 写 `schemas/user.py`

```python
"""User schemas。"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

UserRole = Literal["operator", "admin"]


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: EmailStr | None = None
    role: UserRole = "operator"


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 3:** 写 `schemas/auth.py`

```python
"""Auth schemas。"""
from pydantic import BaseModel, Field

from scale_api.schemas.user import UserOut


class LoginRequest(BaseModel):
    username: str
    password: str
    client_kind: str = Field(default="web", pattern="^(web|desktop)$")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
    # refresh_token 仅 desktop 客户端拿到 body；web 通过 set-cookie
    refresh_token: str | None = None


class RefreshRequest(BaseModel):
    """desktop 用 body 发；web 浏览器自动带 cookie，body 仅含 csrf_token."""

    refresh_token: str | None = None
    csrf_token: str | None = None
```

- [ ] **Step 4:** 提交

```bash
git add apps/api/src/scale_api/schemas
git commit -m "feat(api): User / Auth / 通用 Pydantic schemas"
```

---

## Task 1.7 · AuthService（带 refresh 轮换 + reuse 检测）

**Files:**
- Create: `apps/api/src/scale_api/services/__init__.py`
- Create: `apps/api/src/scale_api/services/auth_service.py`
- Test: `apps/api/tests/services/test_auth_service.py`

- [ ] **Step 1:** 写测试 `tests/services/test_auth_service.py`

```python
"""AuthService 测试（含 refresh 轮换 + reuse 检测）。"""
import pytest

from scale_api.core.exceptions import AuthenticationError, TokenReuseError
from scale_api.core.security import hash_password
from scale_api.models.user import User
from scale_api.services.auth_service import AuthService


@pytest.fixture
async def alice(session) -> User:
    u = User(username="alice", password_hash=hash_password("s3cret!"), role="operator")
    session.add(u)
    await session.commit()
    await session.refresh(u)
    return u


@pytest.mark.asyncio
async def test_login_returns_tokens(session, alice) -> None:
    svc = AuthService(session)
    out = await svc.login(username="alice", password="s3cret!", client_kind="web", ua=None, ip=None)
    assert out.access_token
    assert out.refresh_token
    assert out.user.username == "alice"


@pytest.mark.asyncio
async def test_login_wrong_password_raises(session, alice) -> None:
    svc = AuthService(session)
    with pytest.raises(AuthenticationError):
        await svc.login(username="alice", password="wrong", client_kind="web", ua=None, ip=None)


@pytest.mark.asyncio
async def test_refresh_rotates_token(session, alice) -> None:
    svc = AuthService(session)
    out1 = await svc.login(username="alice", password="s3cret!", client_kind="web", ua=None, ip=None)
    out2 = await svc.refresh(out1.refresh_token or "", client_kind="web", ua=None, ip=None)
    assert out2.refresh_token != out1.refresh_token


@pytest.mark.asyncio
async def test_refresh_reuse_revokes_all(session, alice) -> None:
    svc = AuthService(session)
    out1 = await svc.login(username="alice", password="s3cret!", client_kind="web", ua=None, ip=None)
    await svc.refresh(out1.refresh_token or "", client_kind="web", ua=None, ip=None)
    # 用旧 refresh token 再换 → 触发 reuse
    with pytest.raises(TokenReuseError):
        await svc.refresh(out1.refresh_token or "", client_kind="web", ua=None, ip=None)
```

- [ ] **Step 2:** 跑测试，fail。

- [ ] **Step 3:** 实现 `services/auth_service.py`

```python
"""认证服务（登录 + refresh 轮换 + reuse 检测）。"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.core.config import get_settings
from scale_api.core.exceptions import AuthenticationError, InvalidTokenError, TokenReuseError
from scale_api.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_refresh_token,
    verify_password,
)
from scale_api.models.refresh_token import RefreshToken
from scale_api.repositories.refresh_token_repo import RefreshTokenRepository
from scale_api.repositories.user_repo import UserRepository
from scale_api.schemas.auth import TokenResponse
from scale_api.schemas.user import UserOut


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)
        self.tokens = RefreshTokenRepository(session)

    async def login(
        self, *, username: str, password: str, client_kind: str, ua: str | None, ip: str | None,
    ) -> TokenResponse:
        u = await self.users.get_by_username(username)
        if u is None or not u.is_active or not verify_password(password, u.password_hash):
            raise AuthenticationError("用户名或密码错误")

        return await self._issue(user_id=u.id, role=u.role, user=u, client_kind=client_kind, ua=ua, ip=ip)

    async def refresh(
        self, refresh_token: str, *, client_kind: str, ua: str | None, ip: str | None,
    ) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
        except InvalidTokenError as e:
            raise AuthenticationError("refresh token 无效") from e
        if payload.get("type") != "refresh":
            raise AuthenticationError("token 类型错误")

        jti = uuid.UUID(payload["jti"])
        db_token = await self.tokens.get_by_jti(jti)
        if db_token is None:
            raise AuthenticationError("refresh token 不存在")

        # reuse 检测：已 revoke 的又被用了
        if db_token.revoked_at is not None:
            await self.tokens.revoke_all_for_user(db_token.user_id)
            await self.session.commit()
            raise TokenReuseError("检测到 refresh token 重放，已吊销该用户所有会话")

        if hash_refresh_token(refresh_token) != db_token.token_hash:
            raise AuthenticationError("token 哈希不匹配")

        u = await self.users.get(db_token.user_id)
        if u is None or not u.is_active:
            raise AuthenticationError("用户不可用")

        # 轮换
        new = await self._issue(user_id=u.id, role=u.role, user=u, client_kind=client_kind, ua=ua, ip=ip)
        await self.tokens.revoke(db_token, rotated_to=uuid.UUID(decode_token(new.refresh_token or "")["jti"]))
        await self.session.commit()
        return new

    async def _issue(
        self, *, user_id: int, role: str, user, client_kind: str, ua: str | None, ip: str | None,
    ) -> TokenResponse:
        s = get_settings()
        access = create_access_token(user_id=user_id, role=role)
        refresh, jti = create_refresh_token(user_id=user_id)
        rt = RefreshToken(
            jti=jti,
            user_id=user_id,
            token_hash=hash_refresh_token(refresh),
            client_kind=client_kind,
            user_agent=ua,
            ip_address=ip,
            issued_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(days=s.refresh_token_ttl_days),
        )
        await self.tokens.create(rt)
        await self.session.commit()
        return TokenResponse(
            access_token=access,
            expires_in=s.access_token_ttl_minutes * 60,
            user=UserOut.model_validate(user),
            refresh_token=refresh,
        )
```

- [ ] **Step 4:** 测试 pass。

- [ ] **Step 5:** 提交

```bash
git add apps/api/src/scale_api/services apps/api/tests/services
git commit -m "feat(api): AuthService 含 refresh 轮换与 reuse 检测"
```

---

## Task 1.8 · Auth API + 依赖注入

**Files:**
- Create: `apps/api/src/scale_api/api/__init__.py`
- Create: `apps/api/src/scale_api/api/v1/__init__.py`
- Create: `apps/api/src/scale_api/api/deps.py`
- Create: `apps/api/src/scale_api/api/v1/auth.py`
- Modify: `apps/api/src/scale_api/main.py`
- Test: `apps/api/tests/api/test_auth_api.py`

- [ ] **Step 1:** 写 `api/deps.py`

```python
"""FastAPI 依赖：DB session、当前用户、admin 守卫。"""
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.core.exceptions import AuthorizationError, InvalidTokenError
from scale_api.core.security import decode_token
from scale_api.db.session import get_session
from scale_api.models.user import User
from scale_api.repositories.user_repo import UserRepository

DBSession = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(
    session: DBSession,
    authorization: str | None = Header(default=None),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise InvalidTokenError("缺少 Authorization header")
    token = authorization[7:]
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise InvalidTokenError("token 类型错误")
    user = await UserRepository(session).get(int(payload["sub"]))
    if user is None or not user.is_active:
        raise InvalidTokenError("用户不可用")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_admin(user: CurrentUser) -> User:
    if user.role != "admin":
        raise AuthorizationError("需要管理员权限")
    return user


AdminUser = Annotated[User, Depends(require_admin)]
```

- [ ] **Step 2:** 写 `api/v1/auth.py`

```python
"""认证端点。"""
from fastapi import APIRouter, Request, Response

from scale_api.api.deps import CurrentUser, DBSession
from scale_api.schemas.auth import LoginRequest, RefreshRequest, TokenResponse
from scale_api.schemas.user import UserOut
from scale_api.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, response: Response, session: DBSession) -> TokenResponse:
    svc = AuthService(session)
    out = await svc.login(
        username=body.username,
        password=body.password,
        client_kind=body.client_kind,
        ua=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )
    if body.client_kind == "web":
        # web 端 refresh 走 cookie，不放 body
        response.set_cookie(
            key="__Host-refresh",
            value=out.refresh_token or "",
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="strict",
            path="/api/v1/auth/refresh",
            max_age=60 * 60 * 24 * 7,
        )
        out = out.model_copy(update={"refresh_token": None})
    return out


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, request: Request, response: Response, session: DBSession) -> TokenResponse:
    rt = body.refresh_token or request.cookies.get("__Host-refresh", "")
    client_kind = "desktop" if body.refresh_token else "web"
    svc = AuthService(session)
    out = await svc.refresh(
        rt,
        client_kind=client_kind,
        ua=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )
    if client_kind == "web":
        response.set_cookie(
            key="__Host-refresh",
            value=out.refresh_token or "",
            httponly=True,
            secure=request.url.scheme == "https",
            samesite="strict",
            path="/api/v1/auth/refresh",
            max_age=60 * 60 * 24 * 7,
        )
        out = out.model_copy(update={"refresh_token": None})
    return out


@router.post("/logout")
async def logout(response: Response, user: CurrentUser, session: DBSession) -> dict[str, str]:
    from scale_api.repositories.refresh_token_repo import RefreshTokenRepository
    await RefreshTokenRepository(session).revoke_all_for_user(user.id)
    await session.commit()
    response.delete_cookie("__Host-refresh", path="/api/v1/auth/refresh")
    return {"status": "logged_out"}


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
```

- [ ] **Step 3:** 改 `main.py` 接入路由 + 异常处理 + CORS

```python
"""FastAPI 应用入口."""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from scale_api.api.v1 import auth as auth_v1
from scale_api.core.config import get_settings
from scale_api.core.exceptions import BusinessError

settings = get_settings()

app = FastAPI(
    title="Scale API",
    version="0.1.0",
    description="天平称重系统后端",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(BusinessError)
async def _biz_handler(_: Request, exc: BusinessError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.http_status,
        content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "scale-api"}


app.include_router(auth_v1.router, prefix="/api/v1")
```

- [ ] **Step 4:** 写测试 `tests/api/test_auth_api.py`

```python
"""Auth API 端到端测试。"""
import pytest
from httpx import ASGITransport, AsyncClient

from scale_api.core.security import hash_password
from scale_api.main import app
from scale_api.models.user import User


@pytest.fixture
async def client(session):
    """覆写 get_session 让 API 用 test session."""
    from scale_api.api.deps import get_session

    async def _override():
        yield session

    app.dependency_overrides[get_session] = _override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def alice(session):
    u = User(username="alice", password_hash=hash_password("s3cret!"), role="admin")
    session.add(u)
    await session.commit()
    return u


@pytest.mark.asyncio
async def test_login_then_me(client, alice):
    r = await client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "s3cret!", "client_kind": "desktop"},
    )
    assert r.status_code == 200
    token = r.json()["access_token"]

    r2 = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    assert r2.json()["username"] == "alice"


@pytest.mark.asyncio
async def test_login_bad_password(client, alice):
    r = await client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "wrong", "client_kind": "web"},
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "AUTHENTICATION_FAILED"
```

- [ ] **Step 5:** 跑全部测试

```bash
cd apps/api
uv run pytest -v
```

期望：全部 pass，覆盖率 ≥ 80%。

- [ ] **Step 6:** 启动验证

```bash
uv run uvicorn scale_api.main:app --reload --port 8000 &
sleep 2
curl http://localhost:8000/health
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"s3cret!","client_kind":"desktop"}'
kill %1
```

- [ ] **Step 7:** 提交

```bash
git add apps/api/src/scale_api/api apps/api/src/scale_api/main.py apps/api/tests/api
git commit -m "feat(api): /auth/{login,refresh,logout,me} 端到端 + Bearer/Cookie 双策略"
```

---

## Task 1.9 · Users API（管理员专用）

**Files:**
- Create: `apps/api/src/scale_api/api/v1/users.py`
- Create: `apps/api/src/scale_api/services/user_service.py`
- Test: `apps/api/tests/api/test_users_api.py`

- [ ] **Step 1:** 写测试

```python
"""Users API 测试。"""
import pytest


@pytest.mark.asyncio
async def test_admin_can_create_user(client, alice):
    # alice 是 admin（fixture）
    login = await client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "s3cret!", "client_kind": "desktop"},
    )
    token = login.json()["access_token"]

    r = await client.post(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {token}"},
        json={"username": "bob", "password": "abcdefgh", "role": "operator"},
    )
    assert r.status_code == 201
    assert r.json()["username"] == "bob"
    assert r.json()["role"] == "operator"


@pytest.mark.asyncio
async def test_operator_cannot_create_user(client, session):
    from scale_api.core.security import hash_password
    from scale_api.models.user import User
    op = User(username="op", password_hash=hash_password("12345678"), role="operator")
    session.add(op)
    await session.commit()
    login = await client.post(
        "/api/v1/auth/login",
        json={"username": "op", "password": "12345678", "client_kind": "desktop"},
    )
    token = login.json()["access_token"]
    r = await client.post(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {token}"},
        json={"username": "x", "password": "abcdefgh", "role": "operator"},
    )
    assert r.status_code == 403
```

- [ ] **Step 2:** 实现 `services/user_service.py`

```python
"""User 服务（CRUD 业务逻辑）。"""
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.core.exceptions import ConflictError, NotFoundError
from scale_api.core.security import hash_password
from scale_api.models.user import User
from scale_api.repositories.user_repo import UserRepository
from scale_api.schemas.user import UserCreate, UserUpdate


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = UserRepository(session)

    async def create(self, body: UserCreate) -> User:
        if await self.repo.get_by_username(body.username):
            raise ConflictError(f"用户名 {body.username} 已存在")
        u = User(
            username=body.username,
            email=body.email,
            password_hash=hash_password(body.password),
            role=body.role,
            is_active=True,
        )
        await self.repo.create(u)
        await self.session.commit()
        await self.session.refresh(u)
        return u

    async def update(self, user_id: int, body: UserUpdate) -> User:
        u = await self.repo.get(user_id)
        if u is None:
            raise NotFoundError(f"用户 {user_id} 不存在")
        if body.email is not None:
            u.email = body.email
        if body.role is not None:
            u.role = body.role
        if body.is_active is not None:
            u.is_active = body.is_active
        if body.password is not None:
            u.password_hash = hash_password(body.password)
        await self.session.commit()
        await self.session.refresh(u)
        return u

    async def delete(self, user_id: int) -> None:
        u = await self.repo.get(user_id)
        if u is None:
            raise NotFoundError(f"用户 {user_id} 不存在")
        u.is_active = False
        await self.session.commit()

    async def list_all(self) -> list[User]:
        return await self.repo.list_all(limit=200)
```

- [ ] **Step 3:** 实现 `api/v1/users.py`

```python
"""Users 管理 API（仅 admin）。"""
from fastapi import APIRouter, status

from scale_api.api.deps import AdminUser, DBSession
from scale_api.schemas.user import UserCreate, UserOut, UserUpdate
from scale_api.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(_: AdminUser, session: DBSession) -> list[UserOut]:
    items = await UserService(session).list_all()
    return [UserOut.model_validate(u) for u in items]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(body: UserCreate, _: AdminUser, session: DBSession) -> UserOut:
    u = await UserService(session).create(body)
    return UserOut.model_validate(u)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(user_id: int, body: UserUpdate, _: AdminUser, session: DBSession) -> UserOut:
    u = await UserService(session).update(user_id, body)
    return UserOut.model_validate(u)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, _: AdminUser, session: DBSession) -> None:
    await UserService(session).delete(user_id)
```

- [ ] **Step 4:** 在 `main.py` 注册路由

```python
from scale_api.api.v1 import users as users_v1
app.include_router(users_v1.router, prefix="/api/v1")
```

- [ ] **Step 5:** 跑测试 pass

- [ ] **Step 6:** 提交

```bash
git add apps/api/src/scale_api/api/v1/users.py apps/api/src/scale_api/services/user_service.py apps/api/src/scale_api/main.py apps/api/tests/api/test_users_api.py
git commit -m "feat(api): /users CRUD（仅 admin）"
```

---

## Task 1.10 · OpenAPI 导出 + 共享类型生成

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Modify: `packages/shared-types/package.json`
- Create: `packages/shared-types/scripts/generate.sh`

- [ ] **Step 1:** 写 `packages/shared-types/scripts/generate.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

SPEC_URL="${SPEC_URL:-http://localhost:8000/openapi.json}"
OUT="src/api.ts"

echo "Fetching $SPEC_URL → $OUT"
pnpm exec openapi-typescript "$SPEC_URL" -o "$OUT"
echo "Done."
```

- [ ] **Step 2:** 改 `packages/shared-types/package.json` scripts.generate

```json
"generate": "bash scripts/generate.sh"
```

- [ ] **Step 3:** 改 `packages/shared-types/src/index.ts`

```ts
export * from './api';
```

- [ ] **Step 4:** 启 API + 生成

```bash
cd apps/api
uv run uvicorn scale_api.main:app --port 8000 &
sleep 2
cd ../../packages/shared-types
chmod +x scripts/generate.sh
pnpm generate
kill %1 || true
```

- [ ] **Step 5:** typecheck

```bash
cd ../..
pnpm --filter @scale/shared-types typecheck
```

- [ ] **Step 6:** 提交

```bash
git add packages/shared-types/
git commit -m "feat(shared-types): 从 OpenAPI 自动生成 TS 类型"
```

---

## Phase 1 完成标志

✅ Pydantic Settings + 异步 SQLAlchemy 引擎 + session
✅ 模型：User / RefreshToken / AuditLog（含 mixin）
✅ Alembic 异步初始化 + 首版迁移可升降级
✅ JWT 工具 + bcrypt + 业务异常体系
✅ Repositories：Base / User / RefreshToken
✅ Schemas：common / user / auth
✅ AuthService 含 refresh 轮换 + reuse 检测
✅ `/auth/login | refresh | logout | me` 端到端可用
✅ `/users` CRUD（仅 admin）
✅ pytest 全绿，覆盖率 ≥ 80%
✅ OpenAPI 自动生成 → `@scale/shared-types`

---

## 下一步

合并到 main，启动 Phase 2（业务实体 CRUD）。Phase 2 plan 在 Phase 1 完成后再细写，避免类型契约假设漂移。
