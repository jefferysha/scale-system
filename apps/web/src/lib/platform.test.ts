import { afterEach, describe, expect, it } from 'vitest';
import { __resetSerialAdapterCache, getSerialAdapter, isTauri } from './platform';

describe('platform', () => {
  afterEach(() => {
    __resetSerialAdapterCache();
    window.history.replaceState({}, '', '/');
  });

  it('returns WebSocket adapter by default (业界最佳：后端持有串口，前端订阅)', () => {
    __resetSerialAdapterCache();
    const a = getSerialAdapter();
    expect(a.isSupported()).toBe(true); // WebSocket 总是 supported
    expect(a.constructor.name).toBe('WebSocketSerialAdapter');
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
