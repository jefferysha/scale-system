/**
 * Web Serial 直连适配器：浏览器（含 Tauri webview）通过 navigator.serial 直读 USB 天平。
 *
 * 关键约束：
 *  - 浏览器仅支持 Chromium 系（Chrome / Edge / Opera）；Safari/Firefox 走 UnsupportedSerialAdapter。
 *  - 必须 secure context（HTTPS 或 localhost）。
 *  - 第一次必须用户手势触发 requestPort()；之后 getPorts() 能拿回已授权列表。
 *
 * 适配策略：
 *  - listPorts(): 只返回 getPorts() 已授权的端口；首次空列表，UI 提示用户调 requestPermission()。
 *  - open(portId, config): 用 ScaleConfig 打开物理串口 + 启动后台 readLoop + 推 weight/status。
 *  - close(): cancel reader → 释放 lock → port.close()。
 *  - probe(portId, config, ms): 临时打开收 N 秒样本后关闭，独占于 open()，互斥。
 */

import type {
  ConnectionState,
  ProbeResult,
  ScaleConfig,
  SerialAdapter,
  SerialError,
  SerialPortInfo,
  WeightSample,
} from './adapter';
import { makeParser, type ProtocolParser } from './protocol-parser';

// ── Web Serial API 浏览器类型声明（TS lib.dom 暂未包含） ──────────────────
interface WebSerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}
interface WebSerialOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  flowControl?: 'none' | 'hardware';
}
interface WebSerialPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: WebSerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): WebSerialPortInfo;
}
interface WebSerialNavigator {
  getPorts(): Promise<WebSerialPort[]>;
  requestPort(options?: { filters?: { usbVendorId?: number }[] }): Promise<WebSerialPort>;
}
declare global {
  interface Navigator {
    serial?: WebSerialNavigator;
  }
}

// ── 端口注册表：Web Serial 句柄无序列化 id，自己造一份 ──────────────────────
const PORT_BY_ID = new Map<string, WebSerialPort>();
const ID_BY_PORT = new WeakMap<WebSerialPort, string>();
let portIdSeq = 0;

const hex = (n: number): string => n.toString(16).padStart(4, '0').toUpperCase();

function registerPort(port: WebSerialPort): SerialPortInfo {
  let id = ID_BY_PORT.get(port);
  if (!id) {
    id = `webserial-${++portIdSeq}`;
    ID_BY_PORT.set(port, id);
    PORT_BY_ID.set(id, port);
  }
  const info = port.getInfo();
  const vidpid =
    info.usbVendorId !== undefined && info.usbProductId !== undefined
      ? `USB ${hex(info.usbVendorId)}:${hex(info.usbProductId)}`
      : '串口设备';
  return {
    id,
    label: vidpid,
    vendor: info.usbVendorId !== undefined ? hex(info.usbVendorId) : undefined,
    product: info.usbProductId !== undefined ? hex(info.usbProductId) : undefined,
  };
}

function toSerialOptions(c: ScaleConfig): WebSerialOptions {
  return {
    baudRate: c.baudRate,
    dataBits: c.dataBits,
    stopBits: c.stopBits,
    parity: c.parity,
    flowControl: c.flowControl,
  };
}

interface OpenedPort {
  port: WebSerialPort;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  parser: ProtocolParser;
  closing: boolean;
}

