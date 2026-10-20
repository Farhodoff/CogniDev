import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Pinned IPv4 loopback on both ends (vite + tauri devUrl).
// `localhost` resolves to ::1 or 127.0.0.1 depending on the client
// (curl vs WKWebView), which caused black-window failures.
// 127.0.0.1 removes all ambiguity.

function workspaceAuditDevPlugin() {
  return {
    name: 'cognidev-workspace-audit-endpoint',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || '';
        if (
          url === '/api/audit' ||
          url.startsWith('/api/audit?') ||
          url === '/audit' ||
          url.startsWith('/audit?')
        ) {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: any) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const parsed = body ? JSON.parse(body) : { action: 'query' };
                const { handleAuditApiEndpoint } = await server.ssrLoadModule('/src/lib/audit.ts');
                const result = await handleAuditApiEndpoint(parsed);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = result.success ? 200 : 400;
                res.end(JSON.stringify(result));
              } catch (err: any) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, message: err.message || 'Server error' }));
              }
            });
            return;
          } else if (req.method === 'GET') {
            try {
              const urlObj = new URL(url, 'http://127.0.0.1:1420');
              const searchParams = urlObj.searchParams;
              const format = searchParams.get('format') as any;
              const target_type = searchParams.get('target_type') as any;
              const action = searchParams.get('action') as any;
              const search = searchParams.get('search') || undefined;

              const isStats = urlObj.pathname.endsWith('/stats');
              const { handleAuditApiEndpoint } = await server.ssrLoadModule('/src/lib/audit.ts');
              const result = await handleAuditApiEndpoint(
                isStats
                  ? { action: 'stats' }
                  : {
                      action: 'query',
                      options: {
                        format,
                        target_type,
                        action,
                        search,
                      },
                    }
              );

              if (format === 'jsonl' && result.result?.formattedOutput) {
                res.setHeader('Content-Type', 'application/x-ndjson');
                res.end(result.result.formattedOutput);
              } else {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result));
              }
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, message: err.message || 'Server error' }));
            }
            return;
          } else if (req.method === 'DELETE') {
            try {
              const { handleAuditApiEndpoint } = await server.ssrLoadModule('/src/lib/audit.ts');
              const result = await handleAuditApiEndpoint({ action: 'clear' });
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, message: err.message || 'Server error' }));
            }
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), workspaceAuditDevPlugin()],
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
