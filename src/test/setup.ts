import { vi, beforeEach } from 'vitest';

// ── localStorage polyfill (jsdom allaqachon beradi, lekin tozalash kafolatlanadi) ──
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

// ── Tauri native API mocklari: Node/CI muhitida hech qachon chaqirilmasligi kerak ──
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => {
    throw new Error('Tauri invoke mocked — native layer not available in tests');
  }),
}));

vi.mock('@tauri-apps/plugin-sql', () => {
  const mocked = {
    load: vi.fn(async () => {
      throw new Error('SQLite Database.load mocked — use db mock overrides in tests');
    }),
  };
  return { default: mocked, ...mocked };
});

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(async () => {
    throw new Error('fs mocked');
  }),
  writeTextFile: vi.fn(async () => {
    throw new Error('fs mocked');
  }),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(async () => null),
  save: vi.fn(async () => null),
}));
