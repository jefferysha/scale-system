"""record_validator 测试."""
from decimal import Decimal

import pytest

from scale_api.core.exceptions import ValidationError
from scale_api.services.record_validator import validate_points


def _p(pos: str, cup_id: int = 1) -> dict:
    return {
        "pos": pos,
        "cup_id": cup_id,
        "cup_number": f"C{cup_id}",
        "cup_tare_g": Decimal("50.0000"),
        "wet_weight_g": Decimal("50.5"),
    }


def test_valid_points_pass() -> None:
    items = validate_points([_p("0.0"), _p("0.2"), _p("1.0")])
    assert len(items) == 3


def test_empty_raises() -> None:
    with pytest.raises(ValidationError):
        validate_points([])


def test_invalid_pos_raises() -> None:
    with pytest.raises(ValidationError, match="点位"):
        validate_points([_p("0.5")])


def test_duplicate_pos_raises() -> None:
    with pytest.raises(ValidationError, match="重复"):
        validate_points([_p("0.0"), _p("0.0", cup_id=2)])


def test_missing_field_raises() -> None:
    with pytest.raises(ValidationError):
        validate_points([{"pos": "0.0"}])
