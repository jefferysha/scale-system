"""串口模块共享类型。"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Literal


class ConnectionState(str, Enum):
    IDLE = "idle"
    OPENING = "opening"
    CONNECTED = "connected"
    READING = "reading"
    ERROR = "error"
    DISCONNECTED = "disconnected"


@dataclass(frozen=True)
class WeightSample:
    """一次重量样本。"""
    value: float
    unit: Literal["g", "mg", "kg"]
    stable: bool
    raw: str
    ts: float  # epoch seconds


@dataclass(frozen=True)
class SerialError:
    """串口错误。"""
    code: str  # PERMISSION_DENIED / PORT_NOT_FOUND / TIMEOUT / PARSE_ERROR / IO_ERROR / UNCONFIGURED / UNSUPPORTED_PROTOCOL
    message: str


@dataclass(frozen=True)
class ScaleConfig:
    """连接天平所需的运行时参数。"""
    baud_rate: int
    data_bits: Literal[7, 8]
    parity: Literal["none", "even", "odd"]
    stop_bits: Literal[1, 2]
    flow_control: Literal["none", "hardware"]
    protocol_type: Literal["generic", "mettler", "sartorius"]
    read_timeout_ms: int
    decimal_places: int
    unit_default: Literal["g", "mg", "kg"]
