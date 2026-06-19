import '@testing-library/jest-dom';

// jsdom doesn't implement ResizeObserver, which some components observe for layout.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Vitest workers with jsdom may not expose localStorage on globalThis in time
// for Zustand persist stores that initialize at module-load. Provide a shim.
if (typeof localStorage === 'undefined') {
  const _store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => _store.get(k) ?? null,
      setItem: (k: string, v: string) => { _store.set(k, v); },
      removeItem: (k: string) => { _store.delete(k); },
      clear: () => { _store.clear(); },
      get length() { return _store.size; },
      key: (i: number) => [..._store.keys()][i] ?? null,
    },
    writable: true,
    configurable: true,
  });
}
