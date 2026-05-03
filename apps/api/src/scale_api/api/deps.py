"""FastAPI 依赖：DB session、当前用户、admin 守卫。"""
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.core.exceptions import AuthorizationError, InvalidTokenError
from scale_api.core.security import decode_token
from scale_api.db.session import get_session
from scale_api.models.user import User
from scale_api.repositories.user_repo import UserRepository

DBSession = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(
    session: DBSession,
    authorization: str | None = Header(default=None),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise InvalidTokenError("缺少 Authorization header")
    token = authorization[7:]
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise InvalidTokenError("token 类型错误")
    user = await UserRepository(session).get(int(payload["sub"]))
    if user is None or not user.is_active:
        raise InvalidTokenError("用户不可用")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_admin(user: CurrentUser) -> User:
    if user.role != "admin":
        raise AuthorizationError("需要管理员权限")
    return user


AdminUser = Annotated[User, Depends(require_admin)]
