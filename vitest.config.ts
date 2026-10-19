import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    // Tauri pluginlari import qilinadigan modullarni izolyatsiya qilish
    server: { deps: { inline: [/zustand/] } },
    coverage: {
      provider: 'v8',
      include: ['src/lib/store.ts', 'src/lib/github.ts', 'src/lib/db.ts', 'src/lib/seed.ts'],
    },
    testTimeout: 15_000,
  },
});
