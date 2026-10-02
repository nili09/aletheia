#!/usr/bin/env node
/**
 * Fetch reference positions from NASA JPL Horizons and save them as a test fixture.
 *
 *   node packages/engine/scripts/fetch-horizons-positions.mjs
 *
 * Writes packages/engine/test/fixtures/horizons-positions.json. Tests read only the
 * fixture, so they run offline. Re-run this script only to regenerate the fixture, and
 * record why in the commit message (docs/TESTING.md).
 *
 * What is requested (see docs/TESTING.md, "Positions against JPL Horizons"):
 *   - observer table, geocentric (CENTER 500@399), no refraction (APPARENT AIRLESS)
 *   - QUANTITIES 31: IAU76/80 ecliptic-of-date longitude and latitude of the apparent
 *     position (light-time, gravitational deflection, stellar aberration)
 *   - QUANTITIES 20: apparent range (light-time aberrated) and range rate
 *   - QUANTITIES 1: astrometric RA and Dec in the ICRF (light-time only, no aberration or
 *     deflection, no precession or nutation). A diagnostic: it isolates the ephemeris from
 *     the precession-nutation model
 *   - instants given as Julian days in Terrestrial Time (TIME_TYPE TT), so no delta T
 *     enters the comparison
 *   - EXTRA_PREC YES: angles to 1e-7 degree (0.00036 arcsecond)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../test/fixtures/horizons-positions.json', import.meta.url));
const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

/** Horizons target codes: body centres, not system barycentres. */
const BODIES = [
  ['sun', '10'],
  ['moon', '301'],
  ['mercury', '199'],
  ['venus', '299'],
  ['mars', '499'],
  ['jupiter', '599'],
  ['saturn', '699'],
];

/** 60 instants drawn uniformly from 1900-01-01 0h TT to 2100-12-31 24h TT with a fixed seed. */
const SEED = 20261002;
const COUNT = 60;
const JD_FIRST = 2415020.5; // 1900-01-01 00:00 TT
const JD_LAST = 2488434.5; // 2101-01-01 00:00 TT

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
// The instant is an input, so fixing it to 1e-6 day (0.0864 s) here is a definition, not
// a rounding of a computed value: the exact decimal string is what Horizons receives.
const instants = Array.from({ length: COUNT }, () =>
  (JD_FIRST + rand() * (JD_LAST - JD_FIRST)).toFixed(6),
).sort();

function query(command) {
  const params = {
    format: 'text',
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'500@399'",
    TLIST_TYPE: "'JD'",
    TIME_TYPE: "'TT'",
    TLIST: `'${instants.join(' ')}'`,
    QUANTITIES: "'1,20,31'",
    ANG_FORMAT: "'DEG'",
    EXTRA_PREC: "'YES'",
    CAL_FORMAT: "'JD'",
    CSV_FORMAT: "'YES'",
    APPARENT: "'AIRLESS'",
  };
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `${API}?${qs}`;
}

function parse(text, body) {
  const source = /Target body name:.*\{source:\s*([^}]+)\}/.exec(text)?.[1]?.trim();
  const soe = text.indexOf('$$SOE');
  const eoe = text.indexOf('$$EOE');
  if (soe < 0 || eoe < 0) throw new Error(`Horizons reply for ${body} has no ephemeris block:\n${text}`);
  const rows = text
    .slice(soe + 5, eoe)
    .trim()
    .split('\n')
    .map((line) => {
      // Columns: JDTT, (solar presence), (lunar presence), RA, DEC, delta, deldot, ObsEcLon, ObsEcLat
      const f = line.split(',').map((s) => s.trim());
      return { jdTT: f[0], raIcrfDeg: f[3], decIcrfDeg: f[4], deltaAu: f[5], deldotKmS: f[6], eclLonDeg: f[7], eclLatDeg: f[8] };
    });
  if (rows.length !== COUNT) throw new Error(`${body}: expected ${COUNT} rows, got ${rows.length}`);
  rows.forEach((r, i) => {
    // Horizons echoes the epoch after its internal TT -> TDB -> TT round trip, which can differ
    // from the request by ~1e-9 day (0.1 ms). Tests use the echoed epoch, which is the instant
    // Horizons actually computed; here we only check it is the instant we asked for.
    if (Math.abs(Number(r.jdTT) - Number(instants[i])) > 1e-8) {
      throw new Error(`${body}: row ${i} is ${r.jdTT}, asked ${instants[i]}`);
    }
    for (const k of ['raIcrfDeg', 'decIcrfDeg', 'deltaAu', 'eclLonDeg', 'eclLatDeg']) {
      if (!Number.isFinite(Number(r[k]))) throw new Error(`${body}: row ${i} ${k} = ${r[k]}`);
    }
  });
  return { source, rows };
}

const bodies = {};
let header = '';
for (const [name, code] of BODIES) {
  const url = query(code);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Horizons HTTP ${res.status} for ${name}`);
  const text = await res.text();
  if (!header) header = text.slice(0, text.indexOf('$$SOE'));
  const { source, rows } = parse(text, name);
  bodies[name] = { horizonsCode: code, ephemerisSource: source, rows };
  console.log(`${name}: ${rows.length} rows from ${source}`);
}

const fixture = {
  description:
    'Geocentric apparent ecliptic-of-date longitude and latitude (Horizons quantity 31, IAU76/80), apparent range (quantity 20) and astrometric ICRF RA/Dec (quantity 1), airless, at instants in TT.',
  source: 'NASA JPL Horizons API, https://ssd.jpl.nasa.gov/api/horizons.api',
  retrieved: new Date().toISOString(),
  generator: 'packages/engine/scripts/fetch-horizons-positions.mjs',
  instants: { seed: SEED, count: COUNT, firstJdTT: JD_FIRST, lastJdTT: JD_LAST, jdTT: instants },
  query: Object.fromEntries(new URL(query('<code>')).searchParams),
  sampleHeader: header,
  bodies,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(fixture, null, 1)}\n`);
console.log(`wrote ${OUT}`);
