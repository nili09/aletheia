import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const screenshotDir = fileURLToPath(new URL('../../../docs/screenshots/', import.meta.url));

test('Now screen', async ({ page }, testInfo) => {
  // Freeze the clock so screenshots are reproducible: 2 October 2026, 21:07:42 in Kolkata.
  await page.clock.install({ time: new Date('2026-10-02T21:07:42+05:30') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');

  await expect(page.getByRole('heading', { name: 'Aletheia' })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText('21:07:42');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('250 16px "Inter Tight Variable"'))).toBe(true);

  // The clock ticks on the second.
  await page.clock.runFor(1000);
  await expect(page.getByRole('timer')).toHaveText('21:07:43');

  // No horizontal scroll at phone width.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  await page.screenshot({ path: `${screenshotDir}now-${testInfo.project.name}.png` });
});

test('PWA manifest is linked and complete', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(new URL(href!, page.url()).toString())).json();
  expect(manifest).toMatchObject({
    name: 'Aletheia',
    theme_color: '#010101',
    background_color: '#010101',
    display: 'standalone',
    display_override: ['fullscreen', 'standalone'],
  });
  for (const icon of manifest.icons as { src: string }[]) {
    const res = await request.get(new URL(icon.src, page.url()).toString());
    expect(res.status(), icon.src).toBe(200);
  }
});
