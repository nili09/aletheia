import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}${base}`,
    colorScheme: 'dark',
    timezoneId: 'Asia/Kolkata', // reproducible screenshots on any machine
    locale: 'en-IN',
    serviceWorkers: 'block', // screenshots must show the live build, never a cached shell
  },
  projects: [
    { name: 'iphone-13', use: { ...devices['iPhone 13'] } }, // WebKit
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } }, // Chromium
  ],
  webServer: {
    // Test the production build, served from the site root as Cloudflare will serve it.
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
