"""Vertical 服务."""
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.core.exceptions import ConflictError, NotFoundError
from scale_api.models.vertical import Vertical
from scale_api.repositories.project_repo import ProjectRepository
from scale_api.repositories.vertical_repo import VerticalRepository
from scale_api.schemas.vertical import VerticalCreate, VerticalUpdate
from scale_api.services.audit import write_audit


class VerticalService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = VerticalRepository(session)
        self.projects = ProjectRepository(session)

    async def list_by_project(self, project_id: int) -> list[Vertical]:
        if await self.projects.get(project_id) is None:
            raise NotFoundError(f"项目 {project_id} 不存在")
        return await self.repo.list_by_project(project_id)

    async def create(
        self, project_id: int, body: VerticalCreate, *, actor_id: int | None,
    ) -> Vertical:
        if await self.projects.get(project_id) is None:
            raise NotFoundError(f"项目 {project_id} 不存在")
        if await self.repo.get_by_project_code(project_id, body.code):
            raise ConflictError(
                f"项目 {project_id} 中已存在 code={body.code} 的垂线",
            )
        v = Vertical(
            project_id=project_id,
            code=body.code,
            label=body.label,
            sort_order=body.sort_order,
        )
        try:
            await self.repo.create(v)
            await write_audit(
                self.session,
                actor_id=actor_id,
                action="create",
                entity="vertical",
                entity_id=v.id,
                after={"project_id": project_id, "code": v.code},
            )
            await self.session.commit()
        except IntegrityError as e:
            await self.session.rollback()
            raise ConflictError("唯一约束冲突") from e
        await self.session.refresh(v)
        return v

    async def update(
        self,
        vertical_id: int,
        body: VerticalUpdate,
        *,
        actor_id: int | None,
    ) -> Vertical:
        v = await self.repo.get(vertical_id)
        if v is None:
            raise NotFoundError(f"垂线 {vertical_id} 不存在")
        before = {"code": v.code, "label": v.label, "sort_order": v.sort_order}
        if body.code is not None and body.code != v.code:
            existing = await self.repo.get_by_project_code(v.project_id, body.code)
            if existing and existing.id != v.id:
                raise ConflictError(f"垂线 code={body.code} 已存在")
            v.code = body.code
        if body.label is not None:
            v.label = body.label
        if body.sort_order is not None:
            v.sort_order = body.sort_order
        await write_audit(
            self.session,
            actor_id=actor_id,
            action="update",
            entity="vertical",
            entity_id=v.id,
            before=before,
            after={"code": v.code, "label": v.label, "sort_order": v.sort_order},
        )
        await self.session.commit()
        await self.session.refresh(v)
        return v

    async def delete(self, vertical_id: int, *, actor_id: int | None) -> None:
        v = await self.repo.get(vertical_id)
        if v is None:
            raise NotFoundError(f"垂线 {vertical_id} 不存在")
        if await self.repo.has_records(vertical_id):
            raise ConflictError("该垂线已有称重记录关联，不能删除")
        await write_audit(
            self.session,
            actor_id=actor_id,
            action="delete",
            entity="vertical",
            entity_id=v.id,
            before={"code": v.code, "project_id": v.project_id},
        )
        await self.session.delete(v)
        await self.session.commit()
