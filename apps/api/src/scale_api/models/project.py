"""项目库."""
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from scale_api.models.base import Base, TimestampMixin


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    established_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    __table_args__ = (
        Index("ix_projects_created_at_desc", "created_at"),
        Index("ix_projects_active_created", "is_active", "created_at"),
    )
