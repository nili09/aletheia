import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const screenshotDir = fileURLToPath(new URL('../../../docs/screenshots/', import.meta.url));

/**
 * Five births from Mumbai and Kolkata, 1930–1960, each in a period when the clock is in
 * question (docs/CANON.md, India's clocks). `options` are the clocks offered, in order;
 * `compare` is what the second differs by (computed with the engine in format.test.ts).
 */
const BIRTHS = [
  { label: 'Mumbai 1934', query: 'Bombay', place: 'Mumbai', date: [12, 5, 1934], time: [10, 15], options: ['Indian Standard Time', 'Bombay Time'], compare: '39 minutes apart; lagna moves from Mithuna to Karka', pick: 'Bombay Time' },
  { label: 'Mumbai 1943', query: 'Mumbai', place: 'Mumbai', date: [20, 8, 1943], time: [6, 40], options: ['War time (IST + 1 h)', 'Indian Standard Time', 'Bombay Time'], compare: '1 hour apart; lagna moves from Karka to Siṃha', pick: 'War time (IST + 1 h)' },
  { label: 'Kolkata 1938', query: 'Calcutta', place: 'Kolkata', date: [3, 11, 1938], time: [21, 30], options: ['Calcutta Time', 'Indian Standard Time'], compare: '23 min 20 s apart; navāṃśa lagna from Meṣa to Vṛṣabha', pick: 'Calcutta Time' },
  { label: 'Kolkata 1942', query: 'Kolkata', place: 'Kolkata', date: [10, 3, 1942], time: [4, 50], options: ['Bengal war time', 'Indian Standard Time'], compare: '1 hour apart; lagna moves from Makara to Kumbha', pick: 'Bengal war time' },
  { label: 'Kolkata 1948', query: 'Kolkata', place: 'Kolkata', date: [14, 2, 1948], time: [13, 5], options: ['Indian Standard Time', 'Calcutta Time'], compare: '23 min 20 s apart; lagna moves from Mithuna to Vṛṣabha', pick: 'Indian Standard Time' },
] as const;

