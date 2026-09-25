import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

// Dev proxy that forwards same-origin API paths to upstream services.
// Targets come from .env (loaded explicitly; `process.env` is NOT populated
// with .env contents by Vite). The `rewrite` strips the same-origin prefix so
// upstreams see their normal paths (/api/...). Request `Origin`/`Referer`
// headers are dropped because these hops are server-to-server and upstreams
// (Grafana, HA) reject unknown browser origins.
function apiProxy(target: string, prefix: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    rewrite: (p) => p.replace(new RegExp(`^${prefix}`), ''),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin');
        proxyReq.removeHeader('referer');
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    server: {
      // The client uses same-origin relative bases (`/vicdash-api`, `/vicdash-ha`),
      // so browser fetches never cross origins (upstreams send no CORS headers and
      // the browser would block them). The dev server forwards to the upstream URLs
      // (VITE_GRAFANA_URL / VITE_HA_URL) server-to-server instead.
      proxy: {
        '/vicdash-api': apiProxy(env.VITE_GRAFANA_URL || 'http://host.docker.internal:30001', '/vicdash-api'),
        '/vicdash-ha': apiProxy(env.VITE_HA_URL || 'http://host.docker.internal:8123', '/vicdash-ha'),
      },
    },
  };
});