"""Vertical 仓储."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.record import WeighingRecord
from scale_api.models.vertical import Vertical
from scale_api.repositories.base import BaseRepository


class VerticalRepository(BaseRepository[Vertical]):
    model = Vertical

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def list_by_project(self, project_id: int) -> list[Vertical]:
        stmt = (
            select(Vertical)
            .where(Vertical.project_id == project_id)
            .order_by(Vertical.sort_order.asc(), Vertical.code.asc())
        )
        return list((await self.session.scalars(stmt)).all())

    async def get_by_project_code(
        self, project_id: int, code: str,
    ) -> Vertical | None:
        stmt = select(Vertical).where(
            Vertical.project_id == project_id, Vertical.code == code,
        )
        return (await self.session.scalars(stmt)).first()

    async def has_records(self, vertical_id: int) -> bool:
        stmt = (
            select(WeighingRecord.id)
            .where(WeighingRecord.vertical_id == vertical_id)
            .limit(1)
        )
        return (await self.session.scalars(stmt)).first() is not None
