"""Scale 仓储."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.scale import Scale
from scale_api.repositories.base import BaseRepository


class ScaleRepository(BaseRepository[Scale]):
    model = Scale

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def list_active(self) -> list[Scale]:
        stmt = (
            select(Scale)
            .where(Scale.is_active.is_(True))
            .order_by(Scale.name.asc(), Scale.id.asc())
        )
        return list((await self.session.scalars(stmt)).all())

    async def list_all(self, limit: int = 200) -> list[Scale]:
        stmt = select(Scale).order_by(Scale.id.desc()).limit(limit)
        return list((await self.session.scalars(stmt)).all())
