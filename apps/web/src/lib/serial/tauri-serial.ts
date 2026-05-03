/**
 * Tauri 桌面端 SerialAdapter 实现。
 *
 * - listPorts/open/close/probe：调 Rust 端 Tauri command
 * - onWeight/onStatus/onError：监听 Rust emit 的 `scale-weight/status/error` 事件
 *
 * 配置字段名转换：前端 camelCase ↔ Rust snake_case
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type {
  ConnectionState,
  ProbeResult,
  ScaleConfig,
  SerialAdapter,
  SerialError,
  SerialErrorCode,
  SerialPortInfo,
  WeightSample,
} from './adapter';

interface RustScaleConfig {
  baud_rate: number;
  data_bits: number;
  parity: string;
  stop_bits: number;
  flow_control: string;
  protocol_type: string;
  read_timeout_ms: number;
  decimal_places: number;
  unit_default: string;
}

interface RustWeightSample {
  value: number;
  unit: string;
  stable: boolean;
  raw: string;
  ts: number;
}

interface RustSerialError {
  code: string;
  message?: string;
}

interface RustProbeResult {
  ok: boolean;
  samples: RustWeightSample[];
  error: RustSerialError | null;
}

const toRustConfig = (c: ScaleConfig): RustScaleConfig => ({
  baud_rate: c.baudRate,
  data_bits: c.dataBits,
  parity: c.parity,
  stop_bits: c.stopBits,
  flow_control: c.flowControl,
  protocol_type: c.protocolType,
  read_timeout_ms: c.readTimeoutMs,
  decimal_places: c.decimalPlaces,
  unit_default: c.unitDefault,
});

const fromRustSample = (s: RustWeightSample): WeightSample => ({
  value: s.value,
  unit: (s.unit as WeightSample['unit']) || 'g',
  stable: s.stable,
  raw: s.raw,
  ts: s.ts,
});

const RUST_TO_FE_CODE: Record<string, SerialErrorCode> = {
  PermissionDenied: 'PERMISSION_DENIED',
  PortNotFound: 'PORT_NOT_FOUND',
  PortBusy: 'PORT_BUSY',
  OpenFailed: 'OPEN_FAILED',
  Timeout: 'TIMEOUT',
  ParseError: 'PARSE_ERROR',
  IoError: 'IO_ERROR',
  ClosedByDevice: 'CLOSED_BY_DEVICE',
  Cancelled: 'CANCELLED',
  Unknown: 'UNKNOWN',
};

const fromRustError = (e: RustSerialError): SerialError => ({
  code: RUST_TO_FE_CODE[e.code] ?? 'UNKNOWN',
  message: e.message ?? e.code,
});

export class TauriSerialAdapter implements SerialAdapter {
  isSupported(): boolean {
    return true;
  }

  async listPorts(): Promise<SerialPortInfo[]> {
    return invoke<SerialPortInfo[]>('list_ports');
  }

  async open(portId: string, config: ScaleConfig): Promise<void> {
    await invoke('open_serial', { portId, config: toRustConfig(config) });
  }

  async close(): Promise<void> {
    await invoke('close_serial');
  }

  onWeight(handler: (s: WeightSample) => void): () => void {
    return makeUnlistener(
      listen<RustWeightSample>('scale-weight', (e) => handler(fromRustSample(e.payload))),
    );
  }

  onStatus(handler: (s: ConnectionState) => void): () => void {
    return makeUnlistener(listen<ConnectionState>('scale-status', (e) => handler(e.payload)));
  }

  onError(handler: (e: SerialError) => void): () => void {
    return makeUnlistener(
      listen<RustSerialError>('scale-error', (e) => handler(fromRustError(e.payload))),
    );
  }

  async probe(portId: string, config: ScaleConfig, timeoutMs: number): Promise<ProbeResult> {
    const r = await invoke<RustProbeResult>('probe_serial', {
      portId,
      config: toRustConfig(config),
      timeoutMs,
    });
    return {
      ok: r.ok,
      samples: r.samples.map(fromRustSample),
      error: r.error ? fromRustError(r.error) : undefined,
    };
  }
}

/** 把 listen() 的 promise 包成同步可调用的 unsubscribe，并发竞态安全。 */
function makeUnlistener(p: Promise<UnlistenFn>): () => void {
  let unlisten: UnlistenFn | null = null;
  let cancelled = false;
  void p.then((fn) => {
    if (cancelled) {
      fn();
    } else {
      unlisten = fn;
    }
  });
  return () => {
    cancelled = true;
    if (unlisten) unlisten();
  };
}
