"""seed 脚本测试。"""
from __future__ import annotations

import pytest

from scripts.seed import seed_admin


@pytest.mark.asyncio
async def test_seed_creates_admin_when_missing(monkeypatch: pytest.MonkeyPatch, engine) -> None:
    """首次运行新建 admin。"""
    from scale_api.db import session as session_module

    monkeypatch.setattr(session_module, "_engine", engine, raising=False)
    monkeypatch.setattr(session_module, "_sessionmaker", None, raising=False)
    monkeypatch.setattr("scripts.seed.make_engine", lambda: engine)

    created, msg = await seed_admin(
        username="seeded_admin", password="strongpass!", email="seeded@example.com",
    )
    assert created is True
    assert "已创建" in msg


@pytest.mark.asyncio
async def test_seed_skips_when_exists(monkeypatch: pytest.MonkeyPatch, engine) -> None:
    """重复运行幂等。"""
    monkeypatch.setattr("scripts.seed.make_engine", lambda: engine)

    await seed_admin(username="dup_admin", password="strongpass!", email=None)
    created, msg = await seed_admin(username="dup_admin", password="strongpass!", email=None)
    assert created is False
    assert "已存在" in msg
