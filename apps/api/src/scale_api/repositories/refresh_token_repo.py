"""Refresh token 仓储。"""
import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.refresh_token import RefreshToken
from scale_api.repositories.base import BaseRepository


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    model = RefreshToken

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_by_jti(self, jti: uuid.UUID) -> RefreshToken | None:
        stmt = select(RefreshToken).where(RefreshToken.jti == jti)
        return (await self.session.scalars(stmt)).first()

    async def revoke(self, rt: RefreshToken, *, rotated_to: uuid.UUID | None) -> None:
        rt.revoked_at = datetime.utcnow()
        rt.rotated_to = rotated_to
        await self.session.flush()

    async def revoke_all_for_user(self, user_id: int) -> None:
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.utcnow())
        )
        await self.session.execute(stmt)
