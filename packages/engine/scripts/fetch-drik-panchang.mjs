#!/usr/bin/env node
/**
 * Fetch pañcāṅga values from Drik Panchang (drikpanchang.com) for a handful of past dates
 * and Indian cities, and save them as a test fixture.
 *
 *   node packages/engine/scripts/fetch-drik-panchang.mjs
 *
 * Writes packages/engine/test/fixtures/drik-panchang.json. Drik Panchang is an outside,
 * independent computation (Lahiri ayanāṃśa, sunrise at the upper limb with refraction,
 * amānta and pūrṇimānta months); it shows times to the minute in IST (UTC+5:30). Past
 * dates only, so delta T is measured, not predicted. Twelve requests, one at a time.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../test/fixtures/drik-panchang.json', import.meta.url));
// GeoNames ids and coordinates (Drik Panchang locates cities by GeoNames id).
const PLACES = {
  'New Delhi': { geonameId: 1261481, latitude: 28.63576, longitude: 77.22445 },
  Ujjain: { geonameId: 1253914, latitude: 23.18239, longitude: 75.77643 },
  Chennai: { geonameId: 1264527, latitude: 13.08784, longitude: 80.27847 },
  Mumbai: { geonameId: 1275339, latitude: 19.07283, longitude: 72.88261 },
};
const QUERIES = [
  ['New Delhi', '1990-01-15'], ['Ujjain', '1995-06-21'], ['Chennai', '2000-03-20'], ['Mumbai', '2004-10-14'],
  ['New Delhi', '2007-07-10'], ['Ujjain', '2010-02-28'], ['Chennai', '2012-05-20'], ['Mumbai', '2015-09-28'],
  ['New Delhi', '2017-12-25'], ['Ujjain', '2020-06-21'], ['Chennai', '2023-01-21'], ['Mumbai', '2024-08-04'],
];
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

const text = (html) => html.replace(/<div class="dpElementInfoPopupWrapper"[\s\S]*?<\/div>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** Key/value cells of every dpTableRow, a continuation row (empty key) keeping its column's key. */
function cells(html) {
  const out = {};
  const rows = html.split('<div class="dpTableRow">').slice(1);
  for (const row of rows) {
    const parts = [...row.matchAll(/<div class="dpTableCell (dpTableKey|dpTableValue)">([\s\S]*?)(?=<div class="dpTableCell |$)/g)];
    let key = null;
    let col = 0;
    for (const [, kind, raw] of parts) {
      const body = raw.split('<h3')[0];
      if (kind === 'dpTableKey') {
        const k = text(body);
        key = k || (out.__cols?.[col] ?? null);
        out.__cols = out.__cols ?? [];
        out.__cols[col] = key;
      } else if (key) {
        (out[key] = out[key] ?? []).push(text(body));
        col = (col + 1) % 2;
      }
    }
  }
  delete out.__cols;
  return out;
}

/** "07:59 AM" or "05:51 AM, Oct 04" → ISO UTC, given the page's date. */
function toUtc(s, date) {
  const m = /(\d{1,2}):(\d{2}) (AM|PM)(?:\s*,\s*(\w{3}) (\d{1,2}))?/.exec(s);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3] === 'PM') h += 12;
  let [y, mo, d] = date.split('-').map(Number);
  if (m[4]) {
    const mon = MONTHS[m[4]];
    if (mon < mo && mo === 12) y += 1;
    mo = mon;
    d = Number(m[5]);
  }
  const ms = Date.UTC(y, mo - 1, d, h, Number(m[2])) - 5.5 * 3600e3;
  return new Date(ms).toISOString().slice(0, 16) + 'Z';
}

const ends = (vals, date) =>
  (vals ?? []).map((v) => {
    const name = v.split(' upto ')[0].trim();
    const upto = v.includes(' upto ') ? toUtc(v.split(' upto ')[1], date) : null;
    return { name, upto };
  });
const range = (v, date) => {
  if (!v || !v[0].includes(' to ')) return null; // e.g. "None": Drik gives no abhijit on Wednesdays
  const [a, b] = v[0].split(' to ');
  return { start: toUtc(a, date), end: toUtc(b, date) };
};

const days = [];
for (const [placeName, date] of QUERIES) {
  const place = PLACES[placeName];
  const [y, m, d] = date.split('-');
  const url = `https://www.drikpanchang.com/panchang/day-panchang.html?geoname-id=${place.geonameId}&date=${d}/${m}/${y}`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Aletheia reference check)' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const html = await res.text();
  const title = /<title>([^<]*)/.exec(html)?.[1] ?? '';
  if (!title.includes(` for ${placeName},`)) throw new Error(`${url} is not ${placeName}: ${title}`);
  const c = cells(html);
  days.push({
    place: placeName,
    date,
    url,
    sunrise: toUtc(c.Sunrise?.[0] ?? '', date),
    sunset: toUtc(c.Sunset?.[0] ?? '', date),
    tithi: ends(c.Tithi, date),
    nakshatra: ends(c.Nakshatra, date),
    yoga: ends(c.Yoga, date),
    karana: ends(c.Karana, date).filter((k) => /^[A-Z][a-z]+$/.test(k.name)),
    weekday: c.Weekday?.[0] ?? null,
    paksha: c.Paksha?.[0] ?? null,
    amanta: c.Chandramasa?.find((v) => v.endsWith('Amanta'))?.replace(/ - Amanta$/, '') ?? null,
    purnimanta: c.Chandramasa?.find((v) => v.endsWith('Purnimanta'))?.replace(/ - Purnimanta$/, '') ?? null,
    shakaSamvat: c['Shaka Samvat']?.[0] ?? null,
    rahuKalam: range(c['Rahu Kalam'], date),
    yamaganda: range(c.Yamaganda, date),
    gulikai: range(c['Gulikai Kalam'], date),
    abhijit: range(c.Abhijit, date),
  });
  await new Promise((r) => setTimeout(r, 1500));
}
for (const day of days) {
  if (!day.sunrise || !day.tithi.length || !day.nakshatra.length) throw new Error(`could not parse ${day.url}`);
}

writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      description: 'Day pañcāṅgas from Drik Panchang: times to the minute, IST on the page, stored here as UTC. Names in Drik’s spelling.',
      source: 'https://www.drikpanchang.com/panchang/day-panchang.html',
      retrieved: new Date().toISOString(),
      generator: 'packages/engine/scripts/fetch-drik-panchang.mjs',
      places: PLACES,
      days,
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${days.length} days to ${OUT}`);
