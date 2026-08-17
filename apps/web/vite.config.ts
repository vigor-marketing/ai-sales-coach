import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeBasePath(value?: string): string {
  if (!value || value === '/') return '/';
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = normalizeBasePath(env.APP_BASE_PATH);
  const apiPath = `${base === '/' ? '' : base.slice(0, -1)}/api`;

  return {
    base,
    define: {
      'import.meta.env.APP_BASE_PATH': JSON.stringify(base === '/' ? '/' : base.slice(0, -1)),
    },
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true,
      cors: true,
      proxy: {
        [apiPath]: {
          target: 'http://localhost:3000',
          changeOrigin: true,
          timeout: 120000,
          configure: (proxy) => {
            proxy.on('error', (err) => {
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
