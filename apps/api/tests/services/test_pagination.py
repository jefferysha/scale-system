"""Pagination helper 测试."""
import pytest
from sqlalchemy import select

from scale_api.models.user import User
from scale_api.services.pagination import (
    cursor_paginate,
    decode_cursor,
    encode_cursor,
    offset_paginate,
)


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
async def test_cursor_paginate_follows_next(session) -> None:
    for i in range(5):
        session.add(User(username=f"v{i}", password_hash="h", role="operator"))
    await session.commit()

    first = await cursor_paginate(
        session,
        select(User).order_by(User.id.desc()),
        order_keys=["id"],
        limit=2,
        cursor=None,
    )
    second = await cursor_paginate(
        session,
        select(User).order_by(User.id.desc()),
        order_keys=["id"],
        limit=2,
        cursor=first.next_cursor,
    )
    first_ids = {u.id for u in first.items}
    second_ids = {u.id for u in second.items}
    assert first_ids.isdisjoint(second_ids)


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
