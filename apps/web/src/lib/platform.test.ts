import { describe, expect, it } from 'vitest';
import { __resetSerialAdapterCache, getSerialAdapter, isTauri } from './platform';

describe('platform', () => {
  it('returns unsupported adapter when neither tauri nor web serial', () => {
    __resetSerialAdapterCache();
    const a = getSerialAdapter();
    expect(a.isSupported()).toBe(false);
  });

  it('isTauri is false in jsdom', () => {
    expect(isTauri()).toBe(false);
  });
});
