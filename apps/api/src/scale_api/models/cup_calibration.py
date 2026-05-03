"""杯子率定历史."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from scale_api.models.base import Base


class CupCalibration(Base):
    __tablename__ = "cup_calibrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    cup_id: Mapped[int] = mapped_column(
        ForeignKey("cups.id", ondelete="CASCADE"), nullable=False,
    )
    tare_g: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    calibrated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    calibrated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    method: Mapped[str | None] = mapped_column(String(32))
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        Index("ix_cup_cal_cup_time", "cup_id", "calibrated_at"),
    )
