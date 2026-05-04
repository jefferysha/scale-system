"""串口连接控制 + 实时事件推送。

REST：
  GET    /api/v1/serial/ports                  列出后端可见端口（受 transport 约束）
  POST   /api/v1/scales/{id}/connect           打开连接（body: {port_id?: str}）
  POST   /api/v1/scales/{id}/disconnect        关闭连接
  GET    /api/v1/scales/{id}/connection        当前状态
  POST   /api/v1/scales/{id}/probe-live        一次性探测（用配置打开 N 秒收样本）

WebSocket：
  WS     /api/v1/ws/scale/{id}                 推 sample / status / error
"""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel

from scale_api.api.deps import CurrentUser, DBSession
from scale_api.core.config import get_settings
from scale_api.serial.connection_manager import get_connection_manager
from scale_api.serial.protocol_parser import make_parser
from scale_api.serial.pubsub import get_topic_registry
from scale_api.serial.types import ScaleConfig
from scale_api.services.scale_service import ScaleService

logger = logging.getLogger(__name__)
router = APIRouter()


class SerialPortInfo(BaseModel):
    id: str
    label: str
    vendor: str | None = None
    product: str | None = None


class ConnectRequest(BaseModel):
    """可选指定 port_id；不传则用 settings.scale_default_transport。"""
    port_id: str | None = None


class ConnectionStatus(BaseModel):
    connected: bool
    transport_url: str | None
    subscriber_count: int


class ProbeLiveRequest(BaseModel):
    port_id: str | None = None
    timeout_ms: int = 3000


class StandaloneProbeRequest(BaseModel):
    """create 模式（还没存 scale）也能探测：完整 config 都传 body。"""
    port_id: str | None = None
    timeout_ms: int = 3000
    baud_rate: int = 9600
    data_bits: int = 8
    parity: str = "none"
    stop_bits: int = 1
    flow_control: str = "none"
    protocol_type: str = "generic"
    decimal_places: int = 4
    unit_default: str = "g"


class ProbeLiveResult(BaseModel):
    ok: bool
    samples: list[dict[str, Any]]
    error: dict[str, str] | None = None


def _resolve_transport(port_id: str | None) -> str | None:
    """决定 pyserial.serial_for_url 用的 URL：
    - 显式 port_id 优先（serial:///dev/ttyUSB0 或 socket://host:port）
    - 否则取 settings.scale_default_transport
    """
    if port_id:
        # 让用户传 raw URL（serial://...、socket://...、tcp://...、loop://），
        # 也支持只传设备路径自动加 serial:// 前缀
        if "://" in port_id:
            return port_id
        return f"serial://{port_id}" if not port_id.startswith("/") else f"serial://{port_id}"
    return get_settings().scale_default_transport


# ── REST: ports ─────────────────────────────────────────────────────────────
@router.get("/serial/ports", response_model=list[SerialPortInfo])
async def list_ports(_: CurrentUser) -> list[SerialPortInfo]:
    """列后端可见端口。

    - 配置了 socket:// / tcp:// → 返回固定的 "remote" 端口（已通过桥接）
    - 配置了 serial:// 或没配置 → 用 pyserial.tools.list_ports 真实扫描
    """
    settings = get_settings()
    transport = settings.scale_default_transport or ""
    if transport.startswith(("socket://", "tcp://", "rfc2217://")):
        return [
            SerialPortInfo(
                id=transport,
                label=f"远端串口（已桥接）· {transport}",
                vendor="bridge",
            )
        ]
    if transport.startswith("loop://"):
        return [SerialPortInfo(id="loop://", label="测试回环（loop）", vendor="loop")]

    # 真实扫描
    try:
        from serial.tools import list_ports as _list_ports
        ports = _list_ports.comports()
        return [
            SerialPortInfo(
                id=p.device,
                label=f"{p.device} · {p.description or '未命名'}",
                vendor=p.manufacturer,
                product=p.product,
            )
            for p in ports
        ]
    except Exception as e:  # noqa: BLE001
        logger.warning("list_ports failed: %s", e)
        return []


# ── REST: connect / disconnect / status ─────────────────────────────────────
@router.post("/scales/{scale_id}/connect")
async def connect_scale(
    scale_id: int,
    body: ConnectRequest,
    _: CurrentUser,
    session: DBSession,
) -> ConnectionStatus:
    transport = _resolve_transport(body.port_id)
    if not transport:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "UNCONFIGURED",
                    "message": "未配置 SCALE_DEFAULT_TRANSPORT 也未传 port_id",
                }
            },
        )
    scale = await ScaleService(session).get(scale_id)
    cfg = ScaleConfig(
        baud_rate=scale.baud_rate,
        data_bits=scale.data_bits,  # type: ignore[arg-type]
        parity=scale.parity,  # type: ignore[arg-type]
        stop_bits=scale.stop_bits,  # type: ignore[arg-type]
        flow_control="hardware" if scale.flow_control != "none" else "none",
        protocol_type=scale.protocol_type,  # type: ignore[arg-type]
        read_timeout_ms=scale.read_timeout_ms,
        decimal_places=scale.decimal_places,
        unit_default=scale.unit_default,  # type: ignore[arg-type]
    )
    cm = get_connection_manager()
    await cm.connect(scale_id, transport, cfg)
    topic = get_topic_registry().get(scale_id)
    return ConnectionStatus(
        connected=True,
        transport_url=transport,
        subscriber_count=topic.subscriber_count,
    )


