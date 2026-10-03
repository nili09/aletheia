import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { BOMBAY_OFFSET, CALCUTTA_OFFSET, indianClocks, indianRegion, MADRAS_OFFSET, resolveBirthTime, type LocalTime, type ZoneTable } from '../src/index.ts';

const table = JSON.parse(readFileSync(new URL('../data/zones.json', import.meta.url), 'utf8')) as ZoneTable;
const L = (y: number, mo: number, d: number, h: number, mi: number): LocalTime => ({ year: y, month: mo, day: d, hour: h, minute: mi, second: 0 });
const iso = (unixMs: number) => new Date(unixMs).toISOString().replace('.000Z', 'Z');

// GeoNames coordinates and admin codes of the cities (Mumbai’s record has no district).
const MUMBAI = { latitude: 19.07283, longitude: 72.88261, zone: 'Asia/Kolkata', admin1: '16', admin2: '' };
const KOLKATA = { latitude: 22.56263, longitude: 88.36304, zone: 'Asia/Kolkata', admin1: '28', admin2: '342' };
const DELHI = { latitude: 28.62137, longitude: 77.2148, zone: 'Asia/Kolkata', admin1: '07', admin2: '094' };
const CHENNAI = { latitude: 13.08784, longitude: 80.27847, zone: 'Asia/Kolkata', admin1: '25', admin2: '' };

const ids = (local: LocalTime, place: typeof MUMBAI) => resolveBirthTime(table, local, place).options.map((o) => o.id);

describe('the offsets (docs/CANON.md, India’s clocks)', () => {
  test('Bombay Time is 39 minutes behind IST, Calcutta Time 5:53:20, Madras 5:21:10', () => {
    expect(5.5 * 3600 - BOMBAY_OFFSET).toBe(39 * 60);
    expect(CALCUTTA_OFFSET).toBe(5 * 3600 + 53 * 60 + 20);
    expect(MADRAS_OFFSET).toBe(5 * 3600 + 21 * 60 + 10);
  });

  test('local mean time is 4 minutes per degree, not rounded', () => {
    const o = resolveBirthTime(table, L(1860, 1, 1, 12, 0), MUMBAI).options[0]!;
    expect(o.id).toBe('lmt');
    expect(o.offsetSeconds).toBe(72.88261 * 240);
  });

  test('regions: Mumbai and Mumbai Suburban districts (or within 25 km of Mumbai, district unrecorded); West Bengal', () => {
    expect(indianRegion('16', '519', 18.93, 72.83)).toBe('bombay');
    expect(indianRegion('16', '518', 19.2, 72.85)).toBe('bombay');
    expect(indianRegion('16', '', 19.07283, 72.88261)).toBe('bombay'); // GeoNames' Mumbai has no district
    expect(indianRegion('16', '', 18.52, 73.86)).toBe('other'); // Pune, 120 km
    expect(indianRegion('16', '517', 19.2, 72.97)).toBe('other'); // Thane district
    expect(indianRegion('28', '337', 22.7, 88.4)).toBe('calcutta');
    expect(indianRegion('07', '094', 28.6, 77.2)).toBe('other');
  });
});

describe('five births from Mumbai and Kolkata, 1930–1960 (the checkpoint)', () => {
  test('Mumbai, 12 May 1934, 10:15: IST or Bombay Time, 39 minutes apart', () => {
    const r = resolveBirthTime(table, L(1934, 5, 12, 10, 15), MUMBAI);
    expect(r.ambiguous).toBe(true);
    expect(r.options.map((o) => [o.id, iso(o.unixMs)])).toEqual([
      ['ist', '1934-05-12T04:45:00Z'],
      ['bombay', '1934-05-12T05:24:00Z'],
    ]);
  });

  test('Mumbai, 20 August 1943, 06:40: war time, IST or Bombay Time', () => {
    const r = resolveBirthTime(table, L(1943, 8, 20, 6, 40), MUMBAI);
    expect(r.options.map((o) => [o.id, iso(o.unixMs)])).toEqual([
      ['ist-war', '1943-08-20T00:10:00Z'],
      ['ist', '1943-08-20T01:10:00Z'],
      ['bombay', '1943-08-20T01:49:00Z'],
    ]);
  });

  test('Kolkata, 3 November 1938, 21:30: Calcutta Time or IST, 23 min 20 s apart', () => {
    const r = resolveBirthTime(table, L(1938, 11, 3, 21, 30), KOLKATA);
    expect(r.options.map((o) => [o.id, iso(o.unixMs)])).toEqual([
      ['calcutta', '1938-11-03T15:36:40Z'],
      ['ist', '1938-11-03T16:00:00Z'],
    ]);
  });

  test('Kolkata, 10 March 1942, 04:50: Bengal war time or IST', () => {
    const r = resolveBirthTime(table, L(1942, 3, 10, 4, 50), KOLKATA);
    expect(r.options.map((o) => [o.id, iso(o.unixMs)])).toEqual([
      ['bengal-war', '1942-03-09T22:20:00Z'],
      ['ist', '1942-03-09T23:20:00Z'],
    ]);
  });

  test('Kolkata, 14 February 1948, 13:05: IST, or Calcutta Time if it lasted into 1948', () => {
    const r = resolveBirthTime(table, L(1948, 2, 14, 13, 5), KOLKATA);
    expect(r.options.map((o) => [o.id, iso(o.unixMs)])).toEqual([
      ['ist', '1948-02-14T07:35:00Z'],
      ['calcutta', '1948-02-14T07:11:40Z'],
    ]);
  });
});

