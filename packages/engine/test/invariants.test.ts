/**
 * Invariants that must hold at every instant, checked at many instants inside and outside
 * the full-precision range:
 *   - Ketu is exactly opposite Rahu (true and mean nodes);
 *   - sidereal longitude = tropical longitude − ayanamsa, for every graha and every mode;
 *   - tithis advance monotonically (by exactly one) between consecutive new moons.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { AYANAMSA_MODES, ECLIPTIC_T0_AYANAMSAS, GRAHAS, wrap180, type Engine } from '../src/index.ts';
import { loadEngine } from './helpers.ts';

let engine: Engine;
beforeAll(async () => {
  engine = await loadEngine();
});

/** 40 instants spread over 1800–2400 plus a few outside the files. */
const INSIDE = Array.from({ length: 40 }, (_, i) => 2378497.5 + 0.37 + i * 5476.93);
const OUTSIDE = [1721423.5, 2341972.5, 2634167.5];

/**
 * Ketu's longitude is Rahu's + 180°, reduced to [0, 360): a single rounding. Recovering 180
 * by subtracting the two rounded longitudes can be off by an ulp of 360 (5.7e-14° =
 * 2e-10″), so "exactly opposite" is checked to two ulps of 360.
 */
const ULP360 = 2 ** -44;

describe('Ketu is exactly opposite Rahu', () => {
  for (const node of ['true', 'mean'] as const) {
    it(`${node} nodes`, () => {
      for (const jdTT of [...INSIDE, ...OUTSIDE]) {
        const ps = engine.positions({ jdTT }, { ayanamsa: 1, node });
        const rahu = ps.find((p) => p.graha === 'rahu')!;
        const ketu = ps.find((p) => p.graha === 'ketu')!;
        for (const frame of ['tropical', 'sidereal'] as const) {
          expect(Math.abs(Math.abs(wrap180(ketu[frame].longitude - rahu[frame].longitude)) - 180)).toBeLessThanOrEqual(2 * ULP360);
          expect(ketu[frame].latitude).toBe(-rahu[frame].latitude);
          expect(ketu[frame].longitudeSpeed).toBe(rahu[frame].longitudeSpeed);
        }
        expect(ketu.retrograde).toBe(rahu.retrograde);
      }
    });
  }
});

describe('sidereal = tropical − ayanamsa', () => {
  // The library computes sidereal positions itself (SEFLG_SIDEREAL); we check its result
  // against tropical minus the true ayanamsa from swe_get_ayanamsa_ex. Tolerance 1e-9° =
  // 3.6 µas: floating-point noise, far below anything displayed.
  const TOL = 1e-9;

  it('for every graha, Lahiri, inside and outside the files', () => {
    for (const jdTT of [...INSIDE, ...OUTSIDE]) {
      const aya = engine.ayanamsa({ jdTT }, 1).value;
      for (const p of engine.positions({ jdTT }, { ayanamsa: 1, node: 'true' })) {
        const d = wrap180(p.tropical.longitude - aya - p.sidereal.longitude);
        expect(Math.abs(d), `${p.graha} at ${jdTT}`).toBeLessThan(TOL);
      }
    }
  });

  it('for every graha and every ayanamsa mode except the four ecliptic-of-epoch modes', () => {
    const jdTT = 2461315.5;
    for (const mode of AYANAMSA_MODES) {
      if (ECLIPTIC_T0_AYANAMSAS.has(mode)) continue;
      const aya = engine.ayanamsa({ jdTT }, mode).value;
      for (const p of engine.positions({ jdTT }, { ayanamsa: mode, node: 'mean' })) {
        const d = wrap180(p.tropical.longitude - aya - p.sidereal.longitude);
        expect(Math.abs(d), `mode ${mode} ${p.graha}`).toBeLessThan(TOL);
      }
    }
  });

  it('does not hold, by the library\'s definition, for exactly those four modes', () => {
    // J2000, J1900, B1950 and Skydram project onto the ecliptic of their epoch, so the
    // difference is a few arcseconds, not rounding. This guards the exception list.
    const jdTT = 2461315.5;
    const failing = AYANAMSA_MODES.filter((mode) => {
      const aya = engine.ayanamsa({ jdTT }, mode).value;
      return engine.positions({ jdTT }, { ayanamsa: mode, node: 'mean' }).some((p) => Math.abs(wrap180(p.tropical.longitude - aya - p.sidereal.longitude)) > TOL);
    });
    expect(new Set(failing)).toEqual(ECLIPTIC_T0_AYANAMSAS);
  });

  it('covers all nine grahas', () => {
    expect(engine.positions({ jdTT: 2451545 }).map((p) => p.graha)).toEqual(GRAHAS);
  });
});

describe('tithis between new moons', () => {
  it('advance 1, 2, …, 30 between consecutive new moons, for two years', () => {
    const start = 2460676.5; // 2025-01-01
    const events = engine.events({ start: { jdTT: start }, end: { jdTT: start + 730 }, kinds: ['tithi', 'new-moon'] });
    const newMoons = events.filter((e) => e.kind === 'new-moon').map((e) => e.instant.jdTT);
    expect(newMoons.length).toBeGreaterThanOrEqual(24);
    const tithis = events.filter((e) => e.kind === 'tithi');
    for (let i = 0; i + 1 < newMoons.length; i++) {
      const between = tithis.filter((e) => e.instant.jdTT >= newMoons[i]! && e.instant.jdTT < newMoons[i + 1]!);
      expect(between.map((e) => (e.kind === 'tithi' ? e.tithi : 0))).toEqual(Array.from({ length: 30 }, (_, k) => k + 1));
      for (let k = 1; k < between.length; k++) expect(between[k]!.instant.jdTT).toBeGreaterThan(between[k - 1]!.instant.jdTT);
    }
  });

  it('and the elongation increases between them, sampled hourly', () => {
    let prev = Number.NaN;
    for (let t = 2460676.5; t < 2460676.5 + 60; t += 1 / 24) {
      const [sun, moon] = engine.positions({ jdTT: t }).slice(0, 2);
      const e = (moon!.sidereal.longitude - sun!.sidereal.longitude + 360) % 360;
      if (!Number.isNaN(prev) && prev < 350) expect(e).toBeGreaterThan(prev);
      prev = e;
    }
  });
});
