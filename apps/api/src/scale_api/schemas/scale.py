"""Scale schemas + 串口校验/探测回报 schemas."""
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

ScaleName = Annotated[str, StringConstraints(min_length=1, max_length=64)]
ProtocolType = Literal["generic", "mettler", "sartorius"]
Parity = Literal["none", "odd", "even"]
FlowControl = Literal["none", "rtscts", "xonxoff"]


class ScaleBase(BaseModel):
    name: ScaleName
    model: str | None = None
    protocol_type: ProtocolType = "generic"
    baud_rate: int = Field(default=9600, ge=300, le=921600)
    data_bits: int = Field(default=8, ge=5, le=8)
    parity: Parity = "none"
    stop_bits: int = Field(default=1, ge=1, le=2)
    flow_control: FlowControl = "none"
    read_timeout_ms: int = Field(default=1000, ge=10, le=60000)
    decimal_places: int = Field(default=4, ge=0, le=6)
    unit_default: Literal["g", "kg", "mg"] = "g"
    notes: str | None = None
    is_active: bool = True


class ScaleCreate(ScaleBase):
    pass


class ScaleUpdate(BaseModel):
    name: ScaleName | None = None
    model: str | None = None
    protocol_type: ProtocolType | None = None
    baud_rate: int | None = Field(default=None, ge=300, le=921600)
    data_bits: int | None = Field(default=None, ge=5, le=8)
    parity: Parity | None = None
    stop_bits: int | None = Field(default=None, ge=1, le=2)
    flow_control: FlowControl | None = None
    read_timeout_ms: int | None = Field(default=None, ge=10, le=60000)
    decimal_places: int | None = Field(default=None, ge=0, le=6)
    unit_default: Literal["g", "kg", "mg"] | None = None
    notes: str | None = None
    is_active: bool | None = None


class ScaleOut(ScaleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


class ScaleValidateResult(BaseModel):
    ok: bool
    warnings: list[str] = Field(default_factory=list)


class ScaleProbeReport(BaseModel):
    ok: bool
    samples_count: int = Field(ge=0)
    samples: list[dict[str, Any]] | None = None
    error: str | None = None


class ScaleProbeAck(BaseModel):
    recorded: bool
