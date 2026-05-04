import { IndexedDbQueue } from './queue/indexeddb-queue';
import type { SubmissionQueue } from './queue/submission-queue';
import { TauriQueue } from './queue/tauri-queue';
import type { SerialAdapter } from './serial/adapter';
import { MockSerialAdapter } from './serial/mock-serial';
import { UnsupportedSerialAdapter } from './serial/unsupported-serial';
import { WebSocketSerialAdapter } from './serial/ws-serial';

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * 业界最佳实践：串口由后端持有，前端（Web/Tauri）都通过 WebSocket 订阅同一份事件流。
 *
 * 选择优先级：
 * 1. ?mock=1     → MockSerialAdapter（单测/演示）
 * 2. ?nomock=1   → UnsupportedSerialAdapter（强制不接，错误流测试）
 * 3. 默认        → WebSocketSerialAdapter（Web/Tauri 统一走后端 WS）
 *
 * 之前的 TauriSerialAdapter（Rust serialport-rs 直读）已废弃：
 * 协议解析逻辑在 Python 唯一一份，Tauri 端不再维护重复实现。
 */
export const isMockSerial = (): boolean => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('mock') === '1';
};

let cached: SerialAdapter | null = null;

export const getSerialAdapter = (): SerialAdapter => {
  if (cached) return cached;
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mock') === '1') {
      cached = new MockSerialAdapter();
      return cached;
    }
    if (params.get('nomock') === '1') {
      cached = new UnsupportedSerialAdapter();
      return cached;
    }
  }
  cached = new WebSocketSerialAdapter();
  return cached;
};

/** WebSocketSerialAdapter 需要知道当前操作的 scale id 才能 open/probe。
 *  非 WS 适配器调用本方法是 noop。 */
export const setActiveScaleId = (id: number | undefined): void => {
  if (cached instanceof WebSocketSerialAdapter) {
    cached.setScaleId(id);
  }
};

export const __resetSerialAdapterCache = (): void => {
  cached = null;
};

let queueCached: SubmissionQueue | null = null;

/**
 * 返回当前环境的 SubmissionQueue。
 * - Tauri 桌面：rusqlite 落盘（TauriQueue）
 * - 浏览器：IndexedDB（IndexedDbQueue）
 */
export const getSubmissionQueue = (): SubmissionQueue => {
  if (queueCached) return queueCached;
  queueCached = isTauri() ? new TauriQueue() : new IndexedDbQueue();
  return queueCached;
};

export const __resetSubmissionQueueCache = (): void => {
  queueCached = null;
};
