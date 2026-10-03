import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';
import { Engine, PLANET_FILES, type Hold } from '@aletheia/engine';
import { resolveBirthTime, type LocalTime, type ZoneTable } from '@aletheia/birth';
import { apart, compareText, holdText, sensitivityLine, span } from './format.ts';
import { exportFile, parseExport, type SavedChart } from './store.ts';

const hold = (earlier: number | null, later: number | null): Hold => ({
  quantity: 'lagna',
  value: 4,
  partDegrees: 30,
  earlier: earlier === null ? null : { seconds: earlier, value: 3 },
  later: later === null ? null : { seconds: later, value: 5 },
});

describe('durations, truncated', () => {
  test('span', () => {
    expect(span(59.9)).toBe('59 s');
    expect(span(-1379)).toBe('22 min');
    expect(span(3600 * 5 + 12 * 60 + 59)).toBe('5 h 12 min');
    expect(span(7200)).toBe('2 h');
  });

  test('holdText reads like the brief: "−22 / +47 min", "±1 min"', () => {
    expect(holdText(hold(-22 * 60 - 50, 47 * 60 + 5))).toBe('−22 / +47 min');
    expect(holdText(hold(-70, 119))).toBe('±1 min');
    expect(holdText(hold(-40, 200))).toBe('−40 s / +3 min');
    expect(holdText(hold(-3 * 3600, 600))).toBe('−3 h / +10 min');
    expect(holdText(hold(null, 600))).toBe('— / +10 min');
  });

  test('apart is exact', () => {
    expect(apart(39 * 60)).toBe('39 minutes');
    expect(apart(23 * 60 + 20)).toBe('23 min 20 s');
    expect(apart(3600)).toBe('1 hour');
    expect(apart(-(3600 + 39 * 60))).toBe('1 h 39 min');
  });
});

describe('the five checkpoint births, with the engine', () => {
  let engine: Engine;
  const table = JSON.parse(readFileSync(new URL('../../../../packages/birth/data/zones.json', import.meta.url), 'utf8')) as ZoneTable;
  beforeAll(async () => {
    engine = await Engine.create();
    for (const f of PLANET_FILES) engine.addFile(f, new Uint8Array(readFileSync(new URL(`../../../../packages/engine/ephe/${f}`, import.meta.url))));
  });

  const MUMBAI = { latitude: 19.07283, longitude: 72.88261, zone: 'Asia/Kolkata', admin1: '16', admin2: '' };
  const KOLKATA = { latitude: 22.56263, longitude: 88.36304, zone: 'Asia/Kolkata', admin1: '28', admin2: '342' };
  const L = (y: number, mo: number, d: number, h: number, mi: number): LocalTime => ({ year: y, month: mo, day: d, hour: h, minute: mi, second: 0 });
  const BIRTHS: Array<[string, LocalTime, typeof MUMBAI]> = [
    ['Mumbai', L(1934, 5, 12, 10, 15), MUMBAI],
    ['Mumbai', L(1943, 8, 20, 6, 40), MUMBAI],
    ['Kolkata', L(1938, 11, 3, 21, 30), KOLKATA],
    ['Kolkata', L(1942, 3, 10, 4, 50), KOLKATA],
    ['Kolkata', L(1948, 2, 14, 13, 5), KOLKATA],
  ];

  test('each reading is compared with the first: minutes apart, and what moves', () => {
    const report: string[] = [];
    for (const [name, local, place] of BIRTHS) {
      const r = resolveBirthTime(table, local, place);
      expect(r.ambiguous).toBe(true);
      const points = r.options.map((o) => ({ ...engine.birthPoint({ unixMs: o.unixMs }, place), unixMs: o.unixMs, o }));
      const lines = points.slice(1).map((p) => `${p.o.name}: ${compareText(points[0]!, p)}`);
      report.push(`${name} ${local.year}-${local.month}-${local.day} ${local.hour}:${local.minute} — ${points[0]!.o.name} first; ${lines.join(' | ')}`);
      for (const line of lines) expect(line).toMatch(/apart; /);
    }
    console.log(report.join('\n'));
    // Mumbai 1934: 39 minutes between IST and Bombay Time.
    expect(report[0]).toContain('Bombay Time: 39 minutes apart');
    expect(report[2]).toContain('Indian Standard Time: 23 min 20 s apart');
  });

  test('a saved chart’s sensitivity line', () => {
    const s = engine.sensitivity({ unixMs: Date.UTC(1934, 4, 12, 4, 45) }, MUMBAI);
    const line = sensitivityLine(s);
    expect(line).toMatch(/^Lagna holds −\S+.* · Navāṃśa lagna .* · D60 .* · Moon’s nakṣatra .*/);
    console.log(line);
  });
});

describe('export and import', () => {
  const chart: SavedChart = {
    id: 'a1',
    label: 'Test',
    quality: 'family',
    local: { year: 1934, month: 5, day: 12, hour: 10, minute: 15, second: 0 },
    place: { name: 'Mumbai', region: 'Maharashtra', latitude: 19.07283, longitude: 72.88261, zone: 'Asia/Kolkata', admin1: '16', admin2: '', source: 'geonames', geonameId: 1275339 },
    clock: { id: 'ist', name: 'Indian Standard Time', offsetSeconds: 19800 },
    unixMs: Date.UTC(1934, 4, 12, 4, 45),
    tzdb: '2026e',
    created: '2026-10-03T00:00:00.000Z',
    updated: '2026-10-03T00:00:00.000Z',
  };

  test('round trip', () => {
    const f = exportFile([chart], new Date('2026-10-03T12:00:00Z'));
    expect(f.name).toBe('aletheia-charts-2026-10-03.json');
    expect(parseExport(f.text)).toEqual([chart]);
  });

  test('anything else is refused', () => {
    expect(() => parseExport('{"format":"other"}')).toThrow(/not an Aletheia charts file/);
    const bad = exportFile([{ ...chart, place: { ...chart.place, latitude: 95 } }]).text;
    expect(() => parseExport(bad)).toThrow(/chart 1/);
  });
});
