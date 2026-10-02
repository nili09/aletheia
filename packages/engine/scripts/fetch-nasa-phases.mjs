#!/usr/bin/env node
/**
 * Fetch new and full moon times for 2010–2011 from NASA's "Phases of the Moon" table
 * (Espenak) and save them as a test fixture.
 *
 *   node packages/engine/scripts/fetch-nasa-phases.mjs
 *
 * Writes packages/engine/test/fixtures/nasa-phases.json. Times are UT to the minute; a new
 * (full) moon is the instant the Moon's geocentric apparent ecliptic longitude equals
 * (is opposite) the Sun's. The years are in the past, so UT is measured, not predicted.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../test/fixtures/nasa-phases.json', import.meta.url));
const URL_ = 'https://eclipse.gsfc.nasa.gov/phase/phases2001.html';
const YEARS = [2010, 2011];
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

const text = (await (await fetch(URL_)).text()).replace(/<[^>]+>/g, '');
// Fixed-width rows: year (optional), then four "Mon dd  hh:mm" columns:
// new moon at column 8, first quarter 26, full moon 44, last quarter 62 (0-based).
const COLS = { new: 8, full: 44 };
const phases = [];
let year = null;
for (const raw of text.split('\n')) {
  const line = raw.replace(/\r$/, '');
  const y = /^ (\d{4}) /.exec(line);
  if (y) year = Number(y[1]);
  else if (!/^ {8}\w{3} /.test(line)) continue;
  if (!YEARS.includes(year)) continue;
  for (const [kind, col] of Object.entries(COLS)) {
    const m = /^(\w{3}) +(\d{1,2}) +(\d{2}):(\d{2})/.exec(line.slice(col));
    if (!m) continue;
    const [, mon, d, hh, mm] = m;
    const date = `${year}-${String(MONTHS[mon]).padStart(2, '0')}-${d.padStart(2, '0')}`;
    phases.push({ kind, ut: `${date}T${hh}:${mm}Z` });
  }
}
phases.sort((a, b) => a.ut.localeCompare(b.ut));
const count = (k) => phases.filter((p) => p.kind === k).length;
if (count('new') < 24 || count('full') < 24) throw new Error(`parsed ${count('new')} new and ${count('full')} full moons`);

const fixture = {
  description: 'New and full moon instants, UT to the minute, 2010–2011.',
  source: `F. Espenak, NASA GSFC, ${URL_}`,
  retrieved: new Date().toISOString(),
  generator: 'packages/engine/scripts/fetch-nasa-phases.mjs',
  phases,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(fixture, null, 1)}\n`);
console.log(`wrote ${phases.length} phases to ${OUT}`);
