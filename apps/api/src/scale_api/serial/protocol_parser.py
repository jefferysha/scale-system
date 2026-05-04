"""三种天平协议的字节流→WeightSample 解析。

线协议参考：
- mettler  : `S S  168.4521 g\\r\\n` / `S D  168.45 g\\r\\n`  (S=stable, D=dynamic)
- sartorius: `+ 168.4521 g \\r\\n` / `?  168.4521 g \\r\\n`     (?=unstable)
- generic  : 任何形如 `[+-]?d+(.d+)?\\s*(g|mg|kg)` 的行；按"读超时未变化"判 stable

每个解析器是 incremental state machine：feed(bytes) → list[WeightSample]，
内部缓冲未完整的行。
"""
from __future__ import annotations

import re
import time
from abc import ABC, abstractmethod
from typing import Literal

from .types import WeightSample

UnitT = Literal["g", "mg", "kg"]
_VALID_UNITS: set[str] = {"g", "mg", "kg"}


class ProtocolParser(ABC):
    """字节流增量解析器。"""

    def __init__(self, default_unit: UnitT = "g") -> None:
        self.buffer = bytearray()
        self.default_unit = default_unit

    def feed(self, chunk: bytes) -> list[WeightSample]:
        """喂字节，返回此次解析出的样本（可能为 0）。"""
        self.buffer.extend(chunk)
        out: list[WeightSample] = []
        while True:
            line, rest = self._extract_line(self.buffer)
            if line is None:
                break
            self.buffer = rest
            sample = self._parse_line(line)
            if sample is not None:
                out.append(sample)
        return out

    @staticmethod
    def _extract_line(buf: bytearray) -> tuple[bytes | None, bytearray]:
        """以 \\r\\n / \\n 为终止符切一行；不足则返回 (None, buf)。"""
        for term in (b"\r\n", b"\n", b"\r"):
            idx = buf.find(term)
            if idx != -1:
                return bytes(buf[:idx]), bytearray(buf[idx + len(term):])
        return None, buf

    @abstractmethod
    def _parse_line(self, line: bytes) -> WeightSample | None: ...


# Mettler protocol example (SICS):
#   "S S  168.4521 g"  -> stable
#   "S D  168.45 g"    -> dynamic
# Some firmwares prefix with extra 'S' (the SICS framing char).
_RE_METTLER = re.compile(
    rb"""^\s*S?\s*
        ([SD])\s+
        ([+-]?\d+(?:\.\d+)?)\s*
        (g|mg|kg)\s*$
    """,
    re.IGNORECASE | re.VERBOSE,
)


class MettlerParser(ProtocolParser):
    def _parse_line(self, line: bytes) -> WeightSample | None:
        line = line.strip()
        if not line:
            return None
        m = _RE_METTLER.match(line)
        if m is None:
            return None
        status, value, unit = m.group(1), m.group(2), m.group(3).decode().lower()
        if unit not in _VALID_UNITS:
            return None
        return WeightSample(
            value=float(value),
            unit=unit,  # type: ignore[arg-type]
            stable=status.upper() == b"S",
            raw=line.decode(errors="replace"),
            ts=time.time(),
        )


# Sartorius SBI protocol example:
#   "+ 168.4521 g"   -> stable
#   "? 168.4521 g"   -> unstable (? prefix)
#   "- 0.5 g"        -> stable, sign already in value
_RE_SARTORIUS = re.compile(
    rb"""^\s*([+\-?G])?\s*
        ([+-]?\d+(?:\.\d+)?)\s*
        (g|mg|kg)\s*$
    """,
    re.IGNORECASE | re.VERBOSE,
)


class SartoriusParser(ProtocolParser):
    def _parse_line(self, line: bytes) -> WeightSample | None:
        line = line.strip()
        if not line:
            return None
        m = _RE_SARTORIUS.match(line)
        if m is None:
            return None
        prefix, value, unit = m.group(1), m.group(2), m.group(3).decode().lower()
        if unit not in _VALID_UNITS:
            return None
        # `?` 前缀 = 不稳定；其它（包括无前缀）默认稳定
        stable = prefix not in (b"?",)
        return WeightSample(
            value=float(value),
            unit=unit,  # type: ignore[arg-type]
            stable=stable,
            raw=line.decode(errors="replace"),
            ts=time.time(),
        )


# Generic protocol: plain value + optional unit.
# Stability is determined by upstream timing (no change for read_timeout_ms).
# Examples:
#   "168.4521 g"
#   "ST,GS,+0123.456 g"   (CAS / OHAUS)
#   "100.5"               (no unit -> default)
_RE_GENERIC = re.compile(
    rb"""^[^\d+\-]*
        ([+-]?\d+(?:\.\d+)?)
        \s*
        (g|mg|kg)?
        .*$
    """,
    re.IGNORECASE | re.VERBOSE,
)


class GenericParser(ProtocolParser):
    def _parse_line(self, line: bytes) -> WeightSample | None:
        line = line.strip()
        if not line:
            return None
        m = _RE_GENERIC.match(line)
        if m is None:
            return None
        value = m.group(1)
        unit_match = m.group(2)
        unit = unit_match.decode().lower() if unit_match else self.default_unit
        if unit not in _VALID_UNITS:
            return None
        return WeightSample(
            value=float(value),
            unit=unit,  # type: ignore[arg-type]
            stable=True,  # 由 connection_manager 用时序判定
            raw=line.decode(errors="replace"),
            ts=time.time(),
        )


def make_parser(
    protocol_type: Literal["generic", "mettler", "sartorius"],
    default_unit: UnitT = "g",
) -> ProtocolParser:
    """工厂。"""
    if protocol_type == "mettler":
        return MettlerParser(default_unit=default_unit)
    if protocol_type == "sartorius":
        return SartoriusParser(default_unit=default_unit)
    return GenericParser(default_unit=default_unit)