describe('when the question is not asked, and the edges of each period', () => {
  test('after the city clocks ended, Mumbai and Kolkata are on IST alone', () => {
    expect(ids(L(1958, 1, 1, 9, 0), MUMBAI)).toEqual(['ist']);
    expect(ids(L(1950, 6, 1, 9, 0), KOLKATA)).toEqual(['ist']);
    expect(resolveBirthTime(table, L(1958, 1, 1, 9, 0), MUMBAI).ambiguous).toBe(false);
  });

  test('Bombay Time is still offered until 1955 (Das: March 1950; others: 1955)', () => {
    expect(ids(L(1952, 7, 7, 18, 20), MUMBAI)).toEqual(['ist', 'bombay']);
    expect(ids(L(1955, 12, 31, 12, 0), MUMBAI)).toEqual(['ist', 'bombay']);
    expect(ids(L(1956, 1, 2, 12, 0), MUMBAI)).toEqual(['ist']);
  });

  test('elsewhere in India: IST alone between the wars, a question in the war', () => {
    expect(ids(L(1938, 6, 1, 9, 0), DELHI)).toEqual(['ist']);
    expect(ids(L(1943, 6, 1, 9, 0), DELHI)).toEqual(['ist-war', 'ist']);
    expect(ids(L(1941, 12, 1, 9, 0), DELHI)).toEqual(['ist', 'tzdb-1941']); // the tzdb’s Shanks reading
    expect(ids(L(1942, 6, 1, 9, 0), DELHI)).toEqual(['ist']);
    expect(ids(L(1945, 10, 16, 9, 0), DELHI)).toEqual(['ist']);
  });

  test('war time ends at 2 a.m. on 15 October 1945; the day around it offers both', () => {
    expect(ids(L(1945, 10, 14, 1, 0), DELHI)).toEqual(['ist-war', 'ist']);
    expect(ids(L(1945, 10, 16, 2, 30), DELHI)).toEqual(['ist']);
  });

  test('before 1906: local mean time and Madras railway time; city times from 1884', () => {
    expect(ids(L(1890, 3, 1, 9, 0), CHENNAI)).toEqual(['lmt', 'madras']);
    expect(ids(L(1890, 3, 1, 9, 0), MUMBAI)).toEqual(['lmt', 'madras', 'bombay']);
    expect(ids(L(1890, 3, 1, 9, 0), KOLKATA)).toEqual(['lmt', 'madras', 'calcutta']);
    expect(ids(L(1860, 3, 1, 9, 0), DELHI)).toEqual(['lmt']);
  });

  test('the first day of IST offers the clocks of both sides', () => {
    expect(ids(L(1906, 1, 1, 5, 0), DELHI)).toEqual(['lmt', 'madras', 'ist']);
    expect(ids(L(1906, 1, 3, 5, 0), DELHI)).toEqual(['ist']);
  });

  test('every option carries its sources', () => {
    for (const o of resolveBirthTime(table, L(1943, 8, 20, 6, 40), MUMBAI).options) expect(o.sources.length).toBeGreaterThan(0);
  });

  test('India’s clocks need no zone table: 1750 is local mean time', () => {
    expect(indianClocks(L(1750, 1, 1, 6, 0), 77, 'other').clocks.map((c) => c.id)).toEqual(['lmt']);
    expect(ids(L(1750, 1, 1, 6, 0), DELHI)).toEqual(['lmt']);
  });

  test('the tzdb’s own reading is reported for comparison', () => {
    expect(resolveBirthTime(table, L(1934, 5, 12, 10, 15), MUMBAI).tzdbOffsets).toEqual([19800]);
    expect(resolveBirthTime(table, L(1890, 3, 1, 9, 0), MUMBAI).tzdbOffsets).toEqual([MADRAS_OFFSET]);
  });
});
