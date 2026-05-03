import type {
  ConnectionState,
  ProbeResult,
  ScaleConfig,
  SerialAdapter,
  SerialError,
  SerialPortInfo,
  WeightSample,
} from './adapter';

/**
 * 测试/演示用 mock SerialAdapter。
 * 启动后每 100ms emit 一个重量样本，权重在目标值附近抖动。
 * 5s 后稳定（stable=true）。
 */
export class MockSerialAdapter implements SerialAdapter {
  private weightHandlers = new Set<(s: WeightSample) => void>();
  private statusHandlers = new Set<(s: ConnectionState) => void>();
  private errorHandlers = new Set<(e: SerialError) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private opened = false;

  isSupported(): boolean {
    return true;
  }

  async listPorts(): Promise<SerialPortInfo[]> {
    return [
      { id: 'mock-com3', label: 'MOCK COM3 (Mettler XS204)', vendor: 'Mock', product: 'XS204' },
      { id: 'mock-com4', label: 'MOCK COM4 (Sartorius Quintix224)', vendor: 'Mock', product: 'Quintix224' },
    ];
  }

  async open(_portId: string, _config: ScaleConfig): Promise<void> {
    this.opened = true;
    this.startedAt = Date.now();
    this.statusHandlers.forEach((h) => h('opening'));
    setTimeout(() => {
      if (!this.opened) return;
      this.statusHandlers.forEach((h) => h('connected'));
      this.statusHandlers.forEach((h) => h('reading'));
      this.timer = setInterval(() => this.emitSample(), 100);
    }, 250);
  }

  async close(): Promise<void> {
    this.opened = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
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

  async probe(_portId: string, _config: ScaleConfig, timeoutMs: number): Promise<ProbeResult> {
    const samples: WeightSample[] = [];
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && samples.length < 5) {
      await new Promise((r) => setTimeout(r, 100));
      samples.push(this.makeSample(false));
    }
    return { ok: true, samples };
  }

  private emitSample(): void {
    const sample = this.makeSample(Date.now() - this.startedAt > 5000);
    this.weightHandlers.forEach((h) => h(sample));
  }

  private makeSample(stable: boolean): WeightSample {
    const target = 168.4521;
    const noise = stable ? (Math.random() - 0.5) * 0.0008 : (Math.random() - 0.5) * 0.05;
    const value = Number((target + noise).toFixed(4));
    return {
      value,
      unit: 'g',
      stable,
      raw: `S ${stable ? 'S' : 'D'} ${value.toFixed(4)} g\r\n`,
      ts: Date.now(),
    };
  }
}
