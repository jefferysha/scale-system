import type { SerialAdapter } from './serial/adapter';
import { MockSerialAdapter } from './serial/mock-serial';
import { UnsupportedSerialAdapter } from './serial/unsupported-serial';
import type { SubmissionQueue } from './queue/submission-queue';
import { IndexedDbQueue } from './queue/indexeddb-queue';

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
  else if (isTauri())
    cached = new UnsupportedSerialAdapter(); // Phase 6 替换为 TauriSerialAdapter
  else cached = new UnsupportedSerialAdapter(); // Phase 5 后会接 BrowserSerialAdapter
  return cached;
};

export const __resetSerialAdapterCache = (): void => {
  cached = null;
};

let queueCached: SubmissionQueue | null = null;

export const getSubmissionQueue = (): SubmissionQueue => {
  if (queueCached) return queueCached;
  // Phase 5：Web 端用 IndexedDB；Phase 6 桌面端在 platform 切到 Tauri SQLite 实现。
  queueCached = new IndexedDbQueue();
  return queueCached;
};

export const __resetSubmissionQueueCache = (): void => {
  queueCached = null;
};
