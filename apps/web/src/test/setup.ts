import '@testing-library/jest-dom';

// Node 25+ ships an experimental built-in `localStorage` that ends up as a
// non-functional empty object in jsdom worker contexts. Replace it with a
// minimal in-memory Storage shim so persistence-aware libraries (e.g. zustand
// persist) can run in tests.
const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
};

const ensureStorage = (name: 'localStorage' | 'sessionStorage'): void => {
  const current = (globalThis as Record<string, unknown>)[name] as Storage | undefined;
  if (!current || typeof current.setItem !== 'function') {
    Object.defineProperty(globalThis, name, {
      value: createMemoryStorage(),
      configurable: true,
    });
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, name, {
        value: (globalThis as Record<string, unknown>)[name],
        configurable: true,
      });
    }
  }
};

ensureStorage('localStorage');
ensureStorage('sessionStorage');
