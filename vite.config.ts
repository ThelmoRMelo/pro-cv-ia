import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate', injectRegister: null, filename: 'sw.js',
    devOptions: { enabled: false },
    manifest: {
      name: 'CV Profissional Admin', short_name: 'CV Admin', start_url: '/admin', scope: '/', display: 'standalone',
      background_color: '#f5f4ef', theme_color: '#173d35', description: 'Painel de gestão da Próxima Página',
      icons: [
        { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
        { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
      ]
    },
    workbox: {
      navigateFallbackDenylist: [/^\/~oauth/],
      runtimeCaching: [
        { urlPattern: ({ request }) => request.mode === 'navigate', handler: 'NetworkFirst', options: { cacheName: 'page-navigation', networkTimeoutSeconds: 3 } },
        { urlPattern: ({ request }) => ['style', 'script', 'worker', 'font'].includes(request.destination), handler: 'CacheFirst', options: { cacheName: 'app-assets', expiration: { maxEntries: 80, maxAgeSeconds: 2592000 } } }
      ]
    }
  })]
});
