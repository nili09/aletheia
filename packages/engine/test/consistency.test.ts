/**
 * Consistency run: 1000 charts at seeded random instants (1800–2400) and places
 * (latitude ±60°), checking invariants that must hold whatever the chart:
 *   - aṣṭakavarga: sarva totals 337 and each graha's table its fixed total, in both
 *     recensions; bindus 0–8; reductions never add and leave each triangle with a zero;
 *   - vargas: every sign valid; D9 = the nakṣatra pada counted from Meṣa;
 *   - daśās: periods tile time at every level down to five; the birth falls in the first;
 *     cara daśā covers the twelve signs once;
 *   - kārakas ranked by degrees; padas never the house or its 7th; upapada = 12th pada;
 *   - ṣaḍbala components within their ranges and adding up;
 *   - dignities: one kind each; temporal friendship symmetric;
 *   - combustion separations within 0–180°;
 *   - for 200 of them, the pañcāṅga day tiles and its boundaries are ordered.
 * Plus charts outside 1800–2400, which must compute and be labelled reduced precision.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Engine } from '../src/index.ts';
import { nakshatraPada } from '../src/zodiac.ts';
import { SEVEN, signOf } from '../src/jyotish/core.ts';
import { ashtakavarga } from '../src/jyotish/ashtakavarga.ts';
import { dashaAt, subPeriods, VIMSHOTTARI, YOGINI, type Period } from '../src/jyotish/dasha.ts';
import { temporalRelation } from '../src/jyotish/dignity.ts';
import { longitudes } from '../src/jyotish/chart.ts';
import { VARGAS } from '../src/jyotish/vargas.ts';
import type { Kundali } from '../src/jyotish/kundali.ts';
import { loadEngine } from './helpers.ts';

/** mulberry32: a small seeded generator, so the same 1000 charts come back every run. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N = 1000;
const TOTALS = [48, 49, 39, 54, 56, 52, 39];

let engine: Engine;
const charts: Kundali[] = [];
beforeAll(async () => {
  engine = await loadEngine();
  const r = rng(20261003);
  const first = 2378497.5 + 2; // 1800-01-05
  const last = 2597641.5 - 40; // 2399-12
  while (charts.length < N) {
    const jdUT = first + r() * (last - first);
    const place = { latitude: -60 + 120 * r(), longitude: -180 + 360 * r() };
    charts.push(engine.kundali({ jdUT }, place));
  }
}, 600000);

describe(`consistency over ${N} random charts`, () => {
  it('all are full precision', () => {
    expect(charts.every((k) => k.chart.precision === 'full')).toBe(true);
  });

  it('aṣṭakavarga: 337 in all; per graha 48 49 39 54 56 52 39; both tables; reductions only reduce', () => {
    for (const k of charts) {
      for (const which of ['bphs', 'bj'] as const) {
        const av = which === k.ashtakavarga.table ? k.ashtakavarga : ashtakavarga(longitudes(k.chart), k.chart.lagna, which);
        expect(av.sarva.reduce((a, b) => a + b)).toBe(337);
        SEVEN.forEach((g, i) => {
          expect(av.bhinna[g].reduce((a, b) => a + b)).toBe(TOTALS[i]);
          for (let s = 0; s < 12; s++) {
            expect(av.bhinna[g][s]).toBeGreaterThanOrEqual(0);
            expect(av.bhinna[g][s]).toBeLessThanOrEqual(8);
            expect(av.trikona[g][s]).toBeLessThanOrEqual(av.bhinna[g][s]!);
            expect(av.ekadhipatya[g][s]).toBeLessThanOrEqual(av.trikona[g][s]!);
            expect(av.ekadhipatya[g][s]).toBeGreaterThanOrEqual(0);
          }
          for (let t = 0; t < 4; t++) expect(Math.min(av.trikona[g][t]!, av.trikona[g][t + 4]!, av.trikona[g][t + 8]!)).toBe(0);
        });
      }
    }
  });

  it('vargas: valid signs; D9 = pada from Meṣa', () => {
    for (const k of charts) {
      for (const [g, v] of Object.entries(k.vargas)) {
        for (const d of VARGAS) {
          expect(Number.isInteger(v[d].sign) && v[d].sign >= 0 && v[d].sign < 12, `${g} D${d}`).toBe(true);
        }
        const lon = g === 'lagna' ? k.chart.ascendant : k.chart.grahas[g as 'sun'].longitude;
        const { nakshatra, pada } = nakshatraPada(lon);
        expect(v[9].sign).toBe((nakshatra * 4 + pada) % 12);
        expect(v[1].sign).toBe(signOf(lon));
      }
    }
  });

  it('daśās tile time at every level, and the birth lies in the first period', () => {
    const tile = (kids: Period[], p: Period) => {
      expect(kids[0]!.start).toBe(p.start);
      expect(kids[kids.length - 1]!.end).toBe(p.end);
      for (let i = 1; i < kids.length; i++) expect(kids[i]!.start).toBe(kids[i - 1]!.end);
    };
    for (const k of charts) {
      const birth = k.chart.instant.jdTT;
      for (const [sys, run] of [[VIMSHOTTARI, k.dashas.vimshottari], [YOGINI, k.dashas.yogini]] as const) {
        const ps = run.periods;
        expect(ps[0]!.start).toBeLessThanOrEqual(birth);
        expect(ps[0]!.end).toBeGreaterThan(birth);
        for (let i = 1; i < ps.length; i++) expect(ps[i]!.start).toBe(ps[i - 1]!.end);
        // Every level at the birth, down to prāṇa.
        const chain = dashaAt(sys, run, birth, 5);
        expect(chain).toHaveLength(5);
        for (let l = 0; l < 4; l++) tile(subPeriods(sys, chain[l]!), chain[l]!);
      }
      const ch = k.dashas.chara.periods;
      expect(new Set(ch.map((p) => p.sign)).size).toBe(12);
      expect(ch[0]!.sign).toBe(k.chart.lagna);
      for (const p of ch) {
        expect(p.years).toBeGreaterThanOrEqual(0);
        expect(p.years).toBeLessThanOrEqual(13);
      }
    }
  });

  it('kārakas ranked by degrees; padas never the house or its 7th; upapada = pada of the 12th', () => {
    for (const k of charts) {
      const ks = k.jaimini.karakas.karakas;
      expect(ks).toHaveLength(8);
      for (let i = 1; i < 8; i++) expect(ks[i]!.degrees).toBeLessThanOrEqual(ks[i - 1]!.degrees);
      for (const a of k.jaimini.arudhas) {
        expect(a.pada).not.toBe(a.sign);
        expect(a.pada).not.toBe((a.sign + 6) % 12);
      }
      expect(k.jaimini.upapada).toBe(k.jaimini.arudhas[11]!.pada);
      expect(k.jaimini.karakamsha).toBe(k.vargas[ks[0]!.graha][9].sign);
    }
  });

  it('ṣaḍbala: every component within its range, totals add up', () => {
    for (const k of charts) {
      for (const g of SEVEN) {
        const r = k.shadbala.rows[g];
        for (const v of [r.sthana.uccha, r.dig, r.kala.natonnata, r.kala.paksha, r.kala.ayana, r.cheshta]) {
          expect(v).toBeGreaterThanOrEqual(-1e-9);
          expect(v).toBeLessThanOrEqual(60 + 1e-9);
        }
        expect(r.sthana.saptavargaja).toBeGreaterThanOrEqual(14);
        expect(r.sthana.saptavargaja).toBeLessThanOrEqual(315);
        // Dṛk: at most 6 full aspects of Mercury and Jupiter (2 × 60) plus a quarter of the other four.
        expect(Math.abs(r.drik)).toBeLessThanOrEqual(2 * 60 + 4 * 15);
        expect(Number.isFinite(r.total)).toBe(true);
        expect(r.total).toBeCloseTo(r.sthana.total + r.dig + r.kala.total + r.cheshta + r.naisargika + r.drik, 6);
      }
    }
  });

  it('dignities: one kind per graha; temporal friendship symmetric; combustion within 0–180°', () => {
    for (const k of charts) {
      for (const g of SEVEN) {
        expect(k.dignities[g].kind).not.toBeNull();
        for (const h of SEVEN) if (g !== h) expect(temporalRelation(k.chart.grahas[g].sign, k.chart.grahas[h].sign)).toBe(temporalRelation(k.chart.grahas[h].sign, k.chart.grahas[g].sign));
      }
      for (const c of k.combustion) if (c.separation !== null) expect(c.separation >= 0 && c.separation <= 180).toBe(true);
    }
  });

  it('pañcāṅga day tiles for 200 of the charts', () => {
    for (const k of charts.slice(0, 200)) {
      const p = engine.panchang({ jdTT: k.chart.instant.jdTT }, k.chart.place);
      expect(p.sunrise.jdUT).toBeLessThanOrEqual(k.chart.instant.jdUT);
      expect(p.nextSunrise.jdUT).toBeGreaterThan(k.chart.instant.jdUT);
      for (const list of [p.tithis, p.nakshatras, p.yogas, p.karanas]) {
        for (let i = 1; i < list.length; i++) expect(list[i]!.start.jdTT).toBe(list[i - 1]!.end.jdTT);
        expect(list[0]!.start.jdTT).toBeLessThanOrEqual(p.sunrise.jdTT);
        expect(list[list.length - 1]!.end.jdTT).toBeGreaterThanOrEqual(p.nextSunrise.jdTT);
      }
      expect(p.horas).toHaveLength(24);
      expect(p.samvatsara.index).toBeGreaterThanOrEqual(0);
    }
  }, 120000);
});

describe('outside 1800–2400', () => {
  it('charts and pañcāṅgas compute with the Moshier ephemeris and are labelled reduced', () => {
    for (const unixMs of [Date.parse('1650-06-15T06:00:00Z'), Date.parse('2600-01-10T06:00:00Z')]) {
      const k = engine.kundali({ unixMs }, { latitude: 23.18, longitude: 75.78 });
      expect(k.chart.precision).toBe('reduced');
      expect(k.ashtakavarga.sarva.reduce((a, b) => a + b)).toBe(337);
      expect(engine.panchang({ unixMs }, { latitude: 23.18, longitude: 75.78 }).precision).toBe('reduced');
    }
  });
});
