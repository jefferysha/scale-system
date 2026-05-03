"""杯库."""
from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from scale_api.models.base import Base, TimestampMixin


class Cup(Base, TimestampMixin):
    __tablename__ = "cups"

    id: Mapped[int] = mapped_column(primary_key=True)
    cup_number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    current_tare_g: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    latest_calibration_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text)

    # 全文搜索用 trigram（spec §7.5）。Alembic 迁移里加 GIN 索引（DDL 直接给）。
    __table_args__ = (
        Index(
            "ix_cups_number_trgm",
            "cup_number",
            postgresql_using="gin",
            postgresql_ops={"cup_number": "gin_trgm_ops"},
        ),
    )
