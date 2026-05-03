"""称重记录（核心）."""
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from scale_api.models.base import Base, TimestampMixin


class WeighingRecord(Base, TimestampMixin):
    __tablename__ = "weighing_records"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    client_uid: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), unique=True, nullable=False)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    vertical_id: Mapped[int] = mapped_column(ForeignKey("verticals.id"), nullable=False)
    tide_type: Mapped[str | None] = mapped_column(String(8))
    sample_date: Mapped[date] = mapped_column(Date, nullable=False)
    water_depth_m: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    volume_ml: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    points: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    computed_avg_concentration: Mapped[Decimal | None] = mapped_column(Numeric(12, 4))
    notes: Mapped[str | None] = mapped_column(Text)
    operator_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    source: Mapped[str] = mapped_column(String(8), nullable=False, default="web")

    __table_args__ = (
        Index("ix_rec_proj_vert_date", "project_id", "vertical_id", "sample_date"),
        Index("ix_rec_created", "created_at"),
        Index(
            "ix_rec_points_gin",
            "points",
            postgresql_using="gin",
            postgresql_ops={"points": "jsonb_path_ops"},
        ),
    )
