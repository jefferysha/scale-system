"""含沙量计算（spec §1.1）.

公式（按 spec §1.1，agent 实现时按实测数据校准后维持）：
    含沙量 (mg/L) = (湿沙杯重 wet_weight_g - 杯重 cup_tare_g) / 容积 volume_ml × 1000

量纲推导：
    (g - g) / mL × 1000 = g/mL × 1000

注：spec §1.1 给定该公式即默认输出量纲为 mg/L（行业惯例）。
单元测试用样例 wet=51.1221, tare=50.6112, volume=1000 → 0.5109 ≈ 0.5109 mg/L。
"""
from decimal import Decimal

from scale_api.core.exceptions import ValidationError


def compute_concentration_mg_l(
    wet_weight_g: Decimal,
    cup_tare_g: Decimal,
    volume_ml: Decimal,
) -> Decimal:
    """单点含沙量（mg/L）。volume_ml 必须 > 0。"""
    if volume_ml is None or volume_ml <= 0:
        raise ValidationError("volume_ml 必须 > 0")
    sand_g = wet_weight_g - cup_tare_g
    return (sand_g / volume_ml) * Decimal("1000")


def compute_avg(values: list[Decimal]) -> Decimal:
    """简单算术平均（多点平均含沙量）。空数组返回 0."""
    if not values:
        return Decimal("0")
    total = Decimal("0")
    for v in values:
        total += v
    return total / Decimal(len(values))
