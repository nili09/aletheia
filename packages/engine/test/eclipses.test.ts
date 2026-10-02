/**
 * Eclipses against NASA's Five Millennium Canon (Espenak & Meeus): 20 eclipses 1950–2050,
 * 10 solar and 10 lunar, every type (fixture nasa-eclipses.json).
 *
 * Compared: the instant of greatest eclipse in Terrestrial Time. NASA lists it in TD
 * (= TT). The library returns UT; we convert with its own delta T, which is the inverse of
 * the conversion it used, so delta T cancels and does not enter the comparison.
 *
 * The task sets no target for eclipses, only "report the residuals". The assertions are
 * the eclipse type, and a 60 s bound that guards against gross errors (a wrong eclipse);
 * it is not a precision target. The residuals are written to test/reports/eclipses.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Engine, LunarEclipse, SolarEclipse } from '../src/index.ts';
import { fixture, loadEngine } from './helpers.ts';

interface NasaEclipse {
  catalogNumber: string;
  date: string;
  greatestTD: string;
  type: string;
  gamma: number;
}
const nasa = fixture<{ eclipses: { solar: NasaEclipse[]; lunar: NasaEclipse[] } }>('nasa-eclipses.json');

const SOLAR_TYPES: Record<string, SolarEclipse['type']> = { T: 'total', A: 'annular', H: 'hybrid', P: 'partial' };
const LUNAR_TYPES: Record<string, LunarEclipse['type']> = { T: 'total', P: 'partial', N: 'penumbral' };
const GROSS_ERROR_SECONDS = 60;

let engine: Engine;
beforeAll(async () => {
  engine = await loadEngine();
});

function nasaJdTT(e: NasaEclipse): number {
  const [y, m, d] = e.date.split('-').map(Number) as [number, number, number];
  const [hh, mm, ss] = e.greatestTD.split(':').map(Number) as [number, number, number];
  return engine.swe.julday(y, m, d, hh + mm / 60 + ss / 3600);
}

interface Row {
  kind: 'solar' | 'lunar';
  date: string;
  nasaType: string;
  ourType: string;
  nasaTD: string;
  residualSeconds: number;
}
const rows: Row[] = [];

describe('greatest eclipse against NASA, in TT', () => {
  it('solar: 10 eclipses, every type', () => {
    for (const e of nasa.eclipses.solar) {
      const ref = nasaJdTT(e);
      const ours = engine.solarEclipse({ jdTT: ref - 5 });
      const residual = (ours.greatest.jdTT - ref) * 86400;
      rows.push({ kind: 'solar', date: e.date, nasaType: e.type, ourType: ours.type, nasaTD: e.greatestTD, residualSeconds: residual });
      expect(ours.type, e.date).toBe(SOLAR_TYPES[e.type[0]!]);
      expect(Math.abs(residual), e.date).toBeLessThan(GROSS_ERROR_SECONDS);
    }
  });

  it('lunar: 10 eclipses, every type', () => {
    for (const e of nasa.eclipses.lunar) {
      const ref = nasaJdTT(e);
      const ours = engine.lunarEclipse({ jdTT: ref - 5 });
      const residual = (ours.greatest.jdTT - ref) * 86400;
      rows.push({ kind: 'lunar', date: e.date, nasaType: e.type, ourType: ours.type, nasaTD: e.greatestTD, residualSeconds: residual });
      expect(ours.type, e.date).toBe(LUNAR_TYPES[e.type[0]!]);
      expect(Math.abs(residual), e.date).toBeLessThan(GROSS_ERROR_SECONDS);
    }
  });

  it('reports the residuals', () => {
    expect(rows).toHaveLength(20);
    console.table(rows.map((r) => ({ ...r, residualSeconds: r.residualSeconds.toFixed(2) })));
    const worst = (k: string) => Math.max(...rows.filter((r) => r.kind === k).map((r) => Math.abs(r.residualSeconds)));
    mkdirSync(new URL('./reports/', import.meta.url), { recursive: true });
    writeFileSync(
      new URL('./reports/eclipses.json', import.meta.url),
      `${JSON.stringify({ generated: 'npm test -w @aletheia/engine', worstSolarSeconds: worst('solar'), worstLunarSeconds: worst('lunar'), rows }, null, 2)}\n`,
    );
  });
});

describe('eclipse details', () => {
  it('contacts are in order for a total solar eclipse (2027-08-02)', () => {
    const e = engine.solarEclipse({ unixMs: Date.parse('2027-07-25T00:00:00Z') });
    expect(e.type).toBe('total');
    const c = e.contacts;
    const order = [c.partialBegin, c.umbralBegin, c.centralBegin, e.greatest, c.centralEnd, c.umbralEnd, c.partialEnd].map((i) => i!.jdUT);
    for (let i = 1; i < order.length; i++) expect(order[i]!).toBeGreaterThan(order[i - 1]!);
    expect(e.central).toBe(true);
    expect(e.magnitude).toBeGreaterThan(1);
  });

  it('contacts are in order for a total lunar eclipse (2025-09-07)', () => {
    const e = engine.lunarEclipse({ unixMs: Date.parse('2025-09-01T00:00:00Z') });
    expect(e.type).toBe('total');
    const c = e.contacts;
    const order = [c.penumbralBegin, c.partialBegin, c.totalityBegin, e.greatest, c.totalityEnd, c.partialEnd, c.penumbralEnd].map((i) => i!.jdUT);
    for (let i = 1; i < order.length; i++) expect(order[i]!).toBeGreaterThan(order[i - 1]!);
    expect(e.umbralMagnitude).toBeGreaterThan(1);
  });

  it('a penumbral eclipse has no umbral contacts', () => {
    const e = engine.lunarEclipse({ jdTT: nasaJdTT(nasa.eclipses.lunar.find((x) => x.type.startsWith('N'))!) - 5 });
    expect(e.type).toBe('penumbral');
    expect(e.contacts.partialBegin).toBeNull();
    expect(e.contacts.totalityBegin).toBeNull();
  });
});
