"""通用 schemas（错误结构、分页）。"""
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorBody


class CursorPage(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None


class OffsetPage(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
