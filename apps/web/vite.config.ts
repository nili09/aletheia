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
        // Offline app shell: precache the built shell, scripts, styles and self-hosted fonts.
        globPatterns: ['**/*.{html,js,css,woff2,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: 'es2022',
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
