#!/usr/bin/env node
/**
 * Build the offline place index from GeoNames (geonames.org, CC BY 4.0).
 *
 *   node packages/birth/scripts/build-places.mjs
 *
 * Writes packages/birth/data/places-india.txt and places-world.txt:
 * - India: every populated place in IN.zip (feature class P: cities, towns, villages),
 *   except abandoned, historical and destroyed ones (PPLQ, PPLH, PPLW), with district and
 *   state names from admin2Codes.txt and admin1CodesASCII.txt.
 * - World: cities5000.zip (places of 5,000 people or more) outside India, with the first
 *   administrative division and the country.
 *
 * Coordinates are kept exactly as GeoNames gives them (to 1e-5°), as is the SRTM/GTOPO
 * elevation model value (column dem). Latin-script alternate names are kept for Indian
 * places with a population (Bombay, Calcutta, Poona…), so old names find the place, and
 * for the world's cities of a million or more.
 *
 * File format (UTF-8 text, one record per line, tab-separated; integers in base 36):
 *   #aletheia-places 1                         header
 *   #source <text>                             provenance
 *   #zones <IANA zones>
 *   R <country> <admin1> <admin2> <country name> <admin1 name> <admin2 name> <lat0> <lon0>
 *   P <name> <dlat> <dlon> <zone> <dem> <rank> <population> <geonameid>
 *   A <alternate name> <place index>
 * A region (R: a district of India, or a state or province elsewhere) is followed by its
 * places (P), sorted by latitude. Coordinates are integers in units of 1e-5°: each latitude
 * is stored as the difference from the previous place's (the first from lat0), each
 * longitude as the difference from lon0. An empty zone means the previous place's zone;
 * trailing empty fields are dropped. Places are numbered in file order; A lines give
 * alternate names and point to a place by that number.
 */
import { writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const BASE = 'https://download.geonames.org/export/dump/';
const OUT = (name) => fileURLToPath(new URL(`../data/${name}`, import.meta.url));

async function get(name) {
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The one text file inside a .zip archive, by name. */
function unzip(buf, want) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString();
    if (name === want) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${want} not in archive`);
}

/** Search key: no diacritics, lower case, letters and digits separated by single spaces (as src/places.ts). */
function fold(s) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const b36 = (n) => (n < 0 ? '-' + (-n).toString(36) : n.toString(36));
const rows = (text) => text.split('\n').filter(Boolean).map((l) => l.split('\t'));

// GeoNames columns: 0 id, 1 name, 2 asciiname, 3 alternatenames, 4 lat, 5 lon, 6 class,
// 7 code, 8 country, 10 admin1, 11 admin2, 14 population, 16 dem, 17 timezone.
const RANK = { PPLC: 9, PPLA: 8, PPLG: 8, PPLA2: 7, PPLA3: 6, PPLA4: 5, PPLA5: 5 };
const SKIP = new Set(['PPLQ', 'PPLH', 'PPLW']);

const [admin1, admin2, countries] = await Promise.all(['admin1CodesASCII.txt', 'admin2Codes.txt', 'countryInfo.txt'].map(async (f) => (await get(f)).toString('utf8')));
const admin1Name = new Map(rows(admin1).map((r) => [r[0], r[1]]));
const admin2Name = new Map(rows(admin2).map((r) => [r[0], r[1]]));
const countryName = new Map(rows(countries).filter((r) => !r[0].startsWith('#')).map((r) => [r[0], r[4]]));
const retrieved = new Date().toISOString().slice(0, 10);

function build(file, records, withAdmin2, altMinPopulation) {
  const zones = [...new Set(records.map((r) => r[17]))].sort();
  const zoneIndex = new Map(zones.map((z, i) => [z, i]));
  // Coordinates must survive the 1e-5 integer form exactly (GeoNames gives at most 5 decimals).
  const e5 = (c) => {
    const n = Math.round(Number(c) * 1e5);
    if (n / 1e5 !== Number(c)) throw new Error(`coordinate ${c} has more than 5 decimals`);
    return n;
  };
  const regions = new Map();
  for (const r of records) {
    if (!fold(r[1])) continue;
    const key = [r[8], r[10], withAdmin2 ? r[11] : ''].join('.');
    if (!regions.has(key)) regions.set(key, []);
    regions.get(key).push({ r, lat: e5(r[4]), lon: e5(r[5]) });
  }
  const lines = [];
  const alts = [];
  let index = 0;
  let prevZone = -1;
  for (const [key, places] of [...regions].sort(([a], [b]) => (a < b ? -1 : 1))) {
    places.sort((a, b) => a.lat - b.lat || a.lon - b.lon || Number(a.r[0]) - Number(b.r[0]));
    const r0 = places[0].r;
    const lat0 = places[0].lat;
    const lon0 = Math.min(...places.map((p) => p.lon));
    lines.push(['R', r0[8], r0[10], withAdmin2 ? r0[11] : '', countryName.get(r0[8]) ?? r0[8], admin1Name.get(`${r0[8]}.${r0[10]}`) ?? '', withAdmin2 ? (admin2Name.get(key) ?? '') : '', b36(lat0), b36(lon0)].join('\t'));
    let prevLat = lat0;
    for (const { r, lat, lon } of places) {
      const pop = Number(r[14]) || 0;
      const zone = zoneIndex.get(r[17]);
      const dem = r[16] === '' || r[16] === '-9999' ? '' : b36(Number(r[16]));
      const fields = ['P', r[1], b36(lat - prevLat), b36(lon - lon0), zone === prevZone ? '' : b36(zone), dem, RANK[r[7]] ? String(RANK[r[7]]) : '', pop ? b36(pop) : '', pop || RANK[r[7]] ? b36(Number(r[0])) : ''];
      while (fields.at(-1) === '') fields.pop();
      lines.push(fields.join('\t'));
      prevLat = lat;
      prevZone = zone;
      if (pop >= altMinPopulation) {
        const own = new Set([fold(r[1]), fold(r[2])]);
        for (const alt of r[3].split(',')) {
          const f = fold(alt);
          // Latin script only; skip codes and the place's own spellings.
          if (!f || own.has(f) || !/^[a-z0-9 ]+$/.test(f) || /^\d+$/.test(f) || alt.length < 3) continue;
          own.add(f);
          alts.push(`A\t${alt}\t${index.toString(36)}`);
        }
      }
      index++;
    }
  }
  const text = [
    '#aletheia-places 1',
    `#source GeoNames (geonames.org), CC BY 4.0: ${file === 'places-india.txt' ? 'IN.zip, admin1CodesASCII.txt, admin2Codes.txt' : 'cities5000.zip, admin1CodesASCII.txt, countryInfo.txt'}; retrieved ${retrieved}`,
    `#zones\t${zones.join('\t')}`,
    ...lines,
    ...alts,
  ].join('\n');
  writeFileSync(OUT(file), text + '\n');
  console.log(`${file}: ${index} places, ${alts.length} alternate names, ${regions.size} regions, ${zones.length} zones, ${(text.length / 1e6).toFixed(1)} MB`);
}

const india = rows(unzip(await get('IN.zip'), 'IN.txt')).filter((r) => r[6] === 'P' && !SKIP.has(r[7]));
build('places-india.txt', india, true, 1);
const world = rows(unzip(await get('cities5000.zip'), 'cities5000.txt')).filter((r) => r[8] !== 'IN' && r[6] === 'P' && !SKIP.has(r[7]));
build('places-world.txt', world, false, 1000000);
