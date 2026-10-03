import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { localSeconds, offsetAt, resolveInZone, type ZoneTable } from '../src/index.ts';

const table = JSON.parse(readFileSync(new URL('../data/zones.json', import.meta.url), 'utf8')) as ZoneTable;
const icu = JSON.parse(readFileSync(new URL('./fixtures/icu-zones.json', import.meta.url), 'utf8')) as { source: string; tzdb: string; zones: Record<string, number[]> };

const utc = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h, mi, s) / 1000;

/**
 * Changes made by the tzdb releases between ICU's (2026a) and the table's (2026e), from the
 * tzdb NEWS file: each zone may differ from ICU only from the date given.
 */
const RELEASED_SINCE_ICU: Record<string, { from: number; release: string; news: string }> = {
  'America/Vancouver': { from: utc(2026, 3, 9), release: '2026b', news: 'British Columbia moved to permanent -07 on 2026-03-09' },
  'America/Edmonton': { from: utc(2026, 6, 18), release: '2026c', news: 'Alberta moved to permanent -06 on 2026-06-18' },
  'Africa/Casablanca': { from: utc(2026, 9, 20), release: '2026c', news: 'Morocco moves to permanent +00 on 2026-09-20' },
  'Africa/El_Aaiun': { from: utc(2026, 9, 20), release: '2026c', news: 'Morocco moves to permanent +00 on 2026-09-20' },
  'America/Inuvik': { from: utc(2026, 8, 21), release: '2026d', news: 'Northwest Territories moved to permanent -06 on 2026-08-21' },
  'America/Bogota': { from: utc(1992, 5, 1), release: '2026d', news: 'Colombia’s 1992-05-02 spring forward was at 00:00, not 24:00' },
  'Asia/Tehran': { from: utc(1979, 5, 25), release: '2026d', news: 'Iran’s 1979-05-26 spring forward was at 00:00, not 24:00' },
  EST5EDT: { from: -Infinity, release: '2026d', news: 'EST5EDT, CST6CDT, MST7MDT and PST8PDT now conform better to POSIX' },
  CST6CDT: { from: -Infinity, release: '2026d', news: 'as EST5EDT' },
  MST7MDT: { from: -Infinity, release: '2026d', news: 'as EST5EDT' },
  PST8PDT: { from: -Infinity, release: '2026d', news: 'as EST5EDT' },
  'America/Winnipeg': { from: utc(2026, 10, 31), release: '2026e', news: 'Manitoba moves to permanent -05 on 2026-10-31' },
  'Europe/Dublin': { from: utc(1925, 9, 20), release: '2026e', news: 'In 1925 Ireland fell back on 09-20 not 10-04' },
};

/** The offset changes of a sequence before a time. */
const before = (seq: number[], t: number) => {
  const out = [seq[0]];
  for (let i = 1; i < seq.length; i += 2) if (seq[i]! < t) out.push(seq[i], seq[i + 1]);
  return out;
};

describe('zone table against Node’s ICU (an independent compilation of the tzdb)', () => {
  test('ICU and the table name their releases', () => {
    expect(table.tzdb).toBe('2026e');
    expect(icu.tzdb).toBe('2026a');
  });

  test('every zone agrees to the second, except where a later release changed it', () => {
    const differ: string[] = [];
    for (const zone of Object.keys(table.zones)) {
      const known = RELEASED_SINCE_ICU[zone];
      const a = table.zones[zone]!;
      const b = icu.zones[zone]!;
      if (known) {
        if (known.from > -Infinity) expect(before(a, known.from), `${zone} before ${known.release}`).toEqual(before(b, known.from));
        if (JSON.stringify(a) !== JSON.stringify(b)) differ.push(zone);
      } else expect(a, zone).toEqual(b);
    }
    // Each listed change really is in the data (the list is not stale).
    expect(differ.sort()).toEqual(Object.keys(RELEASED_SINCE_ICU).sort());
    expect(Object.keys(table.zones).length).toBe(344);
  });
});

