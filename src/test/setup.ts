import { vi, beforeEach } from 'vitest';

// ── localStorage & sessionStorage polyfill guarantee ──
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: storageMock,
  writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: storageMock,
  writable: true,
});

// ── Clipboard mock ──
if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: vi.fn(async () => {}),
      readText: vi.fn(async () => ''),
    },
    writable: true,
  });
} else {
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async () => {});
}

// ── window.open mock ──
window.open = vi.fn();

// ── HTMLAnchorElement.prototype.click mock for downloads in jsdom ──
HTMLAnchorElement.prototype.click = vi.fn();

// ── URL.createObjectURL and revokeObjectURL mock ──
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn();
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

// ── Tauri Native API Mocks ──
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => {
    throw new Error('Tauri invoke mocked');
  }),
}));

vi.mock('@tauri-apps/plugin-sql', () => {
  const mocked = {
    load: vi.fn(async () => {
      throw new Error('SQLite mocked');
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
