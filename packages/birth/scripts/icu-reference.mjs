#!/usr/bin/env node
/**
 * Reference for test/zones.test.ts: every UTC-offset change of every zone in the table,
 * 1800–2100, from Node's ICU, a compilation of the IANA tzdb independent of the zic/TZif
 * build the table comes from (scripts/build-zones.py).
 *
 *   node packages/birth/scripts/icu-reference.mjs
 *
 * Writes packages/birth/test/fixtures/icu-zones.json. Method: sample each zone's offset
 * once a day and bisect every change to the second (about 8 minutes). ICU may carry an
 * older tzdb release than the table; the test lists the differences each release made.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TABLE = JSON.parse(readFileSync(new URL('../data/zones.json', import.meta.url), 'utf8'));
const OUT = fileURLToPath(new URL('../test/fixtures/icu-zones.json', import.meta.url));
const [START, END] = TABLE.range;
const DAY = 86400;

/** UTC offset in seconds at a Unix time, from ICU. */
function offsetFn(zone) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' });
  return (t) => {
    const s = fmt.formatToParts(new Date(t * 1000)).find((p) => p.type === 'timeZoneName').value;
    if (s === 'GMT') return 0;
    const m = /^GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
    if (!m) throw new Error(`${zone}: cannot read offset "${s}"`);
    return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4] ?? 0));
  };
}

const zones = {};
for (const zone of Object.keys(TABLE.zones)) {
  const off = offsetFn(zone);
  const out = [off(START)];
  let t0 = START;
  let o0 = out[0];
  for (let t1 = START + DAY; t1 <= END; t1 += DAY) {
    const o1 = off(t1);
    if (o1 !== o0) {
      let lo = t0;
      let hi = t1;
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (off(mid) === o0) lo = mid;
        else hi = mid;
      }
      out.push(hi, off(hi));
      o0 = o1;
    }
    t0 = t1;
  }
  zones[zone] = out;
}

writeFileSync(
  OUT,
  JSON.stringify({
    source: `Node ${process.version}, ICU ${process.versions.icu}, IANA tzdb ${process.versions.tz}`,
    tzdb: process.versions.tz,
    retrieved: new Date().toISOString().slice(0, 10),
    range: [START, END],
    zones,
  }) + '\n',
);
console.log(`${Object.keys(zones).length} zones → ${OUT}`);
