import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';
import { fold, haversineKm, indianRegion, PlaceIndex, regionLabel, type ZoneTable } from '../src/index.ts';

const read = (f: string) => readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8');
const zones = JSON.parse(read('zones.json')) as ZoneTable;
let index: PlaceIndex;

beforeAll(() => {
  index = PlaceIndex.parse(read('places-india.txt'), read('places-world.txt'));
});

describe('the index', () => {
  test('holds every Indian populated place and the world’s towns of 5,000 or more', () => {
    expect(index.size).toBe(549_021 + 63_195);
    expect(index.source).toMatch(/GeoNames \(geonames\.org\), CC BY 4\.0/);
  });

  test('coordinates are GeoNames’ own, to 1e-5° (records of IN.txt, retrieved 2026-10-03)', () => {
    const byId = new Map(index.places.filter((p) => p.geonameId).map((p) => [p.geonameId, p]));
    expect(byId.get(1275339)).toMatchObject({ name: 'Mumbai', latitude: 19.07283, longitude: 72.88261, zone: 'Asia/Kolkata', region: { admin1: '16', admin2: '' } });
    expect(byId.get(1275004)).toMatchObject({ name: 'Kolkata', latitude: 22.56263, longitude: 88.36304, region: { admin1: '28', admin2: '342' } });
    expect(byId.get(1261481)).toMatchObject({ name: 'New Delhi', latitude: 28.62137, longitude: 77.2148, region: { admin2Name: 'New Delhi', admin1Name: 'Delhi' } });
    // Drik Panchang's coordinates for these ids (engine fixtures) agree for Mumbai, Ujjain and Chennai.
    expect(byId.get(1253914)).toMatchObject({ name: 'Ujjain', latitude: 23.18239, longitude: 75.77643 });
    expect(byId.get(1264527)).toMatchObject({ name: 'Chennai', latitude: 13.08784, longitude: 80.27847 });
  });

  test('every place’s zone is in the zone table', () => {
    const missing = new Set(index.places.map((p) => p.zone).filter((z) => !zones.zones[z] && !zones.links[z]));
    expect([...missing]).toEqual([]);
  });

  test('fold matches the build script’s (names with diacritics, punctuation)', () => {
    expect(fold('Rāmpur')).toBe('rampur');
    expect(fold('Bandra (West)')).toBe('bandra west');
    expect(fold('  Śrī–Kṣetra ')).toBe('sri ksetra');
  });
});

describe('search', () => {
  test('old names find today’s city', () => {
    expect(index.search('Bombay')[0]).toMatchObject({ place: { name: 'Mumbai' }, alias: 'Bombay' });
    expect(index.search('Calcutta')[0]!.place.name).toBe('Kolkata');
    expect(index.search('Madras')[0]!.place.name).toBe('Chennai');
    expect(index.search('Poona')[0]!.place.name).toBe('Pune');
  });

  test('the cities a birth would most likely mean come first', () => {
    expect(index.search('Mumbai')[0]!.place.geonameId).toBe(1275339);
    expect(index.search('kolkata')[0]!.place.region.admin1).toBe('28');
    expect(index.search('London')[0]!.place.region.country).toBe('GB');
  });

  test('villages are found, with district and state to tell them apart', () => {
    const r = index.search('Rampur', 50);
    expect(r.length).toBe(50);
    const labels = new Set(r.map((m) => `${m.place.name} · ${regionLabel(m.place.region)}`));
    expect(labels.size).toBeGreaterThan(30);
  });

  test('"name, district" narrows to the district', () => {
    const r = index.search('Rampur, Bareilly', 100);
    expect(r.length).toBeGreaterThan(0);
    for (const m of r) expect(regionLabel(m.place.region)).toMatch(/Bareilly/);
  });

  test('regions of Mumbai and Kolkata select their city clocks', () => {
    const m = index.search('Mumbai')[0]!.place.region;
    const k = index.search('Kolkata')[0]!.place.region;
    const mp = index.search('Mumbai')[0]!.place;
    const kp = index.search('Kolkata')[0]!.place;
    expect(indianRegion(m.admin1, m.admin2, mp.latitude, mp.longitude)).toBe('bombay');
    expect(indianRegion(k.admin1, k.admin2, kp.latitude, kp.longitude)).toBe('calcutta');
  });

  test('an empty query finds nothing', () => {
    expect(index.search(' , ')).toEqual([]);
  });
});

describe('nearest place', () => {
  test('a point in Mumbai is nearest a Mumbai place', () => {
    const n = index.nearest(18.9388, 72.8354); // Churchgate
    expect(n.km).toBeLessThan(3);
    expect(indianRegion(n.place.region.admin1, n.place.region.admin2, n.place.latitude, n.place.longitude)).toBe('bombay');
  });

  test('haversine: one degree of latitude is 111.2 km', () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.195, 3);
  });
});