async function enterBirth(page: Page, b: (typeof BIRTHS)[number], shoot: string | null) {
  await page.getByRole('button', { name: 'New chart' }).click();
  await expect(page.getByRole('heading', { name: 'New chart' })).toBeVisible();
  await page.getByPlaceholder('Whose chart').fill(b.label);
  for (const [name, v] of [['Day', b.date[0]], ['Month', b.date[1]], ['Year', b.date[2]], ['Hour', b.time[0]], ['Minute', b.time[1]]] as const) {
    await page.getByRole('textbox', { name, exact: true }).fill(String(v));
  }
  await page.getByRole('searchbox').fill(b.query);
  const first = page.locator('.results .row-main').first();
  await expect(first).toContainText(b.place, { timeout: 60_000 });
  if (shoot) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${screenshotDir}birth-search-${shoot}.png` });
  }
  await first.click();

  const question = page.locator('section[aria-labelledby="h-clock"]');
  await expect(question.getByRole('heading', { name: 'Which clock was the time read on?' })).toBeVisible();
  await expect(question.getByRole('radio')).toHaveCount(b.options.length);
  for (const [i, name] of b.options.entries()) await expect(question.getByRole('radio').nth(i)).toContainText(name);
  await expect(question.getByRole('radio').nth(1)).toContainText(b.compare, { timeout: 30_000 });
  // Nothing is chosen for the person: saving waits for the clock.
  await expect(page.getByRole('button', { name: 'Save chart' })).toBeDisabled();
  await question.getByRole('radio', { name: new RegExp(`^${b.pick.replace(/[()+]/g, '\\$&')}`) }).click();
  await page.getByRole('radio', { name: 'Family memory' }).click();
  return question;
}

test('birth entry: place, the clock question, saved charts with their sensitivity', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const phone = testInfo.project.name;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: 'Charts' }).click();
  await expect(page.getByRole('heading', { name: 'Charts' })).toBeVisible();
  await expect(page.getByText('No charts yet.')).toBeVisible();

  for (const [i, b] of BIRTHS.entries()) {
    const question = await enterBirth(page, b, i === 0 ? phone : null);
    await question.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    if (i === 0) await page.screenshot({ path: `${screenshotDir}birth-clock-${phone}.png` });
    await question.screenshot({ path: `${screenshotDir}clock-${b.label.toLowerCase().replace(' ', '-')}-${phone}.png` });
    if (i === 0) {
      // Tapping ⓘ shows the clock's offset, instant and sources.
      await question.getByRole('button', { name: 'Sources for Bombay Time' }).click();
      await expect(question.locator('.trace')).toContainText('UTC+04:51 (17460 s)');
      await expect(question.locator('.trace')).toContainText('1934-05-12 05:24:00 UTC');
      await expect(question.locator('.trace')).toContainText('Indian Year Book');
    }
    await page.getByRole('button', { name: 'Save chart' }).click();
    await expect(page.getByRole('heading', { name: 'Charts' })).toBeVisible();
  }

  // Every chart shows how far its time can move, computed by the engine.
  const rows = page.locator('section[aria-labelledby="h-saved"] .row');
  await expect(rows).toHaveCount(5);
  for (let i = 0; i < 5; i++) await expect(rows.nth(i).locator('.sensitivity')).toContainText(/^Lagna holds −.* · Navāṃśa lagna .* · D60 .* · Moon’s nakṣatra /, { timeout: 60_000 });
  const mumbai = rows.filter({ hasText: 'Mumbai 1934' });
  await expect(mumbai).toContainText('Bombay Time · Family memory');
  await expect(mumbai.locator('.sensitivity')).toHaveText('Lagna holds −24 min / +1 h 48 min · Navāṃśa lagna −9 / +5 min · D60 −9 s / +2 min · Moon’s nakṣatra −22 h 55 min / +1 h 34 min');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  await page.screenshot({ path: `${screenshotDir}charts-${phone}.png`, fullPage: true });

  // Tapping a chart shows its inputs, conventions and sources.
  await mumbai.locator('.row-main').click();
  await expect(mumbai.locator(':scope > .trace')).toContainText('Bombay Time, UTC+04:51');
  await expect(mumbai.locator(':scope > .trace')).toContainText('1934-05-12 05:24:00 UTC');
  await expect(mumbai.locator(':scope > .trace')).toContainText('GeoNames 1275339');
  await mumbai.locator(':scope > .trace').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${screenshotDir}charts-trace-${phone}.png` });

  // Export all charts as one file, then import it into a fresh device.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()]);
  const path = await download.path();
  const exported = JSON.parse(readFileSync(path, 'utf8')) as { format: string; charts: unknown[] };
  expect(exported.format).toBe('aletheia-charts');
  expect(exported.charts).toHaveLength(5);

  const fresh = await page.context().browser()!.newContext();
  const other = await fresh.newPage();
  await other.goto(new URL('./#charts', page.url()).toString());
  await expect(other.getByText('No charts yet.')).toBeVisible();
  await other.locator('input[type="file"]').setInputFiles(path);
  await expect(other.getByText('Imported 5 charts.')).toBeVisible();
  await expect(other.locator('section[aria-labelledby="h-saved"] .row')).toHaveCount(5);
  await fresh.close();
});

test('coordinates resolve to a zone and the nearest indexed place; OpenStreetMap waits for consent', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto('./#new');
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));

  // Online search asks first, and "No" sends nothing.
  await page.getByRole('searchbox').fill('Ujjain');
  await expect(page.locator('.results .row-main').first()).toContainText('Ujjain', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Search OpenStreetMap (online)' }).click();
  await expect(page.getByRole('dialog')).toContainText('nominatim.openstreetmap.org');
  await page.screenshot({ path: `${screenshotDir}birth-consent-${testInfo.project.name}.png` });
  await page.getByRole('button', { name: 'No' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests.filter((u) => u.includes('openstreetmap'))).toEqual([]);

  // Churchgate, Mumbai, by hand.
  await page.getByRole('button', { name: 'Enter coordinates' }).click();
  await page.getByPlaceholder('19.07283').fill('18.9388');
  await page.getByPlaceholder('72.88261').fill('72.8354');
  await page.getByRole('button', { name: 'Use these coordinates' }).click();
  const place = page.locator('section[aria-labelledby="h-place"] .row-main');
  await expect(place).toContainText('18.9388° N 72.8354° E');
  await expect(place).toContainText(/near .*Mumbai/);
  await place.click();
  await expect(page.locator('section[aria-labelledby="h-place"] .trace')).toContainText('Asia/Kolkata (from the coordinates');
});
