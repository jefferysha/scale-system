"""Cup schemas."""
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

CupNumber = Annotated[str, StringConstraints(min_length=1, max_length=32)]


class CupBase(BaseModel):
    cup_number: CupNumber
    current_tare_g: Decimal = Field(ge=0)
    notes: str | None = None
    is_active: bool = True


class CupCreate(CupBase):
    pass


class CupUpdate(BaseModel):
    cup_number: CupNumber | None = None
    notes: str | None = None
    is_active: bool | None = None


class CupOut(CupBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    latest_calibration_date: date | None
    created_at: datetime
    updated_at: datetime


class CupCalibrationCreate(BaseModel):
    tare_g: Decimal = Field(ge=0)
    method: str | None = None
    notes: str | None = None


class CupCalibrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    cup_id: int
    tare_g: Decimal
    calibrated_at: datetime
    calibrated_by: int | None
    method: str | None
    notes: str | None
