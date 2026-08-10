import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeBasePath(value: string): string {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = normalizeBasePath(env.VITE_APP_BASE_PATH || '/');

  return {
    base,
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true,
      cors: true,
      proxy: {
        [`${base}api`]: {
          target: 'http://localhost:3000',
          changeOrigin: true,
          timeout: 120000,
          rewrite: (requestPath) => requestPath.replace(new RegExp(`^${base.replace(/\/$/, '')}/api`), '/api'),
          configure: (proxy) => {
            proxy.on('error', (err, _req, _res) => {
              console.error('Proxy error:', err.message);
            });
          },
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
