/**
 * Ayanamsa: every Swiss Ephemeris mode, and Lahiri against its definition.
 *
 * Outside reference: the Lahiri ayanamsa as defined by the Indian Calendar Reform Committee
 * and revised in the Indian Astronomical Ephemeris 1989, p. 556 (footnote):
 * 23°15′00.658″ on 21 March 1956, 0h TT (then "Ephemeris Time"). Swiss Ephemeris documents
 * (swisseph.htm, appendix "How to compare the Swiss Ephemeris Lahiri Ayanamsha with IAE")
 * that IAE's published values are reproduced when this is taken as the true ayanamsa
 * (with nutation), under IAU 1976 precession and IAU 1980 (Wahr) nutation.
 *
 * Two documented library behaviours separate the engine's number from that value:
 *  1. The library stores the mean value, 23°15′00.658″ minus the IAU 1980 nutation at
 *     the epoch, and adds back its own (IAU 2000B) nutation. The two nutation models differ
 *     by 0.008″ at the epoch.
 *  2. Because Lahiri was defined under IAU 1976 precession and the engine uses IAU 2006,
 *     the library adds a constant correction so that sidereal positions stay where the
 *     original definition puts them (sweph.c, get_aya_correction). It is 0.13″.
 * Both are checked below, separately, so the definition itself is checked exactly.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { AYANAMSA_MODES, Engine } from '../src/index.ts';
import { SE_ECL_NUT, SEFLG_SWIEPH } from '../src/swe/constants.ts';
import { ARCSEC, loadEngine } from './helpers.ts';

const T0 = 2435553.5; // 1956-03-21 0h TT
const LAHIRI_T0 = 23 + 15 / 60 + 0.658 / 3600; // IAE 1989 p. 556: 23°15′00.658″
const IAU1980_NUTATION_T0 = 0.004658035; // degrees, the value the library subtracts (sweph.h)
const SE_SIDBIT_NO_PREC_OFFSET = 4096;

let engine: Engine;
beforeAll(async () => {
  engine = await loadEngine();
});

function trueAyanamsa(mode: number, jdTT: number): number {
  engine.swe.setSidMode(mode);
  return engine.swe.ayanamsa(jdTT, SEFLG_SWIEPH).value;
}

describe('Lahiri against its definition', () => {
  it('without the precession-model correction, equals 23°15′00.658″ − IAU 1980 nutation + our nutation, exactly', () => {
    const dpsi = engine.swe.calc(T0, SE_ECL_NUT, SEFLG_SWIEPH).value[2]; // IAU 2000B nutation in longitude
    const a = trueAyanamsa(1 | SE_SIDBIT_NO_PREC_OFFSET, T0);
    expect(Math.abs(a - (LAHIRI_T0 - IAU1980_NUTATION_T0 + dpsi)) / ARCSEC).toBeLessThan(1e-6);
  });

  it('and the two nutation models agree to 0.01″ at the epoch, so that is 23°15′00.658″ to 0.01″', () => {
    const dpsi = engine.swe.calc(T0, SE_ECL_NUT, SEFLG_SWIEPH).value[2];
    expect(Math.abs(dpsi - IAU1980_NUTATION_T0) / ARCSEC).toBeLessThan(0.01);
    expect(Math.abs(trueAyanamsa(1 | SE_SIDBIT_NO_PREC_OFFSET, T0) - LAHIRI_T0) / ARCSEC).toBeLessThan(0.01);
  });

  it('the precession-model correction is a constant 0.13″ (same in 1900, 1956, 2026 and 2100)', () => {
    const corr = [2415020.5, T0, 2461315.5, 2488069.5].map((t) => (trueAyanamsa(1, t) - trueAyanamsa(1 | SE_SIDBIT_NO_PREC_OFFSET, t)) / ARCSEC);
    for (const c of corr) expect(Math.abs(c - corr[0]!)).toBeLessThan(1e-6);
    expect(corr[0]!).toBeGreaterThan(0.12);
    expect(corr[0]!).toBeLessThan(0.14);
  });

  it('true and mean differ by the nutation in longitude (under 18″)', () => {
    const a = engine.ayanamsa({ jdTT: 2461315.5 }, 1);
    expect(a.name).toMatch(/Lahiri/);
    expect(Math.abs(a.value - a.mean) / ARCSEC).toBeGreaterThan(0);
    expect(Math.abs(a.value - a.mean) / ARCSEC).toBeLessThan(18);
  });

  it('grows by about 50.3″ a year (general precession)', () => {
    const a = engine.ayanamsa({ jdTT: 2451545 }, 1).mean;
    const b = engine.ayanamsa({ jdTT: 2451545 + 36525 }, 1).mean;
    const perYear = ((b - a) / 100) * 3600;
    expect(perYear).toBeGreaterThan(50.2);
    expect(perYear).toBeLessThan(50.4);
  });
});

describe('every mode', () => {
  it('gives a named, finite ayanamsa for each of the 47 predefined modes', () => {
    expect(AYANAMSA_MODES).toHaveLength(47);
    for (const mode of AYANAMSA_MODES) {
      const a = engine.ayanamsa({ jdTT: 2461315.5 }, mode);
      expect(a.name.length, `mode ${mode}`).toBeGreaterThan(0);
      expect(Number.isFinite(a.value)).toBe(true);
      expect(a.precision).toBe('full');
    }
  });

  it('needs no star catalogue for any mode: the library has the reference stars built in', async () => {
    const noStars = await loadEngine(['sepl_18.se1', 'semo_18.se1']);
    for (const mode of AYANAMSA_MODES) {
      expect(noStars.ayanamsa({ jdTT: 2461315.5 }, mode).value, `mode ${mode}`).toBe(engine.ayanamsa({ jdTT: 2461315.5 }, mode).value);
    }
  });

  it('places Spica at 180° in the True Citra mode (27), to the milliarcsecond', () => {
    const s = engine.fixedStar({ jdTT: 2461315.5 }, 'Spica', 27);
    expect(Math.abs(s.sidereal.longitude - 180) / ARCSEC).toBeLessThan(0.001);
  });
});
