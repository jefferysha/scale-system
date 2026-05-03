"""垂线（属于项目）."""
from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from scale_api.models.base import Base, TimestampMixin


class Vertical(Base, TimestampMixin):
    __tablename__ = "verticals"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False,
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str | None] = mapped_column(String(128))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("project_id", "code", name="uq_vertical_project_code"),
        Index("ix_verticals_proj_sort", "project_id", "sort_order"),
    )
