"""天平配置（中心管理，所有客户端共享）."""
from sqlalchemy import Boolean, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from scale_api.models.base import Base, TimestampMixin


class Scale(Base, TimestampMixin):
    __tablename__ = "scales"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    model: Mapped[str | None] = mapped_column(String(64))
    protocol_type: Mapped[str] = mapped_column(String(32), nullable=False, default="generic")
    baud_rate: Mapped[int] = mapped_column(Integer, nullable=False, default=9600)
    data_bits: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=8)
    parity: Mapped[str] = mapped_column(String(8), nullable=False, default="none")
    stop_bits: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    flow_control: Mapped[str] = mapped_column(String(8), nullable=False, default="none")
    read_timeout_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=1000)
    decimal_places: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=4)
    unit_default: Mapped[str] = mapped_column(String(8), nullable=False, default="g")
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
