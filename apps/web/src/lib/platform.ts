import type { SerialAdapter } from './serial/adapter';
import { UnsupportedSerialAdapter } from './serial/unsupported-serial';

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let cached: SerialAdapter | null = null;

export const getSerialAdapter = (): SerialAdapter => {
  if (cached) return cached;
  // Phase 6 替换：Tauri 时返回 TauriSerialAdapter；
  // Phase 4/5 替换：浏览器有 navigator.serial 时返回 BrowserSerialAdapter
  cached = new UnsupportedSerialAdapter();
  return cached;
};

export const __resetSerialAdapterCache = (): void => {
  cached = null;
};
