"""Project 仓储."""
from sqlalchemy import Select, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from scale_api.models.project import Project
from scale_api.repositories.base import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    model = Project

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_by_name(self, name: str) -> Project | None:
        return (
            await self.session.scalars(select(Project).where(Project.name == name))
        ).first()

    def list_query(self, *, q: str | None, is_active: bool | None) -> Select[tuple[Project]]:
        stmt = select(Project).order_by(Project.created_at.desc(), Project.id.desc())
        if q:
            like = f"%{q}%"
            stmt = stmt.where(or_(Project.name.ilike(like), Project.notes.ilike(like)))
        if is_active is not None:
            stmt = stmt.where(Project.is_active.is_(is_active))
        return stmt
