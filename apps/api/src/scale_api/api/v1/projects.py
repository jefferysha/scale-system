"""Projects API."""
from fastapi import APIRouter, Query, status

from scale_api.api.deps import AdminUser, CurrentUser, DBSession
from scale_api.schemas.common import CursorPage
from scale_api.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from scale_api.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=CursorPage[ProjectOut])
async def list_projects(
    _: CurrentUser,
    session: DBSession,
    q: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
) -> CursorPage[ProjectOut]:
    page = await ProjectService(session).list_paged(
        q=q, is_active=is_active, limit=limit, cursor=cursor,
    )
    return CursorPage(
        items=[ProjectOut.model_validate(p) for p in page.items],
        next_cursor=page.next_cursor,
    )


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate, user: AdminUser, session: DBSession,
) -> ProjectOut:
    p = await ProjectService(session).create(body, actor_id=user.id)
    return ProjectOut.model_validate(p)


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: int, body: ProjectUpdate, user: AdminUser, session: DBSession,
) -> ProjectOut:
    p = await ProjectService(session).update(project_id, body, actor_id=user.id)
    return ProjectOut.model_validate(p)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: int, user: AdminUser, session: DBSession) -> None:
    await ProjectService(session).soft_delete(project_id, actor_id=user.id)
