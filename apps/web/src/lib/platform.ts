import { IndexedDbQueue } from './queue/indexeddb-queue';
import type { SubmissionQueue } from './queue/submission-queue';
import { TauriQueue } from './queue/tauri-queue';
import type { SerialAdapter } from './serial/adapter';
import { MockSerialAdapter } from './serial/mock-serial';
import { TauriSerialAdapter } from './serial/tauri-serial';
import { UnsupportedSerialAdapter } from './serial/unsupported-serial';

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const isMockSerial = (): boolean =>
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('mock') === '1';

let cached: SerialAdapter | null = null;

export const getSerialAdapter = (): SerialAdapter => {
  if (cached) return cached;
  if (isMockSerial()) cached = new MockSerialAdapter();
  else if (isTauri()) cached = new TauriSerialAdapter();
  else cached = new UnsupportedSerialAdapter(); // 浏览器后续可接 BrowserSerialAdapter
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
