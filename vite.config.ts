import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Pinned IPv4 loopback on both ends (vite + tauri devUrl).
// `localhost` resolves to ::1 or 127.0.0.1 depending on the client
// (curl vs WKWebView), which caused black-window failures.
// 127.0.0.1 removes all ambiguity.

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '127.0.0.1',
    hmr: { protocol: 'ws', host: '127.0.0.1' },
    watch: { ignored: ['**/src-tauri/**'] },
  },
}))
