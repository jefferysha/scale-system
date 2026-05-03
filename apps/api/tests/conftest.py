"""Pytest fixtures: testcontainers PG + async session。

策略：
- pg_container / engine：session 范围（容器只起一次，节省时间）
- session：function 范围；每个测试结束后 TRUNCATE 所有表，保证隔离
"""
from collections.abc import AsyncGenerator

import pytest_asyncio
from sqlalchemy import text
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
    # 每个 test 后清空所有表，保证隔离（顺序符合 FK：先子后父）
    table_names = ", ".join(f'"{t.name}"' for t in reversed(Base.metadata.sorted_tables))
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {table_names} RESTART IDENTITY CASCADE"))
