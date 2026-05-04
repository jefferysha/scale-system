import { afterEach, describe, expect, it } from 'vitest';
import { __resetSerialAdapterCache, getSerialAdapter, isTauri } from './platform';

describe('platform', () => {
  afterEach(() => {
    __resetSerialAdapterCache();
    window.history.replaceState({}, '', '/');
  });

  it('returns mock adapter by default in browser (无 Tauri，让 demo 可跑通)', () => {
    __resetSerialAdapterCache();
    const a = getSerialAdapter();
    expect(a.isSupported()).toBe(true);
  });

  it('returns unsupported adapter when ?nomock=1 (强制走桌面端)', () => {
    window.history.replaceState({}, '', '/?nomock=1');
    __resetSerialAdapterCache();
    const a = getSerialAdapter();
    expect(a.isSupported()).toBe(false);
  });

  it('isTauri is false in jsdom', () => {
    expect(isTauri()).toBe(false);
  });
});