export class WebSerialAdapter implements SerialAdapter {
  private opened: OpenedPort | null = null;
  private weightHandlers = new Set<(s: WeightSample) => void>();
  private statusHandlers = new Set<(s: ConnectionState) => void>();
  private errorHandlers = new Set<(e: SerialError) => void>();

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && navigator.serial !== undefined;
  }

  async listPorts(): Promise<SerialPortInfo[]> {
    if (!this.isSupported()) return [];
    const ports = await navigator.serial!.getPorts();
    return ports.map(registerPort);
  }

  /**
   * 触发浏览器原生设备选择器。**必须在用户手势 handler 内调用**（如 button click）。
   * 用户取消选择返回 null。授权成功后端口自动加入 listPorts() 结果。
   */
  async requestPermission(): Promise<SerialPortInfo | null> {
    if (!this.isSupported()) return null;
    try {
      const port = await navigator.serial!.requestPort();
      return registerPort(port);
    } catch {
      return null;
    }
  }

  async open(portId: string, config: ScaleConfig): Promise<void> {
    if (!this.isSupported()) {
      throw { code: 'UNSUPPORTED', message: '浏览器不支持 Web Serial API' } satisfies SerialError;
    }
    if (this.opened) {
      throw { code: 'PORT_BUSY', message: '已有连接，请先 close()' } satisfies SerialError;
    }
    const port = PORT_BY_ID.get(portId);
    if (!port) {
      throw { code: 'PORT_NOT_FOUND', message: `未知串口 ${portId}` } satisfies SerialError;
    }

    this.statusHandlers.forEach((h) => h('opening'));
    try {
      await port.open(toSerialOptions(config));
    } catch (e) {
      this.statusHandlers.forEach((h) => h('error'));
      throw {
        code: 'OPEN_FAILED',
        message: e instanceof Error ? e.message : '串口打开失败',
      } satisfies SerialError;
    }

    if (!port.readable) {
      try {
        await port.close();
      } catch {
        // ignore
      }
      this.statusHandlers.forEach((h) => h('error'));
      throw { code: 'IO_ERROR', message: 'readable 流不可用' } satisfies SerialError;
    }

    const reader = port.readable.getReader();
    const parser = makeParser(config.protocolType, config.unitDefault);
    this.opened = { port, reader, parser, closing: false };
    this.statusHandlers.forEach((h) => h('connected'));
    this.statusHandlers.forEach((h) => h('reading'));
    void this.readLoop();
  }

  private async readLoop(): Promise<void> {
    if (!this.opened) return;
    const session = this.opened;
    try {
      while (!session.closing) {
        const { value, done } = await session.reader.read();
        if (done) break;
        if (!value || value.byteLength === 0) continue;
        const samples = session.parser.feed(value);
        for (const s of samples) {
          this.weightHandlers.forEach((h) => h(s));
        }
      }
    } catch (e) {
      if (!session.closing) {
        this.errorHandlers.forEach((h) =>
          h({
            code: 'IO_ERROR',
            message: e instanceof Error ? e.message : '串口读取异常',
          }),
        );
      }
    } finally {
      if (this.opened === session) {
        this.opened = null;
      }
      this.statusHandlers.forEach((h) => h('disconnected'));
    }
  }

  async close(): Promise<void> {
    const session = this.opened;
    if (!session) return;
    session.closing = true;
    try {
      await session.reader.cancel();
    } catch {
      // ignore
    }
    try {
      session.reader.releaseLock();
    } catch {
      // ignore
    }
    try {
      await session.port.close();
    } catch {
      // ignore
    }
    if (this.opened === session) {
      this.opened = null;
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

  async probe(portId: string, config: ScaleConfig, timeoutMs: number): Promise<ProbeResult> {
    if (!this.isSupported()) {
      return {
        ok: false,
        samples: [],
        error: { code: 'UNSUPPORTED', message: '浏览器不支持 Web Serial API' },
      };
    }
    const port = PORT_BY_ID.get(portId);
    if (!port) {
      return {
        ok: false,
        samples: [],
        error: { code: 'PORT_NOT_FOUND', message: `未知串口 ${portId}` },
      };
    }
    if (this.opened) {
      return {
        ok: false,
        samples: [],
        error: { code: 'PORT_BUSY', message: '已有连接占用，请先 close()' },
      };
    }

    let didOpen = false;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    try {
      await port.open(toSerialOptions(config));
      didOpen = true;
      if (!port.readable) {
        return {
          ok: false,
          samples: [],
          error: { code: 'IO_ERROR', message: 'readable 流不可用' },
        };
      }
      reader = port.readable.getReader();
      const parser = makeParser(config.protocolType, config.unitDefault);
      const samples: WeightSample[] = [];
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const remain = Math.max(0, deadline - Date.now());
        const winner = await Promise.race<
          { kind: 'data'; done: boolean; value?: Uint8Array } | { kind: 'timeout' }
        >([
          reader.read().then((r) => ({ kind: 'data' as const, done: r.done, value: r.value })),
          new Promise((res) => setTimeout(() => res({ kind: 'timeout' as const }), remain)),
        ]);
        if (winner.kind === 'timeout') break;
        if (winner.done) break;
        if (!winner.value) continue;
        for (const s of parser.feed(winner.value)) samples.push(s);
      }

      return samples.length > 0
        ? { ok: true, samples }
        : {
            ok: false,
            samples: [],
            error: { code: 'TIMEOUT', message: `${timeoutMs}ms 内未收到有效样本` },
          };
    } catch (e) {
      const err = e as Partial<SerialError> & Error;
      return {
        ok: false,
        samples: [],
        error: {
          code: (err.code as SerialError['code']) ?? 'IO_ERROR',
          message: err.message ?? '探测失败',
        },
      };
    } finally {
      if (reader) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        try {
          reader.releaseLock();
        } catch {
          // ignore
        }
      }
      if (didOpen) {
        try {
          await port.close();
        } catch {
          // ignore
        }
      }
    }
  }
}

/** 仅供单测使用：清空端口注册表与 id 计数器。 */
export const __resetWebSerialRegistryForTests = (): void => {
  PORT_BY_ID.clear();
  portIdSeq = 0;
};
