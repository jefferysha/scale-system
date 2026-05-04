import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScaleConfig } from './adapter';
import { GenericParser, MettlerParser, SartoriusParser, makeParser } from './protocol-parser';
import { WebSerialAdapter, __resetWebSerialRegistryForTests } from './web-serial';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function must<T>(v: T | undefined): T {
  if (v === undefined) throw new Error('test fixture missing');
  return v;
}

const baseConfig: ScaleConfig = {
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  flowControl: 'none',
  protocolType: 'mettler',
  readTimeoutMs: 1000,
  decimalPlaces: 4,
  unitDefault: 'g',
};

// ── ProtocolParser ──────────────────────────────────────────────────────────
describe('protocol-parser · MettlerParser', () => {
  it('parses stable line `S S 168.4521 g`', () => {
    const p = new MettlerParser();
    const out = p.feed(enc('S S 168.4521 g\r\n'));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ value: 168.4521, unit: 'g', stable: true });
  });

  it('parses dynamic line `S D 100.5 g` as unstable', () => {
    const p = new MettlerParser();
    const out = p.feed(enc('S D 100.5 g\n'));
    expect(out[0]?.stable).toBe(false);
  });

  it('buffers partial line until terminator arrives', () => {
    const p = new MettlerParser();
    expect(p.feed(enc('S S 12.34 ')).length).toBe(0);
    const out = p.feed(enc('g\r\n'));
    expect(out).toHaveLength(1);
    expect(must(out[0]).value).toBe(12.34);
  });

  it('rejects malformed line silently', () => {
    const p = new MettlerParser();
    expect(p.feed(enc('garbage line\r\n'))).toEqual([]);
  });
});

describe('protocol-parser · SartoriusParser', () => {
  it('treats `?` prefix as unstable', () => {
    const p = new SartoriusParser();
    const out = p.feed(enc('? 50.10 g\r\n'));
    expect(out[0]?.stable).toBe(false);
  });

  it('treats `+` prefix and bare value as stable', () => {
    const p = new SartoriusParser();
    expect(p.feed(enc('+ 50.10 g\r\n'))[0]?.stable).toBe(true);
    expect(p.feed(enc('50.10 g\r\n'))[0]?.stable).toBe(true);
  });

  it('treats `-` prefix as stable (matches Python parser semantics)', () => {
    // 与 Python 端行为对齐：'-' prefix 不进入 value，仅 '?' 视作 unstable。
    const p = new SartoriusParser();
    const out = p.feed(enc('- 0.5 g\r\n'));
    expect(out[0]?.stable).toBe(true);
    expect(out[0]?.value).toBe(0.5);
  });
});

describe('protocol-parser · GenericParser', () => {
  it('parses bare value with unit', () => {
    const p = new GenericParser();
    const out = p.feed(enc('168.4521 g\r\n'));
    expect(out[0]).toMatchObject({ value: 168.4521, unit: 'g', stable: true });
  });

  it('falls back to defaultUnit when unit absent', () => {
    const p = new GenericParser('mg');
    const out = p.feed(enc('100.5\r\n'));
    expect(out[0]?.unit).toBe('mg');
  });

  it('handles ohaus-style framed line `ST,GS,+0123.456 g`', () => {
    const p = new GenericParser();
    const out = p.feed(enc('ST,GS,+0123.456 g\r\n'));
    expect(out[0]?.value).toBe(123.456);
  });

  it('splits multiple lines in one chunk', () => {
    const p = new GenericParser();
    const out = p.feed(enc('1.0 g\r\n2.0 g\r\n3.0 g\r\n'));
    expect(out.map((s) => s.value)).toEqual([1.0, 2.0, 3.0]);
  });
});

describe('protocol-parser · makeParser', () => {
  it('returns the right concrete class for each protocol', () => {
    expect(makeParser('mettler')).toBeInstanceOf(MettlerParser);
    expect(makeParser('sartorius')).toBeInstanceOf(SartoriusParser);
    expect(makeParser('generic')).toBeInstanceOf(GenericParser);
    expect(makeParser('ohaus')).toBeInstanceOf(GenericParser);
  });
});

// ── WebSerialAdapter ────────────────────────────────────────────────────────

interface MockPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  getInfo: () => { usbVendorId?: number; usbProductId?: number };
}

