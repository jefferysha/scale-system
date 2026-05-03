import type {
  ConnectionState,
  ProbeResult,
  SerialAdapter,
  SerialError,
  SerialPortInfo,
  WeightSample,
} from './adapter';

export class UnsupportedSerialAdapter implements SerialAdapter {
  private err: SerialError = {
    code: 'UNSUPPORTED',
    message: '当前浏览器/平台不支持串口（试 Chrome/Edge 或桌面端）',
  };

  isSupported(): boolean {
    return false;
  }

  async listPorts(): Promise<SerialPortInfo[]> {
    return [];
  }

  async open(): Promise<void> {
    throw this.err;
  }

  async close(): Promise<void> {
    /* noop */
  }

  onWeight(_: (s: WeightSample) => void): () => void {
    return () => {};
  }

  onStatus(_: (s: ConnectionState) => void): () => void {
    return () => {};
  }

  onError(handler: (e: SerialError) => void): () => void {
    queueMicrotask(() => handler(this.err));
    return () => {};
  }

  async probe(): Promise<ProbeResult> {
    return { ok: false, samples: [], error: this.err };
  }
}
