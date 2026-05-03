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
  else cached = new UnsupportedSerialAdapter(); // Phase 后续接 BrowserSerialAdapter
  return cached;
};

export const __resetSerialAdapterCache = (): void => {
  cached = null;
};

let cachedQueue: SubmissionQueue | null = null;

/**
 * 返回当前环境的 SubmissionQueue。
 *
 * - Tauri 环境：rusqlite 落盘
 * - 浏览器环境：Phase 5 会接 IndexedDBQueue。本 phase 暂用 throwing stub，
 *   合 main 时如 Phase 5 已就位则 resolve 为它的 IndexedDBQueue。
 */
export const getSubmissionQueue = (): SubmissionQueue => {
  if (cachedQueue) return cachedQueue;
  cachedQueue = isTauri() ? new TauriQueue() : new BrowserQueueStub();
  return cachedQueue;
};

export const __resetSubmissionQueueCache = (): void => {
  cachedQueue = null;
};

class BrowserQueueStub implements SubmissionQueue {
  private fail(): never {
    throw new Error('IndexedDBQueue not implemented in this build (Phase 5)');
  }
  async enqueue(): Promise<void> {
    this.fail();
  }
  async drain(): Promise<never[]> {
    this.fail();
  }
  async markSynced(): Promise<void> {
    this.fail();
  }
  async markFailed(): Promise<void> {
    this.fail();
  }
  async count(): Promise<{ pending: number; needs_review: number }> {
    this.fail();
  }
}
