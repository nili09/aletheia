// Generates the PWA icons: a thin sandstone ring on near-black.
// Rasterised with Playwright's Chromium so we need no image-processing dependency.
// Run with `npm run icons`; the PNGs are committed.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const GROUND = '#010101';
const SANDSTONE = '#bdad96';
const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

/**
 * @param size   pixel size of the square icon
 * @param radius ring radius as a fraction of size
 *               (maskable icons keep the ring inside the 80% safe zone)
 */
function ringSvg(size, radius, strokeFraction = 0.011) {
  const c = size / 2;
  const r = size * radius;
  const w = Math.max(1.5, size * strokeFraction);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${GROUND}"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${SANDSTONE}" stroke-width="${w}"/>
</svg>`;
}

const icons = [
  { file: 'icon-192.png', size: 192, radius: 0.33 },
  { file: 'icon-512.png', size: 512, radius: 0.33 },
  { file: 'icon-maskable-512.png', size: 512, radius: 0.27 },
  { file: 'apple-touch-icon.png', size: 180, radius: 0.31 },
];

const browser = await chromium.launch();
try {
  for (const { file, size, radius } of icons) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(
      `<html><body style="margin:0;background:${GROUND}">${ringSvg(size, radius)}</body></html>`,
    );
    await page.screenshot({ path: out(file), omitBackground: false });
    await page.close();
    console.log(`wrote public/${file}`);
  }
} finally {
  await browser.close();
}

// Vector favicon, rounded square so it reads on light and dark browser chrome.
await writeFile(
  out('favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="${GROUND}"/>
  <circle cx="32" cy="32" r="20" fill="none" stroke="${SANDSTONE}" stroke-width="2"/>
</svg>
`,
);
console.log('wrote public/favicon.svg');
