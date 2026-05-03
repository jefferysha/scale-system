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
        # 业务表 gin_trgm_ops + 表达式索引函数，需先扩展 + 建辅助函数
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        await conn.execute(
            text(
                """
                CREATE OR REPLACE FUNCTION rec_points_cup_numbers(points jsonb)
                RETURNS text[]
                LANGUAGE sql
                IMMUTABLE
                STRICT
                PARALLEL SAFE
                AS $$
                    SELECT array_agg(elem->>'cup_number')
                    FROM jsonb_array_elements(points) AS elem
                $$
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE OR REPLACE FUNCTION rec_points_cup_ids(points jsonb)
                RETURNS bigint[]
                LANGUAGE sql
                IMMUTABLE
                STRICT
                PARALLEL SAFE
                AS $$
                    SELECT array_agg((elem->>'cup_id')::bigint)
                    FROM jsonb_array_elements(points) AS elem
                $$
                """
            )
        )
        await conn.run_sync(Base.metadata.create_all)
        # ORM 不建表达式索引；与迁移保持一致
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_rec_points_cup_numbers "
                "ON weighing_records USING gin (rec_points_cup_numbers(points))"
            )
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_rec_points_cup_ids "
                "ON weighing_records USING gin (rec_points_cup_ids(points))"
            )
        )
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
