"""WeighingRecord schemas."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class RecordPointIn(BaseModel):
    pos: str
    cup_id: int
    cup_number: str
    cup_tare_g: Decimal
    wet_weight_g: Decimal
    weighed_at: datetime | None = None


class RecordCreate(BaseModel):
    client_uid: uuid.UUID
    project_id: int
    vertical_id: int
    tide_type: Literal["大潮", "小潮", "平潮"] | None = None
    sample_date: date
    water_depth_m: Decimal | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    volume_ml: Decimal = Field(gt=0)
    points: list[RecordPointIn]
    notes: str | None = None


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_uid: uuid.UUID
    project_id: int
    vertical_id: int
    tide_type: str | None
    sample_date: date
    water_depth_m: Decimal | None
    start_time: datetime | None
    end_time: datetime | None
    volume_ml: Decimal | None
    points: list[dict[str, Any]]
    computed_avg_concentration: Decimal | None
    notes: str | None
    operator_id: int | None
    source: str
    created_at: datetime
    updated_at: datetime


class RecordUpdate(BaseModel):
    notes: str | None = None
    tide_type: Literal["大潮", "小潮", "平潮"] | None = None


class BatchItemResult(BaseModel):
    client_uid: uuid.UUID
    status: Literal["created", "duplicate", "invalid"]
    id: int | None = None
    error: str | None = None


class BatchRequest(BaseModel):
    records: list[RecordCreate]


class BatchResponse(BaseModel):
    results: list[BatchItemResult]