function buildMockPort(opts: {
  chunks?: string[];
  vendorId?: number;
  productId?: number;
  failOpen?: boolean;
}): MockPort {
  const chunks = opts.chunks ?? [];
  const readable =
    chunks.length > 0
      ? new ReadableStream<Uint8Array>({
          start(controller) {
            for (const c of chunks) controller.enqueue(enc(c));
            controller.close();
          },
        })
      : new ReadableStream<Uint8Array>({ start: () => undefined });

  const port: MockPort = {
    readable: opts.failOpen ? null : readable,
    writable: null,
    open: vi.fn(async () => {
      if (opts.failOpen) throw new Error('cannot open');
    }),
    close: vi.fn(async () => undefined),
    getInfo: () => ({ usbVendorId: opts.vendorId, usbProductId: opts.productId }),
  };
  return port;
}

function installNavigatorSerial(ports: MockPort[]): {
  requestPort: ReturnType<typeof vi.fn>;
} {
  const requestPort = vi.fn(async () => ports[0] as unknown as never);
  Object.defineProperty(globalThis.navigator, 'serial', {
    configurable: true,
    value: { getPorts: async () => ports, requestPort },
  });
  return { requestPort };
}

describe('WebSerialAdapter', () => {
  beforeEach(() => {
    __resetWebSerialRegistryForTests();
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis.navigator, 'serial');
  });

  it('isSupported() reflects navigator.serial presence', () => {
    const a = new WebSerialAdapter();
    expect(a.isSupported()).toBe(false);
    installNavigatorSerial([]);
    expect(a.isSupported()).toBe(true);
  });

  it('listPorts() maps Web Serial ports → SerialPortInfo with vendor/product', async () => {
    installNavigatorSerial([buildMockPort({ vendorId: 0x067b, productId: 0x2303 })]);
    const a = new WebSerialAdapter();
    const ports = await a.listPorts();
    expect(ports).toHaveLength(1);
    const info = must(ports[0]);
    expect(info.label).toContain('USB 067B:2303');
    expect(info.vendor).toBe('067B');
    expect(info.product).toBe('2303');
  });

  it('open() emits opening → connected → reading and parses streamed bytes', async () => {
    installNavigatorSerial([buildMockPort({ chunks: ['S S 168.4521 g\r\n', 'S D 50.0 g\r\n'] })]);
    const a = new WebSerialAdapter();
    const info = must((await a.listPorts())[0]);
    const states: string[] = [];
    const samples: number[] = [];
    a.onStatus((s) => states.push(s));
    a.onWeight((s) => samples.push(s.value));
    await a.open(info.id, baseConfig);

    // 让 readLoop 把 controller.close() 的 done=true 跑完
    await vi.waitFor(() => {
      expect(samples).toEqual([168.4521, 50.0]);
    });
    expect(states.slice(0, 3)).toEqual(['opening', 'connected', 'reading']);
    expect(states).toContain('disconnected');
  });

  it('open() reports OPEN_FAILED and emits error status when port.open throws', async () => {
    installNavigatorSerial([buildMockPort({ failOpen: true })]);
    const a = new WebSerialAdapter();
    const info = must((await a.listPorts())[0]);
    const states: string[] = [];
    a.onStatus((s) => states.push(s));
    await expect(a.open(info.id, baseConfig)).rejects.toMatchObject({ code: 'OPEN_FAILED' });
    expect(states).toEqual(['opening', 'error']);
  });

  it('open() rejects unknown portId with PORT_NOT_FOUND', async () => {
    installNavigatorSerial([buildMockPort({})]);
    const a = new WebSerialAdapter();
    await expect(a.open('does-not-exist', baseConfig)).rejects.toMatchObject({
      code: 'PORT_NOT_FOUND',
    });
  });

  it('probe() collects samples within timeout window', async () => {
    installNavigatorSerial([buildMockPort({ chunks: ['+ 12.34 g\r\n+ 56.78 g\r\n'] })]);
    const a = new WebSerialAdapter();
    const info = must((await a.listPorts())[0]);
    const r = await a.probe(info.id, { ...baseConfig, protocolType: 'sartorius' }, 100);
    expect(r.ok).toBe(true);
    expect(r.samples.map((s) => s.value)).toEqual([12.34, 56.78]);
  });

  it('probe() returns TIMEOUT when no samples produced', async () => {
    installNavigatorSerial([buildMockPort({ chunks: [] })]);
    const a = new WebSerialAdapter();
    const info = must((await a.listPorts())[0]);
    const r = await a.probe(info.id, baseConfig, 30);
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('TIMEOUT');
  });

  it('requestPermission() returns null when user cancels', async () => {
    const ports: MockPort[] = [];
    const { requestPort } = installNavigatorSerial(ports);
    requestPort.mockRejectedValueOnce(new Error('user cancelled'));
    const a = new WebSerialAdapter();
    const r = await a.requestPermission();
    expect(r).toBeNull();
  });
});
