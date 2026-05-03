"""User 仓储。"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.user import User
from scale_api.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_by_username(self, username: str) -> User | None:
        stmt = select(User).where(User.username == username)
        return (await self.session.scalars(stmt)).first()

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        return (await self.session.scalars(stmt)).first()
