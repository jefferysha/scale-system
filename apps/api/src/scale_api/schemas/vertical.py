"""垂线 schemas."""
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

VerticalCode = Annotated[str, StringConstraints(min_length=1, max_length=32)]


class VerticalBase(BaseModel):
    code: VerticalCode
    label: str | None = None
    sort_order: int = 0


class VerticalCreate(VerticalBase):
    pass


class VerticalUpdate(BaseModel):
    code: VerticalCode | None = None
    label: str | None = None
    sort_order: int | None = None


class VerticalOut(VerticalBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime
