"""称重记录 points 数组校验（spec §7.6）."""
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ValidationError as PydanticValidationError

from scale_api.core.exceptions import ValidationError

# 6 个固定相对水深（占垂线水深百分比，spec §1.1）
ALLOWED_POSITIONS: frozenset[str] = frozenset(
    {"0.0", "0.2", "0.4", "0.6", "0.8", "1.0"},
)


class PointSchema(BaseModel):
    """单个测点：spec §7.6 标准结构."""

    pos: str
    cup_id: int
    cup_number: str
    cup_tare_g: Decimal
    wet_weight_g: Decimal
    weighed_at: datetime | None = None


def validate_points(raw: list[dict[str, Any]]) -> list[PointSchema]:
    """校验 points 数组：结构 + 点位合法 + 不重复. 失败 raise ValidationError."""
    if not raw:
        raise ValidationError("points 不能为空")
    try:
        items = [PointSchema(**p) for p in raw]
    except PydanticValidationError as e:
        raise ValidationError(f"points 元素结构错误: {e.errors()[0]}") from e

    positions = [p.pos for p in items]
    if any(p not in ALLOWED_POSITIONS for p in positions):
        raise ValidationError(
            "点位必须在 0.0 / 0.2 / 0.4 / 0.6 / 0.8 / 1.0 中",
        )
    if len(set(positions)) != len(positions):
        raise ValidationError("点位不允许重复")
    return items