describe('zone table against the IANA source text', () => {
  test('Asia/Kolkata: LMT, HMT, MMT, IST and the war years, as the zone lines say', () => {
    // Zone Asia/Kolkata 5:53:28 LMT 1854 Jun 28; 5:53:20 HMT 1870; 5:21:10 MMT 1906 Jan 1;
    // 5:30 IST 1941 Oct; 5:30+1 1942 May 15; IST 1942 Sep; 5:30+1 1945 Oct 15; IST.
    const local = (y: number, mo: number, d: number, off: number) => utc(y, mo, d) - off;
    const k = table.zones['Asia/Kolkata']!;
    expect(k).toEqual([
      21208,
      local(1854, 6, 28, 21208), 21200,
      local(1870, 1, 1, 21200), 19270,
      local(1906, 1, 1, 19270), 19800,
      local(1941, 10, 1, 19800), 23400,
      local(1942, 5, 15, 23400), 19800,
      local(1942, 9, 1, 19800), 23400,
      local(1945, 10, 15, 23400), 19800,
    ]);
  });

  test('Europe/London: double summer time in 1941 (Rule GB-Eire 1941 May Sun>=2 1:00s 2:00 BDST)', () => {
    expect(offsetAt(table, 'Europe/London', utc(1941, 5, 4, 0, 59, 59))).toBe(3600);
    expect(offsetAt(table, 'Europe/London', utc(1941, 5, 4, 1))).toBe(7200);
    expect(offsetAt(table, 'Europe/London', utc(1941, 8, 10, 0, 59, 59))).toBe(7200);
    expect(offsetAt(table, 'Europe/London', utc(1941, 8, 10, 1))).toBe(3600);
  });

  test('links resolve to their zone', () => {
    expect(offsetAt(table, 'Asia/Calcutta', utc(1943, 1, 1))).toBe(23400);
  });

  test('outside 1800–2099 the table refuses', () => {
    expect(() => offsetAt(table, 'Asia/Kolkata', utc(1799, 12, 31))).toThrow(/covers 1800–2099/);
    expect(() => offsetAt(table, 'Asia/Kolkata', utc(2100, 1, 1))).toThrow(/covers 1800–2099/);
  });
});

describe('a wall-clock reading in a zone', () => {
  const L = (y: number, mo: number, d: number, h: number, mi: number) => ({ year: y, month: mo, day: d, hour: h, minute: mi, second: 0 });

  test('an ordinary reading has one instant', () => {
    const r = resolveInZone(table, 'Europe/London', L(1941, 6, 15, 12, 0));
    expect(r.kind).toBe('unique');
    expect(r.readings).toEqual([{ offsetSeconds: 7200, unixSeconds: utc(1941, 6, 15, 10) }]);
  });

  test('clocks going back: the reading happened twice', () => {
    // 2020-10-25 02:00 BST → 01:00 GMT: 01:30 happened at 00:30 and 01:30 UTC.
    const r = resolveInZone(table, 'Europe/London', L(2020, 10, 25, 1, 30));
    expect(r.kind).toBe('fold');
    expect(r.readings.map((x) => x.unixSeconds)).toEqual([utc(2020, 10, 25, 0, 30), utc(2020, 10, 25, 1, 30)]);
  });

  test('clocks jumping forward: no clock showed the reading', () => {
    // 2020-03-29 01:00 GMT → 02:00 BST: 01:30 never happened.
    const r = resolveInZone(table, 'Europe/London', L(2020, 3, 29, 1, 30));
    expect(r.kind).toBe('gap');
    expect(r.readings).toEqual([
      { offsetSeconds: 0, unixSeconds: utc(2020, 3, 29, 1, 30) },
      { offsetSeconds: 3600, unixSeconds: utc(2020, 3, 29, 0, 30) },
    ]);
  });

  test('impossible readings are refused', () => {
    expect(() => resolveInZone(table, 'Europe/London', L(1999, 2, 29, 1, 0))).toThrow(/not a valid/);
    expect(() => resolveInZone(table, 'Europe/London', { ...L(2000, 1, 1, 1, 0), second: 60 })).toThrow(/not a valid/);
  });

  test('years below 100 are not mistaken for 1900s', () => {
    let days = 0;
    for (let y = 50; y < 1950; y++) days += (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
    expect(localSeconds(L(1950, 1, 1, 0, 0)) - localSeconds(L(50, 1, 1, 0, 0))).toBe(days * 86400);
  });
});
