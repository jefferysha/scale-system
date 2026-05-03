import type { SerialAdapter } from './serial/adapter';
import { MockSerialAdapter } from './serial/mock-serial';
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
  else if (isTauri()) cached = new UnsupportedSerialAdapter(); // Phase 6 替换为 TauriSerialAdapter
  else cached = new UnsupportedSerialAdapter(); // Phase 5 后会接 BrowserSerialAdapter
  return cached;
};

export const __resetSerialAdapterCache = (): void => {
  cached = null;
};
