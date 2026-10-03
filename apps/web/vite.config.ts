/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Cloudflare serves the app from the site root (https://aletheia.nileshfx-bin.workers.dev/).
// Set BASE_PATH=/sub/path/ only if it is ever hosted under a sub-path.
const base = process.env.BASE_PATH ?? '/';

const ground = '#010101';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Aletheia',
        short_name: 'Aletheia',
        description: 'A personal jyotish instrument: the true sky, and the classical texts.',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        theme_color: ground,
        background_color: ground,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Offline app shell: precache the built shell, scripts (including the engine worker),
        // styles, self-hosted fonts and the Swiss Ephemeris WebAssembly.
        globPatterns: ['**/*.{html,js,css,woff2,svg,png,webmanifest,wasm}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Ephemeris data (1.9 MB), the JPL reference fixture, the zone table (0.6 MB) and the
        // place index (15 MB of text, about 7 MB compressed) are not precached: the workers
        // fetch them the first time they are needed, and this caches each one then. Their
        // names carry a content hash, so a cached copy is never stale.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/assets\/[^/]+\.(?:se1|txt|json)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'aletheia-ephemeris',
              expiration: { maxEntries: 24, purgeOnQuotaError: false },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
  },
  worker: {
    format: 'es',
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
