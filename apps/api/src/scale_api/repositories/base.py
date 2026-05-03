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
