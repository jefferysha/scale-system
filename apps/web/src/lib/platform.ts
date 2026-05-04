import { IndexedDbQueue } from './queue/indexeddb-queue';
import type { SubmissionQueue } from './queue/submission-queue';
import { TauriQueue } from './queue/tauri-queue';
import type { SerialAdapter } from './serial/adapter';
import { MockSerialAdapter } from './serial/mock-serial';
import { UnsupportedSerialAdapter } from './serial/unsupported-serial';
import { WebSerialAdapter } from './serial/web-serial';

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Web Serial 直连：浏览器（含 Tauri webview）直接读 USB 天平，无需后端串口模块。
 *
 * 选择优先级：
 * 1. ?mock=1     → MockSerialAdapter（单测/演示）
 * 2. ?nomock=1   → UnsupportedSerialAdapter（强制不接，错误流测试）
 * 3. 默认（支持 Web Serial）→ WebSerialAdapter
 * 4. 默认（不支持，如 Safari/Firefox/SSR）→ UnsupportedSerialAdapter
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
  if (typeof navigator !== 'undefined' && 'serial' in navigator) {
    cached = new WebSerialAdapter();
  } else {
    cached = new UnsupportedSerialAdapter();
  }
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
