import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Pinned IPv4 loopback on both ends (vite + tauri devUrl).
// `localhost` resolves to ::1 or 127.0.0.1 depending on the client
// (curl vs WKWebView), which caused black-window failures.
// 127.0.0.1 removes all ambiguity.

function realtimeMetricsDevPlugin() {
  return {
    name: 'cognidev-realtime-metrics-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || '';

        // CORS Preflight
        if (req.method === 'OPTIONS' && url.startsWith('/api/v1/metrics')) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.statusCode = 204;
          res.end();
          return;
        }

        // SSE Stream: GET /api/v1/metrics/stream or GET /api/v1/metrics/:id/stream
        if (
          req.method === 'GET' &&
          (url === '/api/v1/metrics/stream' ||
            url.startsWith('/api/v1/metrics/stream?') ||
            url.includes('/metrics/') && url.endsWith('/stream'))
        ) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 200;

          const { registerSseClient } = await server.ssrLoadModule('/src/lib/realtimeMetrics.ts');
          const cleanup = registerSseClient(res);

          const pingInterval = setInterval(() => {
            if (!res.writableEnded) {
              res.write(': ping\n\n');
            } else {
              clearInterval(pingInterval);
            }
          }, 15000);

          req.on('close', () => {
            clearInterval(pingInterval);
            cleanup();
          });
          return;
        }

        // PUT /api/v1/metrics/:id
        const putMatch = url.match(/^\/api\/v1\/metrics\/([^/?]+)/);
        if (req.method === 'PUT' && putMatch) {
          const metricId = decodeURIComponent(putMatch[1]);
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const payload = body ? JSON.parse(body) : {};
              const { handleMetricsPushEndpoint } = await server.ssrLoadModule('/src/lib/realtimeMetrics.ts');
              const result = await handleMetricsPushEndpoint(metricId, payload);

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: err.message || 'Invalid payload' }));
            }
          });
          return;
        }

        // GET /api/v1/metrics or GET /api/v1/metrics/:id
        if (req.method === 'GET' && (url === '/api/v1/metrics' || url.startsWith('/api/v1/metrics?'))) {
          const { getRealtimeMetricsSnapshot, getActiveSessionCount } = await server.ssrLoadModule('/src/lib/realtimeMetrics.ts');
          const snapshot = getRealtimeMetricsSnapshot();
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              active_sessions: getActiveSessionCount(),
              metrics: snapshot,
            })
          );
          return;
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), realtimeMetricsDevPlugin()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '127.0.0.1',
    hmr: { protocol: 'ws', host: '127.0.0.1' },
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('@tauri-apps')) {
              return 'vendor-tauri';
            }
            if (id.includes('zustand')) {
              return 'vendor-state';
            }
          }
        },
      },
    },
  },
}))
