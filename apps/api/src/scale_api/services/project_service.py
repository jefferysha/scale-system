"""Project 服务."""
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.core.exceptions import ConflictError, NotFoundError
from scale_api.models.project import Project
from scale_api.repositories.project_repo import ProjectRepository
from scale_api.schemas.common import CursorPage
from scale_api.schemas.project import ProjectCreate, ProjectUpdate
from scale_api.services.audit import write_audit
from scale_api.services.pagination import cursor_paginate


class ProjectService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ProjectRepository(session)

    async def create(self, body: ProjectCreate, *, actor_id: int | None) -> Project:
        if await self.repo.get_by_name(body.name):
            raise ConflictError(f"项目名 {body.name} 已存在")
        p = Project(
            name=body.name,
            established_date=body.established_date,
            notes=body.notes,
            is_active=body.is_active,
            created_by=actor_id,
        )
        await self.repo.create(p)
        await write_audit(
            self.session,
            actor_id=actor_id,
            action="create",
            entity="project",
            entity_id=p.id,
            after={
                "name": p.name,
                "is_active": p.is_active,
            },
        )
        await self.session.commit()
        await self.session.refresh(p)
        return p

    async def update(
        self, project_id: int, body: ProjectUpdate, *, actor_id: int | None,
    ) -> Project:
        p = await self.repo.get(project_id)
        if p is None:
            raise NotFoundError(f"项目 {project_id} 不存在")
        before = {
            "name": p.name,
            "is_active": p.is_active,
            "notes": p.notes,
        }
        if body.name is not None and body.name != p.name:
            existing = await self.repo.get_by_name(body.name)
            if existing and existing.id != project_id:
                raise ConflictError(f"项目名 {body.name} 已被占用")
            p.name = body.name
        if body.established_date is not None:
            p.established_date = body.established_date
        if body.notes is not None:
            p.notes = body.notes
        if body.is_active is not None:
            p.is_active = body.is_active
        await write_audit(
            self.session,
            actor_id=actor_id,
            action="update",
            entity="project",
            entity_id=p.id,
            before=before,
            after={"name": p.name, "is_active": p.is_active, "notes": p.notes},
        )
        await self.session.commit()
        await self.session.refresh(p)
        return p

    async def soft_delete(self, project_id: int, *, actor_id: int | None) -> None:
        p = await self.repo.get(project_id)
        if p is None:
            raise NotFoundError(f"项目 {project_id} 不存在")
        p.is_active = False
        await write_audit(
            self.session,
            actor_id=actor_id,
            action="delete",
            entity="project",
            entity_id=p.id,
            before={"is_active": True},
            after={"is_active": False},
        )
        await self.session.commit()

    async def list_paged(
        self,
        *,
        q: str | None,
        is_active: bool | None,
        limit: int,
        cursor: str | None,
    ) -> CursorPage[Any]:
        stmt = self.repo.list_query(q=q, is_active=is_active)
        return await cursor_paginate(
            self.session, stmt, order_keys=["id"], limit=limit, cursor=cursor,
        )
