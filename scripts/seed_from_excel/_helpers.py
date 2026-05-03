"""通用类型转换 helpers（共享于 loaders）."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation


def to_decimal(raw: object) -> Decimal | None:
    """把 Excel 数字/字符串转 Decimal；失败返回 None."""
    if raw is None:
        return None
    try:
        return Decimal(str(raw))
    except (InvalidOperation, ValueError):
        return None


def to_date(raw: object) -> date | None:
    """把 Excel 日期/字符串转 date；失败返回 None."""
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    if isinstance(raw, str):
        for fmt in ("%Y年%m月%d日", "%Y-%m-%d", "%Y/%m/%d"):
            try:
                return datetime.strptime(raw, fmt).date()
            except ValueError:
                continue
    return None


def to_datetime(raw: object) -> datetime | None:
    """把 Excel 日期/datetime/字符串转 datetime；失败返回 None."""
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw
    if isinstance(raw, date):
        return datetime.combine(raw, datetime.min.time())
    return None


def safe_str(raw: object) -> str:
    """非空 strip；None → 空串."""
    if raw is None:
        return ""
    return str(raw).strip()
