"""record_calculator 测试."""
from decimal import Decimal

import pytest

from scale_api.core.exceptions import ValidationError
from scale_api.services.record_calculator import (
    compute_avg,
    compute_concentration_mg_l,
)


def test_concentration_basic() -> None:
    """spec §1.1：(wet - tare) / volume_ml × 1000."""
    # wet=51.1221g, tare=50.6112g → sand=0.5109g；volume=1000mL
    # → 0.5109 / 1000 * 1000 = 0.5109
    c = compute_concentration_mg_l(
        Decimal("51.1221"), Decimal("50.6112"), Decimal("1000"),
    )
    assert c == Decimal("0.5109")


def test_concentration_with_excel_sample() -> None:
    """Excel 样本 c0=0.3109：sand=0.3109g, volume=1000mL → 0.3109 mg/L."""
    c = compute_concentration_mg_l(
        Decimal("50.9221"), Decimal("50.6112"), Decimal("1000"),
    )
    assert c == Decimal("0.3109")


def test_concentration_zero_volume_raises() -> None:
    with pytest.raises(ValidationError):
        compute_concentration_mg_l(Decimal("51"), Decimal("50"), Decimal("0"))


def test_compute_avg_empty() -> None:
    assert compute_avg([]) == Decimal("0")


def test_compute_avg_single() -> None:
    assert compute_avg([Decimal("0.5")]) == Decimal("0.5")


def test_compute_avg_multi() -> None:
    avg = compute_avg([Decimal("0.3"), Decimal("0.5"), Decimal("0.7")])
    assert avg == Decimal("0.5")
