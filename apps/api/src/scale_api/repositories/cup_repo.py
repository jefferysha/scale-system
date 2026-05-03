"""Cup 仓储."""
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.cup import Cup
from scale_api.models.cup_calibration import CupCalibration
from scale_api.repositories.base import BaseRepository


class CupRepository(BaseRepository[Cup]):
    model = Cup

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_by_number(self, cup_number: str) -> Cup | None:
        return (
            await self.session.scalars(select(Cup).where(Cup.cup_number == cup_number))
        ).first()

    def list_query(self, *, q: str | None, is_active: bool | None) -> Select[tuple[Cup]]:
        stmt = select(Cup).order_by(Cup.cup_number.asc(), Cup.id.asc())
        if q:
            stmt = stmt.where(Cup.cup_number.ilike(f"%{q}%"))
        if is_active is not None:
            stmt = stmt.where(Cup.is_active.is_(is_active))
        return stmt

    async def list_calibrations(self, cup_id: int) -> list[CupCalibration]:
        stmt = (
            select(CupCalibration)
            .where(CupCalibration.cup_id == cup_id)
            .order_by(CupCalibration.calibrated_at.desc())
        )
        return list((await self.session.scalars(stmt)).all())
