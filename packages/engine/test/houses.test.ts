/**
 * Ascendant and houses.
 *
 * Outside reference: JPL Horizons local apparent sidereal time (LAST), 4 sites × 6 instants
 * in 1962–2020 (fixture: horizons-sidereal.json). LAST × 15 is the ARMC, the one
 * Earth-rotation input to the ascendant. Tolerance 0.05 s of time (0.75″ of ARMC), set
 * before measuring: the two systems use different models of Earth rotation (Horizons: IERS
 * UT1 data; the engine: the library's delta T table), whose difference over 1962–2020 is
 * a few hundredths of a second.
 *
 * Then the ascendant must follow from ARMC, latitude and true obliquity by the textbook
 * formula (Meeus, Astronomical Algorithms, 2nd ed., ch. 14 / spherical astronomy):
 *   tan λ_asc = −cos θ / (sin ε tan φ + cos ε sin θ), θ = ARMC, taken in the eastern half.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { HOUSE_SYSTEMS, wrap180, type Engine } from '../src/index.ts';
import { SE_ECL_NUT, SEFLG_SWIEPH } from '../src/swe/constants.ts';
import { ARCSEC, fixture, loadEngine } from './helpers.ts';

interface SiderealFixture {
  sites: Array<{ site: { name: string; lat: number; lon: number }; rows: Array<{ jdTT: string; lastHours: string }> }>;
}
const lst = fixture<SiderealFixture>('horizons-sidereal.json');

let engine: Engine;
beforeAll(async () => {
  engine = await loadEngine();
});

const rad = Math.PI / 180;

function ascendantFromArmc(armc: number, lat: number, eps: number): number {
  const t = armc * rad;
  const y = -Math.cos(t);
  const x = Math.sin(eps * rad) * Math.tan(lat * rad) + Math.cos(eps * rad) * Math.sin(t);
  let asc = Math.atan2(y, x) / rad;
  asc = ((asc % 360) + 360) % 360;
  // atan2 gives the descendant or the ascendant; the ascendant rises in the east, i.e. it
  // lies within 180° ahead of the MC in longitude.
  const mc = ((Math.atan2(Math.sin(t), Math.cos(t) * Math.cos(eps * rad)) / rad) % 360 + 360) % 360;
  if (wrap180(asc - mc) < 0) asc = (asc + 180) % 360;
  return asc;
}

describe('sidereal time against JPL Horizons', () => {
  it('ARMC / 15 equals Horizons LAST within 0.05 s of time, at 24 site-instants 1962–2020', () => {
    let worst = 0;
    for (const { site, rows } of lst.sites) {
      for (const r of rows) {
        const h = engine.houses({ jdTT: Number(r.jdTT) }, { latitude: site.lat, longitude: site.lon });
        const ours = h.armc / 15;
        const diffSeconds = wrap180((ours - Number(r.lastHours)) * 15) / 15 * 3600;
        worst = Math.max(worst, Math.abs(diffSeconds));
        expect(Math.abs(diffSeconds), `${site.name} ${r.jdTT}`).toBeLessThan(0.05);
      }
    }
    console.log(`worst LAST residual against Horizons: ${worst.toFixed(4)} s of time (${(worst * 15).toFixed(3)}″ of ARMC)`);
  });
});

describe('ascendant', () => {
  it('follows from ARMC, latitude and true obliquity by the textbook formula (to 1e-6″)', () => {
    for (const { site, rows } of lst.sites) {
      for (const r of rows) {
        const jdTT = Number(r.jdTT);
        const h = engine.houses({ jdTT }, { latitude: site.lat, longitude: site.lon });
        const eps = engine.swe.calc(jdTT, SE_ECL_NUT, SEFLG_SWIEPH).value[0]; // true obliquity
        const asc = ascendantFromArmc(h.armc, site.lat, eps);
        expect(Math.abs(wrap180(h.ascendant.tropical - asc)) / ARCSEC, `${site.name} ${r.jdTT}`).toBeLessThan(1e-6);
      }
    }
  });

  it('sidereal ascendant = tropical ascendant − ayanamsa', () => {
    const t = { jdTT: 2461315.75 };
    const h = engine.houses(t, { latitude: 23.1765, longitude: 75.7885 });
    const aya = engine.ayanamsa(t, 1).value;
    expect(Math.abs(wrap180(h.ascendant.tropical - aya - h.ascendant.sidereal)) / ARCSEC).toBeLessThan(1e-6);
  });
});

describe('house systems', () => {
  it('whole-sign cusps are the starts of the signs, in each zodiac, from the ascendant\'s sign', () => {
    const h = engine.houses({ jdTT: 2461315.75 }, { latitude: 23.1765, longitude: 75.7885 }, { ayanamsa: 1, houseSystem: 'W' });
    for (const z of ['tropical', 'sidereal'] as const) {
      const first = Math.floor(h.ascendant[z] / 30) * 30;
      expect(h.cusps[z]).toEqual(Array.from({ length: 12 }, (_, i) => (first + 30 * i) % 360));
    }
    expect(h.systemName).toMatch(/whole/i);
  });

  it('every system gives finite cusps at Ujjain', () => {
    for (const s of HOUSE_SYSTEMS) {
      const h = engine.houses({ jdTT: 2461315.75 }, { latitude: 23.1765, longitude: 75.7885 }, { ayanamsa: 1, houseSystem: s });
      expect(h.cusps.tropical.length, s).toBe(s === 'G' ? 36 : 12);
      for (const c of [...h.cusps.tropical, ...h.cusps.sidereal]) expect(Number.isFinite(c), s).toBe(true);
    }
  });

  it('refuses Placidus inside the polar circle instead of silently returning Porphyry', () => {
    expect(() => engine.houses({ jdTT: 2461315.75 }, { latitude: 70, longitude: 20 }, { ayanamsa: 1, houseSystem: 'P' })).toThrow(/swe_houses_ex2/);
  });
});
