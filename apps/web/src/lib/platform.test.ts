import { afterEach, describe, expect, it } from 'vitest';
import { __resetSerialAdapterCache, getSerialAdapter, isTauri } from './platform';

describe('platform', () => {
  afterEach(() => {
    __resetSerialAdapterCache();
    window.history.replaceState({}, '', '/');
    Reflect.deleteProperty(globalThis.navigator, 'serial');
  });

  it('falls back to UnsupportedSerialAdapter when navigator.serial is absent (jsdom)', () => {
    __resetSerialAdapterCache();
    const a = getSerialAdapter();
    expect(a.isSupported()).toBe(false);
    expect(a.constructor.name).toBe('UnsupportedSerialAdapter');
  });

  it('uses WebSerialAdapter when navigator.serial is present', () => {
    Object.defineProperty(globalThis.navigator, 'serial', {
      configurable: true,
      value: { getPorts: async () => [], requestPort: async () => undefined },
    });
    __resetSerialAdapterCache();
    const a = getSerialAdapter();
    expect(a.isSupported()).toBe(true);
    expect(a.constructor.name).toBe('WebSerialAdapter');
  });

  it('?mock=1 切到 MockSerialAdapter', () => {
    window.history.replaceState({}, '', '/?mock=1');
    __resetSerialAdapterCache();
    const a = getSerialAdapter();
    expect(a.constructor.name).toBe('MockSerialAdapter');
  });

  it('?nomock=1 切到 UnsupportedSerialAdapter', () => {
    window.history.replaceState({}, '', '/?nomock=1');
    __resetSerialAdapterCache();
    const a = getSerialAdapter();
    expect(a.isSupported()).toBe(false);
  });

  it('isTauri is false in jsdom', () => {
    expect(isTauri()).toBe(false);
  });
});
