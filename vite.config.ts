import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dev proxy: the client uses a same-origin relative base (`/vicdash-api`),
    // so browser fetches never cross origins (Grafana sends no CORS headers and
    // the browser would block them). The dev server forwards to the upstream
    // Grafana URL (VITE_GRAFANA_URL) server-to-server instead.
    proxy: {
      '/vicdash-api': {
        target: process.env.VITE_GRAFANA_URL || 'http://host.docker.internal:30001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/vicdash-api/, ''),
        configure: (proxy) => {
          // This hop is server-to-server: Grafana's origin protection rejects
          // browser `Origin`/`Referer` headers it doesn't know, so drop them.
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
        },
      },
    },
  },
})
