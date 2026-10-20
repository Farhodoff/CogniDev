import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Pinned IPv4 loopback on both ends (vite + tauri devUrl).
// `localhost` resolves to ::1 or 127.0.0.1 depending on the client
// (curl vs WKWebView), which caused black-window failures.
// 127.0.0.1 removes all ambiguity.

function githubAuthDevPlugin() {
  return {
    name: 'cognidev-github-auth-endpoint',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url && (req.url === '/auth/github' || req.url.startsWith('/auth/github?'))) {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: any) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const parsed = body ? JSON.parse(body) : {};
                const csrfHeader = req.headers['x-csrf-token'];
                if (csrfHeader && !parsed.csrfToken) {
                  parsed.csrfToken = csrfHeader;
                }
                const { handleAuthGithubEndpoint } = await server.ssrLoadModule('/src/lib/githubAuth.ts');
                const result = await handleAuthGithubEndpoint(parsed);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = result.status === 'rate_limited' ? 429 : result.success ? 200 : 400;
                res.end(JSON.stringify(result));
              } catch (err: any) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, status: 'invalid', message: err.message || 'Server error' }));
              }
            });
            return;
          } else if (req.method === 'GET') {
            try {
              const { handleAuthGithubEndpoint } = await server.ssrLoadModule('/src/lib/githubAuth.ts');
              const result = await handleAuthGithubEndpoint({ action: 'status' });
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, status: 'invalid', message: err.message || 'Server error' }));
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
  plugins: [react(), githubAuthDevPlugin()],
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
