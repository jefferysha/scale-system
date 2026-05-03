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
