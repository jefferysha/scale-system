"""每台天平一个 asyncio Task 持有串口连接 + 推 pubsub。

设计要点：
- **单点持有**：串口是独占资源，同一时刻只能有一个 reader。
- **断线自动重连**：指数退避，告知订阅者 status='error' → 'opening' → 'connected'。
- **协议无感**：connection_manager 不解析协议，只把字节交给 ProtocolParser。
- **事件广播**：通过 pubsub Topic 给所有 WebSocket 订阅者。
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import asdict, dataclass

import serial
import serial_asyncio_fast as serial_asyncio

from .protocol_parser import make_parser
from .pubsub import Event, Topic, get_topic_registry
from .types import ConnectionState, ScaleConfig, SerialError, WeightSample

logger = logging.getLogger(__name__)


@dataclass
class _Connection:
    task: asyncio.Task[None]
    transport_url: str
    config: ScaleConfig
    last_sample_ts: float = 0.0


class ConnectionManager:
    """全局单例：scale_id → 后台 reader Task。"""

    def __init__(self) -> None:
        self._conns: dict[int, _Connection] = {}
        self._lock = asyncio.Lock()

    async def connect(
        self,
        scale_id: int,
        transport_url: str,
        config: ScaleConfig,
    ) -> None:
        """打开连接（如已有则先关再开）。立即返回，连通性由后台 task 推 status 事件。"""
        async with self._lock:
            await self._disconnect_locked(scale_id)
            topic = get_topic_registry().get(scale_id)
            task = asyncio.create_task(
                self._reader_loop(scale_id, transport_url, config, topic),
                name=f"scale-reader-{scale_id}",
            )
            self._conns[scale_id] = _Connection(task=task, transport_url=transport_url, config=config)

    async def disconnect(self, scale_id: int) -> None:
        async with self._lock:
            await self._disconnect_locked(scale_id)

    async def _disconnect_locked(self, scale_id: int) -> None:
        existing = self._conns.pop(scale_id, None)
        if existing is None:
            return
        existing.task.cancel()
        try:
            await existing.task
        except (asyncio.CancelledError, Exception):
            pass

    def is_connected(self, scale_id: int) -> bool:
        return scale_id in self._conns

    async def reader_active_url(self, scale_id: int) -> str | None:
        c = self._conns.get(scale_id)
        return c.transport_url if c else None

    async def shutdown(self) -> None:
        async with self._lock:
            ids = list(self._conns.keys())
        for sid in ids:
            await self.disconnect(sid)

    # ── 后台 task ─────────────────────────────────────────────────────────
    async def _reader_loop(
        self,
        scale_id: int,
        transport_url: str,
        config: ScaleConfig,
        topic: Topic,
    ) -> None:
        backoff = 0.5
        while True:
            try:
                topic.publish(Event(type="status", payload={"state": ConnectionState.OPENING.value}))
                reader, writer = await self._open(transport_url, config)
                topic.publish(Event(type="status", payload={"state": ConnectionState.CONNECTED.value}))
                topic.publish(Event(type="status", payload={"state": ConnectionState.READING.value}))
                backoff = 0.5
                await self._read_forever(scale_id, reader, config, topic)
            except asyncio.CancelledError:
                topic.publish(Event(type="status", payload={"state": ConnectionState.DISCONNECTED.value}))
                raise
            except Exception as e:  # noqa: BLE001
                err = self._classify_error(e)
                logger.warning("scale %s reader error: %s", scale_id, err)
                topic.publish(Event(type="error", payload=asdict(err)))
                topic.publish(Event(type="status", payload={"state": ConnectionState.ERROR.value}))
                # 指数退避（cap 10s）
                await asyncio.sleep(min(backoff, 10.0))
                backoff = min(backoff * 2, 10.0)
            finally:
                try:
                    writer.close()  # type: ignore[possibly-undefined]
                except Exception:  # noqa: BLE001
                    pass

    @staticmethod
    async def _open(
        transport_url: str,
        config: ScaleConfig,
    ) -> tuple[asyncio.StreamReader, asyncio.StreamWriter]:
        """统一打开各种 transport（serial:// / socket:// / loop://）。"""
        # pyserial-asyncio 直接接受 serial_for_url 兼容的 URL
        return await serial_asyncio.open_serial_connection(
            url=transport_url,
            baudrate=config.baud_rate,
            bytesize=config.data_bits,
            parity=_parity(config.parity),
            stopbits=config.stop_bits,
            rtscts=(config.flow_control == "hardware"),
        )

    @staticmethod
    async def _read_forever(
        scale_id: int,
        reader: asyncio.StreamReader,
        config: ScaleConfig,
        topic: Topic,
    ) -> None:
        parser = make_parser(config.protocol_type, default_unit=config.unit_default)
        last_value: float | None = None
        last_change_ts: float = time.time()
        stable_threshold_s = config.read_timeout_ms / 1000.0
        while True:
            chunk = await reader.read(256)
            if not chunk:
                # EOF → 当作连接断开抛出去触发重连
                raise ConnectionError("eof")
            samples = parser.feed(chunk)
            now = time.time()
            for s in samples:
                # generic 协议下用"超过 read_timeout 未变化"判 stable
                if config.protocol_type == "generic":
                    if last_value is None or abs(s.value - last_value) > 10 ** (-config.decimal_places):
                        last_value = s.value
                        last_change_ts = now
                        s = WeightSample(s.value, s.unit, False, s.raw, s.ts)
                    elif now - last_change_ts >= stable_threshold_s:
                        s = WeightSample(s.value, s.unit, True, s.raw, s.ts)
                    else:
                        s = WeightSample(s.value, s.unit, False, s.raw, s.ts)
                topic.publish(Event(type="sample", payload=asdict(s)))

    @staticmethod
    def _classify_error(e: Exception) -> SerialError:
        msg = str(e)
        if isinstance(e, serial.SerialException):
            if "permission" in msg.lower():
                return SerialError(code="PERMISSION_DENIED", message=msg)
            if "device not configured" in msg.lower() or "no such" in msg.lower():
                return SerialError(code="PORT_NOT_FOUND", message=msg)
            return SerialError(code="IO_ERROR", message=msg)
        if isinstance(e, asyncio.TimeoutError):
            return SerialError(code="TIMEOUT", message="read timeout")
        if isinstance(e, (ConnectionError, OSError)):
            return SerialError(code="IO_ERROR", message=msg)
        return SerialError(code="UNKNOWN", message=msg)


def _parity(p: str) -> str:
    return {"none": serial.PARITY_NONE, "even": serial.PARITY_EVEN, "odd": serial.PARITY_ODD}[p]


_manager: ConnectionManager | None = None


def get_connection_manager() -> ConnectionManager:
    global _manager
    if _manager is None:
        _manager = ConnectionManager()
    return _manager
