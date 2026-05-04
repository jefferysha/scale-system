/**
 * 后端 WebSocket 单源串口适配器：业界最佳实践，Web/Tauri 都用这一份。
 *
 * 流程：
 *  - listPorts: GET /api/v1/serial/ports
 *  - probe:     POST /api/v1/scales/{id}/probe-live
 *  - open:      POST /api/v1/scales/{id}/connect → 握手 WS /api/v1/ws/scale/{id}
 *  - 实时:      WS 推 sample/status/error → 调本地 handler
 */
import { api, getAccessToken } from '@/lib/api/client';
import type {
  ConnectionState,
  ProbeResult,
  ScaleConfig,
  SerialAdapter,
  SerialError,
  SerialPortInfo,
  WeightSample,
} from './adapter';

interface WsEvent {
  type: 'sample' | 'status' | 'error';
  payload: Record<string, unknown>;
}

const wsBase = (): string => {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  // nginx 反代 /api 到后端，WS 同路径前缀
  return `${proto}://${location.host}/api/v1`;
};

export interface WsAdapterOptions {
  /** 当前要操作的天平 id；不传时 listPorts/probe 仍能用，但 open 会报错 */
  scaleId?: number;
}

export class WebSocketSerialAdapter implements SerialAdapter {
  private ws: WebSocket | null = null;
  private weightHandlers = new Set<(s: WeightSample) => void>();
  private statusHandlers = new Set<(s: ConnectionState) => void>();
  private errorHandlers = new Set<(e: SerialError) => void>();
  private scaleId: number | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: WsAdapterOptions = {}) {
    this.scaleId = opts.scaleId;
  }

  setScaleId(id: number | undefined): void {
    this.scaleId = id;
  }

  isSupported(): boolean {
    return typeof WebSocket !== 'undefined';
  }

  async listPorts(): Promise<SerialPortInfo[]> {
    const r = await api.get<SerialPortInfo[]>('/serial/ports');
    return r.data;
  }

  async open(portId: string, _config: ScaleConfig): Promise<void> {
    if (this.scaleId === undefined) {
      throw { code: 'UNSUPPORTED', message: '请先选择天平' } satisfies SerialError;
    }
    // 1) 让后端打开物理串口 + 起后台 reader task
    await api.post(`/scales/${this.scaleId}/connect`, { port_id: portId });
    // 2) 订阅事件流
    this.connectWs();
  }

  async close(): Promise<void> {
    if (this.scaleId !== undefined) {
      try {
        await api.post(`/scales/${this.scaleId}/disconnect`);
      } catch {
        // 忽略：reader 可能已自然终止
      }
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.statusHandlers.forEach((h) => h('disconnected'));
  }

  onWeight(handler: (s: WeightSample) => void): () => void {
    this.weightHandlers.add(handler);
    return () => {
      this.weightHandlers.delete(handler);
    };
  }

  onStatus(handler: (s: ConnectionState) => void): () => void {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  onError(handler: (e: SerialError) => void): () => void {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  async probe(portId: string, config: ScaleConfig, timeoutMs: number): Promise<ProbeResult> {
    /** standalone 端点不依赖已存的 scale，create 模式也能用。 */
    const url = this.scaleId !== undefined
      ? `/scales/${this.scaleId}/probe-live`
      : '/serial/probe-live';
    const body =
      this.scaleId !== undefined
        ? { port_id: portId, timeout_ms: timeoutMs }
        : {
            port_id: portId,
            timeout_ms: timeoutMs,
            baud_rate: config.baudRate,
            data_bits: config.dataBits,
            parity: config.parity,
            stop_bits: config.stopBits,
            flow_control: config.flowControl === 'hardware' ? 'rtscts' : 'none',
            protocol_type: config.protocolType,
            decimal_places: config.decimalPlaces,
            unit_default: config.unitDefault,
          };
    try {
      const r = await api.post<{
        ok: boolean;
        samples: { value: number; unit: string; stable: boolean; raw: string; ts: number }[];
        error: { code: string; message: string } | null;
      }>(url, body);
      return {
        ok: r.data.ok,
        samples: r.data.samples.map((s) => ({
          value: s.value,
          unit: s.unit as 'g' | 'mg' | 'kg',
          stable: s.stable,
          raw: s.raw,
          ts: s.ts * 1000, // python ts 是秒，前端用毫秒
        })),
        error: r.data.error
          ? { code: r.data.error.code as SerialError['code'], message: r.data.error.message }
          : undefined,
      };
    } catch (e) {
      return {
        ok: false,
        samples: [],
        error: {
          code: 'IO_ERROR',
          message: e instanceof Error ? e.message : '探测失败',
        },
      };
    }
  }

  // ── 内部 ─────────────────────────────────────────────────────────────
  private connectWs(): void {
    if (this.scaleId === undefined) return;
    const token = getAccessToken();
    const tokenQs = token ? `?access_token=${encodeURIComponent(token)}` : '';
    const url = `${wsBase()}/ws/scale/${this.scaleId}${tokenQs}`;
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => this.dispatch(e.data);
    this.ws.onclose = () => {
      // 自动重连：3s 后试一次（除非已主动 close）
      if (this.scaleId !== undefined) {
        this.reconnectTimer = setTimeout(() => this.connectWs(), 3000);
      }
    };
    this.ws.onerror = () => {
      this.errorHandlers.forEach((h) =>
        h({ code: 'IO_ERROR', message: 'WebSocket 连接失败' }),
      );
    };
  }

  private dispatch(raw: string): void {
    let event: WsEvent;
    try {
      event = JSON.parse(raw) as WsEvent;
    } catch {
      return;
    }
    if (event.type === 'sample') {
      const p = event.payload;
      const sample: WeightSample = {
        value: Number(p.value),
        unit: String(p.unit) as 'g' | 'mg' | 'kg',
        stable: Boolean(p.stable),
        raw: String(p.raw ?? ''),
        ts: Number(p.ts) * 1000,
      };
      this.weightHandlers.forEach((h) => h(sample));
    } else if (event.type === 'status') {
      const state = String(event.payload.state) as ConnectionState;
      this.statusHandlers.forEach((h) => h(state));
    } else if (event.type === 'error') {
      const e: SerialError = {
        code: String(event.payload.code) as SerialError['code'],
        message: String(event.payload.message),
      };
      this.errorHandlers.forEach((h) => h(e));
    }
  }
}
