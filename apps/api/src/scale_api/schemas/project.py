"""项目 schemas."""
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

ProjectName = Annotated[str, StringConstraints(min_length=1, max_length=128)]


class ProjectBase(BaseModel):
    name: ProjectName
    established_date: date | None = None
    notes: str | None = None
    is_active: bool = True


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: ProjectName | None = None
    established_date: date | None = None
    notes: str | None = None
    is_active: bool | None = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
