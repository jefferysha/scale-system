"""Users 管理 API（仅 admin）。"""
from fastapi import APIRouter, status

from scale_api.api.deps import AdminUser, DBSession
from scale_api.schemas.user import UserCreate, UserOut, UserUpdate
from scale_api.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(_: AdminUser, session: DBSession) -> list[UserOut]:
    items = await UserService(session).list_all()
    return [UserOut.model_validate(u) for u in items]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(body: UserCreate, _: AdminUser, session: DBSession) -> UserOut:
    u = await UserService(session).create(body)
    return UserOut.model_validate(u)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int, body: UserUpdate, _: AdminUser, session: DBSession,
) -> UserOut:
    u = await UserService(session).update(user_id, body)
    return UserOut.model_validate(u)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, _: AdminUser, session: DBSession) -> None:
    await UserService(session).delete(user_id)
