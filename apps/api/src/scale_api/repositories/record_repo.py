"""WeighingRecord 仓储."""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.record import WeighingRecord
from scale_api.repositories.base import BaseRepository


class RecordRepository(BaseRepository[WeighingRecord]):
    model = WeighingRecord

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_by_client_uid(self, client_uid: uuid.UUID) -> WeighingRecord | None:
        stmt = select(WeighingRecord).where(WeighingRecord.client_uid == client_uid)
        return (await self.session.scalars(stmt)).first()
