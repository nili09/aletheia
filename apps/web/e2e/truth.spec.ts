import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { Engine, EPHE_FILES } from '@aletheia/engine';
import { GRAHA_NAMES, GRAHA_ORDER, inSign } from '../src/truth/format.ts';

const screenshotDir = fileURLToPath(new URL('../../../docs/screenshots/', import.meta.url));
const FROZEN = new Date('2026-10-02T21:07:42+05:30');

/** The same instant computed by the engine in Node: the phone must show the same arcseconds. */
async function expectedLongitudes(): Promise<Map<string, string>> {
  const engine = await Engine.create();
  for (const f of EPHE_FILES) {
    engine.addFile(f, new Uint8Array(readFileSync(new URL(`../../../packages/engine/ephe/${f}`, import.meta.url))));
  }
  const ps = engine.positions({ unixMs: FROZEN.getTime() });
  return new Map(
    GRAHA_ORDER.map((g) => {
      const s = inSign(ps.find((p) => p.graha === g)!.sidereal.longitude);
      return [GRAHA_NAMES[g].sa, `${s.sign} ${s.dms}`];
    }),
  );
}

test('Truth opens on a long press of the ring, live and traceable', async ({ page }, testInfo) => {
  const expected = await expectedLongitudes();
  // A paused fake clock makes every value reproducible (the Moon moves half an arcsecond a
  // second). The presses happen a few seconds before the frozen instant; then the clock
  // jumps to it and only creeps forward in 50 ms steps (well inside the same second) while
  // React reveals the lazily loaded screen.
  await page.clock.install({ time: FROZEN.getTime() - 10_000 });
  await page.clock.pauseAt(FROZEN.getTime() - 4_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');

  const dial = page.getByRole('button', { name: /Truth/ });
  const box = (await dial.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  // A short press does nothing.
  await page.mouse.down();
  await page.clock.runFor(300);
  await page.mouse.up();
  await page.clock.runFor(1000);
  await expect(page.getByRole('heading', { name: 'Truth' })).toHaveCount(0);

  // Holding for the long-press time opens Truth.
  await page.mouse.down();
  await page.clock.runFor(700);
  await page.mouse.up();
  await page.clock.pauseAt(FROZEN);
  const heading = page.getByRole('heading', { name: 'Truth', level: 1 });
  let crept = 0;
  await expect(async () => {
    if (!(await heading.isVisible())) {
      expect(crept, 'stays within the frozen second').toBeLessThan(900);
      await page.clock.runFor(50);
      crept += 50;
    }
    await expect(heading).toBeVisible({ timeout: 50 });
  }).toPass({ timeout: 15_000 });
  await expect(page.locator('.truth-instant time')).toHaveText('21:07:42');
  await expect(page).toHaveURL(/#truth$/);

  // Every graha, to the arcsecond, as computed by the engine in Node at the same instant.
  for (const [name, value] of expected) {
    await expect(page.locator('.row-main', { hasText: name }).first().locator('.value'), name).toHaveText(value, { timeout: 30_000 });
  }
  await expect(page.locator('.row-main', { hasText: 'Ayanāṃśa' })).toContainText('24°');
  await expect(page.locator('.row-main', { hasText: 'Lagna' })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="h-events"] .row-main')).toHaveCount(5, { timeout: 30_000 });
  await expect(page.getByText('420 positions, 1900–2100: all within 1″')).toBeVisible({ timeout: 30_000 });

  // No horizontal scroll at phone width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);

  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${screenshotDir}truth-${testInfo.project.name}.png`, fullPage: true });

  // Tapping a value shows its inputs, convention and source.
  await page.locator('.row-main', { hasText: 'Śani' }).first().click();
  const trace = page.locator('.row.selected .trace');
  await expect(trace).toContainText('JD TT');
  await expect(trace).toContainText('Swiss Ephemeris 2.10.03');
  await expect(trace).toContainText('IAU 2006');
  await trace.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${screenshotDir}truth-trace-${testInfo.project.name}.png` });

  // Back returns to Now.
  await page.getByRole('button', { name: 'Now' }).click();
  await expect(page.getByRole('heading', { name: 'Aletheia' })).toBeVisible();
  await expect(page).not.toHaveURL(/#truth/);
});
