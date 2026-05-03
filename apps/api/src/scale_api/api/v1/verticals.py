"""Verticals API（嵌套在 project 下 + 顶层资源）."""
from fastapi import APIRouter, status

from scale_api.api.deps import AdminUser, CurrentUser, DBSession
from scale_api.schemas.vertical import VerticalCreate, VerticalOut, VerticalUpdate
from scale_api.services.vertical_service import VerticalService

router = APIRouter(tags=["verticals"])


@router.get(
    "/projects/{project_id}/verticals",
    response_model=list[VerticalOut],
)
async def list_verticals(
    project_id: int, _: CurrentUser, session: DBSession,
) -> list[VerticalOut]:
    items = await VerticalService(session).list_by_project(project_id)
    return [VerticalOut.model_validate(v) for v in items]


@router.post(
    "/projects/{project_id}/verticals",
    response_model=VerticalOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_vertical(
    project_id: int,
    body: VerticalCreate,
    user: AdminUser,
    session: DBSession,
) -> VerticalOut:
    v = await VerticalService(session).create(project_id, body, actor_id=user.id)
    return VerticalOut.model_validate(v)


@router.put("/verticals/{vertical_id}", response_model=VerticalOut)
async def update_vertical(
    vertical_id: int,
    body: VerticalUpdate,
    user: AdminUser,
    session: DBSession,
) -> VerticalOut:
    v = await VerticalService(session).update(vertical_id, body, actor_id=user.id)
    return VerticalOut.model_validate(v)


@router.delete(
    "/verticals/{vertical_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_vertical(
    vertical_id: int, user: AdminUser, session: DBSession,
) -> None:
    await VerticalService(session).delete(vertical_id, actor_id=user.id)
