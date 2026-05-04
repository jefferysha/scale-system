import { IndexedDbQueue } from './queue/indexeddb-queue';
import type { SubmissionQueue } from './queue/submission-queue';
import { TauriQueue } from './queue/tauri-queue';
import type { SerialAdapter } from './serial/adapter';
import { MockSerialAdapter } from './serial/mock-serial';
import { TauriSerialAdapter } from './serial/tauri-serial';
import { UnsupportedSerialAdapter } from './serial/unsupported-serial';

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * 浏览器没有原生串口（Web Serial 仅 Chrome+HTTPS），所以非 Tauri 默认走 Mock 让 demo 完整可用。
 * 用 ?nomock=1 可强制 Unsupported 触发"请用桌面端"的错误流。
 */
export const isMockSerial = (): boolean => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('nomock') === '1') return false;
  if (params.get('mock') === '1') return true;
  return !isTauri(); // 浏览器默认 mock，桌面端走真实串口
};

let cached: SerialAdapter | null = null;

export const getSerialAdapter = (): SerialAdapter => {
  if (cached) return cached;
  if (isTauri()) cached = new TauriSerialAdapter();
  else if (isMockSerial()) cached = new MockSerialAdapter();
  else cached = new UnsupportedSerialAdapter();
  return cached;
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
