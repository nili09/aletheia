#!/usr/bin/env node
/**
 * Fetch reference sunrise, sunset, moonrise and moonset times from the US Naval Observatory
 * Astronomical Applications API and save them as a test fixture.
 *
 *   node packages/engine/scripts/fetch-usno-riseset.mjs
 *
 * Writes packages/engine/test/fixtures/usno-riseset.json. Times are requested in UT (tz=0)
 * and USNO gives them to the minute. USNO's convention: the upper limb on a sea-level
 * horizon with 34' of refraction; the Moon topocentric. That matches our default sunrise
 * convention (upper limb, standard refraction), so only that convention is checked against
 * USNO. See docs/TESTING.md, "Rise and set against USNO".
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../test/fixtures/usno-riseset.json', import.meta.url));
const API = 'https://aa.usno.navy.mil/api/rstt/oneday';
const SEED = 20261002;

const PLACES = [
  { name: 'Ujjain', lat: 23.1765, lon: 75.7885 },
  { name: 'New Delhi', lat: 28.6139, lon: 77.209 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Quito', lat: -0.1807, lon: -78.4678 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
  { name: 'London', lat: 51.5074, lon: -0.1278 },
  { name: 'Oslo', lat: 59.9139, lon: 10.7522 },
];
const DATES_PER_PLACE = 3;
const FIRST = Date.UTC(1950, 0, 1);
const LAST = Date.UTC(2050, 11, 31);

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);

const cases = [];
for (const place of PLACES) {
  for (let i = 0; i < DATES_PER_PLACE; i++) {
    const day = new Date(FIRST + Math.floor(rand() * ((LAST - FIRST) / 86400000)) * 86400000);
    const date = day.toISOString().slice(0, 10);
    const url = `${API}?date=${date}&coords=${place.lat},${place.lon}&tz=0`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`USNO HTTP ${res.status} for ${url}`);
    const data = (await res.json()).properties.data;
    const pick = (list, phen) => list.find((e) => e.phen === phen)?.time ?? null;
    cases.push({
      place,
      date,
      url,
      sun: { rise: pick(data.sundata, 'Rise'), set: pick(data.sundata, 'Set') },
      moon: { rise: pick(data.moondata, 'Rise'), set: pick(data.moondata, 'Set') },
    });
    console.log(place.name, date, cases.at(-1).sun, cases.at(-1).moon);
  }
}

const fixture = {
  description: 'Rise and set times in UT, to the minute, for the Sun and Moon at sea level.',
  source: 'US Naval Observatory, Astronomical Applications API v4, https://aa.usno.navy.mil/data/api',
  retrieved: new Date().toISOString(),
  generator: 'packages/engine/scripts/fetch-usno-riseset.mjs',
  convention: "Upper limb on the horizon with 34' refraction; Moon topocentric; observer at sea level.",
  seed: SEED,
  cases,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(fixture, null, 1)}\n`);
console.log(`wrote ${OUT}`);
