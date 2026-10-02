#!/usr/bin/env node
/**
 * Fetch reference local apparent sidereal time (LAST) from NASA JPL Horizons.
 *
 *   node packages/engine/scripts/fetch-horizons-sidereal.mjs
 *
 * Writes packages/engine/test/fixtures/horizons-sidereal.json. LAST is the one astronomical
 * input to the ascendant and house cusps (with the obliquity and the latitude), so checking
 * it against JPL checks the ascendant's dependence on Earth's rotation.
 *
 * Instants are given in TT and drawn from 1962–2020, where Earth-rotation (UT1) values are
 * measured, not predicted, in both Horizons (IERS EOP) and Swiss Ephemeris (delta T tables).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../test/fixtures/horizons-sidereal.json', import.meta.url));
const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const SEED = 20261002;
const COUNT = 6;
const JD_FIRST = 2437665.5; // 1962-01-01 TT
const JD_LAST = 2458849.5; // 2020-01-01 TT

const SITES = [
  { name: 'Ujjain', lat: 23.1765, lon: 75.7885 },
  { name: 'New Delhi', lat: 28.6139, lon: 77.209 },
  { name: 'London', lat: 51.5074, lon: -0.1278 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
];

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

const sites = [];
for (const site of SITES) {
  const instants = Array.from({ length: COUNT }, () => (JD_FIRST + rand() * (JD_LAST - JD_FIRST)).toFixed(6)).sort();
  const params = new URLSearchParams({
    format: 'text',
    COMMAND: "'10'",
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@399'",
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${site.lon},${site.lat},0'`,
    TLIST: `'${instants.join(' ')}'`,
    TLIST_TYPE: "'JD'",
    TIME_TYPE: "'TT'",
    QUANTITIES: "'7'",
    ANG_FORMAT: "'DEG'", // decimal hours rather than HH MM SS
    EXTRA_PREC: "'YES'",
    CAL_FORMAT: "'JD'",
    CSV_FORMAT: "'YES'",
  });
  const res = await fetch(`${API}?${params}`);
  if (!res.ok) throw new Error(`Horizons HTTP ${res.status}`);
  const text = await res.text();
  const block = text.slice(text.indexOf('$$SOE') + 5, text.indexOf('$$EOE')).trim();
  const rows = block.split('\n').map((line) => {
    const f = line.split(',').map((s) => s.trim());
    return { jdTT: f[0], lastHours: f[3] };
  });
  if (rows.length !== COUNT || rows.some((r) => !Number.isFinite(Number(r.lastHours)))) {
    throw new Error(`bad Horizons reply for ${site.name}:\n${text}`);
  }
  sites.push({ site, rows });
  console.log(site.name, rows);
}

const fixture = {
  description: 'Local apparent sidereal time (Horizons quantity 7) in decimal hours, at instants in TT.',
  source: 'NASA JPL Horizons API, https://ssd.jpl.nasa.gov/api/horizons.api',
  retrieved: new Date().toISOString(),
  generator: 'packages/engine/scripts/fetch-horizons-sidereal.mjs',
  seed: SEED,
  sites,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(fixture, null, 1)}\n`);
console.log(`wrote ${OUT}`);