@router.post("/scales/{scale_id}/disconnect")
async def disconnect_scale(scale_id: int, _: CurrentUser) -> ConnectionStatus:
    await get_connection_manager().disconnect(scale_id)
    return ConnectionStatus(connected=False, transport_url=None, subscriber_count=0)


@router.get("/scales/{scale_id}/connection", response_model=ConnectionStatus)
async def get_connection(scale_id: int, _: CurrentUser) -> ConnectionStatus:
    cm = get_connection_manager()
    url = await cm.reader_active_url(scale_id)
    topic = get_topic_registry().get(scale_id)
    return ConnectionStatus(
        connected=cm.is_connected(scale_id),
        transport_url=url,
        subscriber_count=topic.subscriber_count,
    )


async def _do_probe(
    transport: str,
    baud_rate: int,
    data_bits: int,
    parity: str,
    stop_bits: int,
    flow_control: str,
    protocol_type: str,
    unit_default: str,
    timeout_ms: int,
) -> ProbeLiveResult:
    """共享的探测核心：打开 transport、读样本、关闭。"""
    import serial_asyncio_fast as sa

    parser = make_parser(protocol_type, default_unit=unit_default)  # type: ignore[arg-type]
    samples: list[dict[str, Any]] = []
    try:
        reader, writer = await asyncio.wait_for(
            sa.open_serial_connection(
                url=transport,
                baudrate=baud_rate,
                bytesize=data_bits,
                parity={"none": "N", "odd": "O", "even": "E"}[parity],
                stopbits=stop_bits,
                rtscts=(flow_control != "none"),
            ),
            timeout=2.0,
        )
        try:
            deadline = asyncio.get_event_loop().time() + timeout_ms / 1000.0
            while len(samples) < 5:
                remaining = deadline - asyncio.get_event_loop().time()
                if remaining <= 0:
                    break
                try:
                    chunk = await asyncio.wait_for(reader.read(256), timeout=remaining)
                except asyncio.TimeoutError:
                    break
                if not chunk:
                    break
                for s in parser.feed(chunk):
                    samples.append(asdict(s))
                    if len(samples) >= 5:
                        break
        finally:
            writer.close()
    except Exception as e:  # noqa: BLE001
        return ProbeLiveResult(
            ok=False,
            samples=samples,
            error={"code": "IO_ERROR", "message": str(e)},
        )
    return ProbeLiveResult(ok=len(samples) > 0, samples=samples, error=None)


@router.post("/serial/probe-live", response_model=ProbeLiveResult)
async def probe_live_standalone(
    body: StandaloneProbeRequest,
    _: CurrentUser,
) -> ProbeLiveResult:
    """create 模式探测：不依赖已存的 Scale，所有参数从 body 传入。"""
    transport = _resolve_transport(body.port_id)
    if not transport:
        return ProbeLiveResult(
            ok=False,
            samples=[],
            error={"code": "UNCONFIGURED", "message": "未配置 transport"},
        )
    return await _do_probe(
        transport=transport,
        baud_rate=body.baud_rate,
        data_bits=body.data_bits,
        parity=body.parity,
        stop_bits=body.stop_bits,
        flow_control=body.flow_control,
        protocol_type=body.protocol_type,
        unit_default=body.unit_default,
        timeout_ms=body.timeout_ms,
    )


# ── REST: probe-live ─────────────────────────────────────────────────────────
@router.post("/scales/{scale_id}/probe-live", response_model=ProbeLiveResult)
async def probe_live(
    scale_id: int,
    body: ProbeLiveRequest,
    _: CurrentUser,
    session: DBSession,
) -> ProbeLiveResult:
    """edit 模式探测：用已存的 scale 配置 + body.port_id。"""
    transport = _resolve_transport(body.port_id)
    if not transport:
        return ProbeLiveResult(
            ok=False,
            samples=[],
            error={"code": "UNCONFIGURED", "message": "未配置 transport"},
        )
    scale = await ScaleService(session).get(scale_id)
    return await _do_probe(
        transport=transport,
        baud_rate=scale.baud_rate,
        data_bits=scale.data_bits,
        parity=scale.parity,
        stop_bits=scale.stop_bits,
        flow_control=scale.flow_control,
        protocol_type=scale.protocol_type,
        unit_default=scale.unit_default,
        timeout_ms=body.timeout_ms,
    )


# ── WebSocket ────────────────────────────────────────────────────────────────
@router.websocket("/ws/scale/{scale_id}")
async def ws_scale(websocket: WebSocket, scale_id: int) -> None:
    """订阅指定 scale 的事件流。

    简化：不做 token 鉴权（同源 cookie 已经经 nginx 透传）。
    生产可在握手期校验 query 参数中的 access_token。
    """
    await websocket.accept()
    topic = get_topic_registry().get(scale_id)
    cm = get_connection_manager()
    # 立即推一次当前状态，让前端不用等下一个事件就能渲染
    await websocket.send_text(
        json.dumps(
            {
                "type": "status",
                "payload": {
                    "state": "reading" if cm.is_connected(scale_id) else "disconnected",
                },
            }
        )
    )
    try:
        async for event in topic.subscribe():
            await websocket.send_text(
                json.dumps({"type": event.type, "payload": event.payload})
            )
    except WebSocketDisconnect:
        return
    except Exception as e:  # noqa: BLE001
        logger.warning("ws scale %s error: %s", scale_id, e)
