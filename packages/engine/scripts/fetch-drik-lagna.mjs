#!/usr/bin/env node
/**
 * Fetch Drik Panchang's Udaya Lagna tables (the times each sidereal sign rises, Lahiri) for
 * a few past dates and Indian cities, and save them as a test fixture.
 *
 *   node packages/engine/scripts/fetch-drik-lagna.mjs
 *
 * Writes packages/engine/test/fixtures/drik-lagna.json. Drik Panchang is an independent
 * computation; it shows times to the minute in the local time of the place, which it
 * takes from the IANA tzdb (the page states the zone and offset). Ten requests, one at a time.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../test/fixtures/drik-lagna.json', import.meta.url));
// GeoNames ids and coordinates (Drik Panchang locates cities by GeoNames id).
const PLACES = {
  Mumbai: { geonameId: 1275339, latitude: 19.07283, longitude: 72.88261 },
  Kolkata: { geonameId: 1275004, latitude: 22.56263, longitude: 88.36304 },
  'New Delhi': { geonameId: 1261481, latitude: 28.63576, longitude: 77.22445 },
  Chennai: { geonameId: 1264527, latitude: 13.08784, longitude: 80.27847 },
};
const QUERIES = [
  ['Mumbai', '1952-07-07'], ['Kolkata', '1948-02-14'], ['New Delhi', '1961-01-26'], ['Chennai', '1975-11-09'],
  ['Mumbai', '1989-04-30'], ['Kolkata', '1996-08-15'], ['New Delhi', '2003-12-22'], ['Chennai', '2011-03-05'],
  ['Mumbai', '2018-06-21'], ['Kolkata', '2024-10-01'],
];
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const RASHI = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrishchika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'];

const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

/** "05:17 AM" or "01:18 AM , Mar 15" → "YYYY-MM-DDTHH:MM" local. */
function local(s, date) {
  const m = /(\d{2}):(\d{2}) (AM|PM)(?: , (\w{3}) (\d{1,2}))?/.exec(s);
  let h = Number(m[1]) % 12;
  if (m[3] === 'PM') h += 12;
  let [y, mo, d] = date.split('-').map(Number);
  if (m[4]) {
    const mon = MONTHS[m[4]];
    if (mon < mo) y += 1;
    mo = mon;
    d = Number(m[5]);
  }
  const p = (n) => String(n).padStart(2, '0');
  return `${y}-${p(mo)}-${p(d)}T${p(h)}:${m[2]}`;
}

const days = [];
for (const [name, date] of QUERIES) {
  const place = PLACES[name];
  const [y, m, d] = date.split('-');
  const url = `https://www.drikpanchang.com/muhurat/lagna.html?geoname-id=${place.geonameId}&date=${d}/${m}/${y}`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Aletheia reference check)' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const t = text(await res.text());
  const zone = /Olson Timezone: (\S+)/.exec(t)?.[1];
  const table = t.slice(t.indexOf('Lagna Rashi Lagna Time'), t.indexOf('Notes:'));
  const re = new RegExp(`(${RASHI.join('|')}) (\\d{2}:\\d{2} [AP]M(?: , \\w{3} \\d{1,2})?) to (\\d{2}:\\d{2} [AP]M(?: , \\w{3} \\d{1,2})?)`, 'g');
  const lagnas = [...table.matchAll(re)].map((x) => ({ sign: RASHI.indexOf(x[1]), start: local(x[2], date), end: local(x[3], date) }));
  if (lagnas.length !== 12) throw new Error(`${name} ${date}: found ${lagnas.length} lagnas`);
  // Drik marks the next day on end times only; each lagna starts where the previous ends.
  for (let i = 1; i < lagnas.length; i++) {
    if (lagnas[i].start.slice(11) !== lagnas[i - 1].end.slice(11)) throw new Error(`${name} ${date}: lagna ${i} does not start where ${i - 1} ends`);
    lagnas[i].start = lagnas[i - 1].end;
  }
  days.push({ place: name, ...place, date, zone, lagnas });
  console.log(name, date, zone, lagnas.length);
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: 'Drik Panchang, Udaya Lagna table, https://www.drikpanchang.com/muhurat/lagna.html (Lahiri / Chitra Paksha)',
      retrieved: new Date().toISOString().slice(0, 10),
      note: 'Times are local wall-clock times to the minute (truncated or rounded by Drik), in the zone the page states.',
      days,
    },
    null,
    1,
  ) + '\n',
);
