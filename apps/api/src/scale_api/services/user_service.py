"""User 服务（CRUD 业务逻辑）。"""
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.core.exceptions import ConflictError, NotFoundError
from scale_api.core.security import hash_password
from scale_api.models.user import User
from scale_api.repositories.user_repo import UserRepository
from scale_api.schemas.user import UserCreate, UserUpdate


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = UserRepository(session)

    async def create(self, body: UserCreate) -> User:
        if await self.repo.get_by_username(body.username):
            raise ConflictError(f"用户名 {body.username} 已存在")
        u = User(
            username=body.username,
            email=body.email,
            password_hash=hash_password(body.password),
            role=body.role,
            is_active=True,
        )
        await self.repo.create(u)
        await self.session.commit()
        await self.session.refresh(u)
        return u

    async def update(self, user_id: int, body: UserUpdate) -> User:
        u = await self.repo.get(user_id)
        if u is None:
            raise NotFoundError(f"用户 {user_id} 不存在")
        if body.email is not None:
            u.email = body.email
        if body.role is not None:
            u.role = body.role
        if body.is_active is not None:
            u.is_active = body.is_active
        if body.password is not None:
            u.password_hash = hash_password(body.password)
        await self.session.commit()
        await self.session.refresh(u)
        return u

    async def delete(self, user_id: int) -> None:
        u = await self.repo.get(user_id)
        if u is None:
            raise NotFoundError(f"用户 {user_id} 不存在")
        u.is_active = False
        await self.session.commit()

    async def list_all(self) -> list[User]:
        return await self.repo.list_all(limit=200)
