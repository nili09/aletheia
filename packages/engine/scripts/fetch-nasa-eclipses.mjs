#!/usr/bin/env node
/**
 * Fetch reference eclipses from NASA's Five Millennium Canon catalogues (Espenak & Meeus)
 * and save 20 of them, 1950–2050, as a test fixture.
 *
 *   node packages/engine/scripts/fetch-nasa-eclipses.mjs
 *
 * Writes packages/engine/test/fixtures/nasa-eclipses.json. The catalogue gives the time of
 * greatest eclipse in Terrestrial Dynamical Time (TD, equal to TT for our purpose).
 *
 * Selection: 10 solar and 10 lunar eclipses drawn with a fixed seed, stratified by type so
 * every type appears (solar: total, annular, hybrid, partial; lunar: total, partial,
 * penumbral). See docs/TESTING.md, "Eclipses against NASA".
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../test/fixtures/nasa-eclipses.json', import.meta.url));
const BASE = 'https://eclipse.gsfc.nasa.gov';
const PAGES = {
  solar: ['/SEcat5/SE1901-2000.html', '/SEcat5/SE2001-2100.html'],
  lunar: ['/LEcat5/LE1901-2000.html', '/LEcat5/LE2001-2100.html'],
};
const SEED = 20261002;
const FIRST_YEAR = 1950;
const LAST_YEAR = 2050;

/** How many of each catalogue type letter to draw. */
const QUOTA = {
  solar: { T: 3, A: 3, H: 1, P: 3 },
  lunar: { T: 4, P: 3, N: 3 },
};

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

// "09399  1950 Sep 12  03:38:47     29   -610  124   T   -t   0.8903 ..."
const ROW = /^(\d{5})\s+(-?\d{1,4}) (\w{3}) (\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(-?\d+\.\d+)/;

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function rows(kind) {
  const out = [];
  for (const path of PAGES[kind]) {
    const res = await fetch(BASE + path);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    const text = (await res.text()).replace(/<[^>]+>/g, '');
    for (const line of text.split('\n')) {
      const m = ROW.exec(line.trim());
      if (!m) continue;
      const [, cat, y, mon, d, hh, mm, ss, deltaT, luna, saros, type, q, gamma] = m;
      const year = Number(y);
      if (year < FIRST_YEAR || year > LAST_YEAR) continue;
      out.push({
        catalogNumber: cat,
        date: `${y}-${String(MONTHS[mon]).padStart(2, '0')}-${d}`,
        greatestTD: `${hh}:${mm}:${ss}`,
        deltaTSeconds: Number(deltaT),
        lunation: Number(luna),
        saros: Number(saros),
        type,
        qualifier: q,
        gamma: Number(gamma),
        source: BASE + path,
      });
    }
  }
  return out;
}

const rand = mulberry32(SEED);
const picked = { solar: [], lunar: [] };
for (const kind of ['solar', 'lunar']) {
  const all = await rows(kind);
  console.log(`${kind}: ${all.length} eclipses ${FIRST_YEAR}–${LAST_YEAR}`);
  for (const [letter, n] of Object.entries(QUOTA[kind])) {
    const pool = all.filter((e) => e.type[0] === letter);
    for (let i = 0; i < n; i++) {
      const [e] = pool.splice(Math.floor(rand() * pool.length), 1);
      if (!e) throw new Error(`not enough ${kind} eclipses of type ${letter}`);
      picked[kind].push(e);
    }
  }
  picked[kind].sort((a, b) => a.date.localeCompare(b.date));
}

const fixture = {
  description:
    'Times of greatest eclipse in Terrestrial Dynamical Time (TD) from NASA Five Millennium Canon catalogues.',
  source: 'F. Espenak and J. Meeus, NASA GSFC, https://eclipse.gsfc.nasa.gov/',
  retrieved: new Date().toISOString(),
  generator: 'packages/engine/scripts/fetch-nasa-eclipses.mjs',
  selection: { seed: SEED, firstYear: FIRST_YEAR, lastYear: LAST_YEAR, quota: QUOTA },
  typeLetters: {
    solar: { T: 'total', A: 'annular', H: 'hybrid', P: 'partial' },
    lunar: { T: 'total', P: 'partial', N: 'penumbral' },
  },
  eclipses: picked,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(fixture, null, 1)}\n`);
console.log(`wrote ${OUT}`);
