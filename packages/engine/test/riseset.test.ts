/**
 * Sunrise, sunset, moonrise and moonset.
 *
 * Outside reference: US Naval Observatory (fixture usno-riseset.json): 8 places from the
 * equator to 60° N and 34° S, 3 dates each, 1950–2050, times in UT to the minute. USNO's
 * convention is our default one (upper limb, standard refraction). Tolerance 60 s, set
 * before measuring: USNO rounds to the minute (±30 s) and uses a fixed 34′ refraction where
 * the engine uses 34.6′ (Sinclair at 1013.25 hPa, 10 °C), worth a few seconds at these
 * latitudes.
 *
 * The Hindu convention (disc centre, no refraction) has no published outside reference
 * we can fetch; it is checked by its definition: at the instant found, the geometric
 * altitude of the centre of the geocentric disc is 0.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Engine } from '../src/index.ts';
import { SE_MOON, SE_SUN, SEFLG_SWIEPH } from '../src/swe/constants.ts';
import { fixture, loadEngine } from './helpers.ts';

interface UsnoCase {
  place: { name: string; lat: number; lon: number };
  date: string;
  sun: { rise: string | null; set: string | null };
  moon: { rise: string | null; set: string | null };
}
const usno = fixture<{ cases: UsnoCase[] }>('usno-riseset.json');

let engine: Engine;
beforeAll(async () => {
  engine = await loadEngine();
});

function usnoUnixMs(date: string, hhmm: string): number {
  return Date.parse(`${date}T${hhmm}:00Z`);
}

describe('rise and set against USNO (upper limb, standard refraction)', () => {
  it('agree within 60 s for the Sun and the Moon at 24 place-days', () => {
    let worst = { s: 0, what: '' };
    let n = 0;
    for (const c of usno.cases) {
      const place = { latitude: c.place.lat, longitude: c.place.lon, altitude: 0 };
      for (const body of ['sun', 'moon'] as const) {
        for (const ev of ['rise', 'set'] as const) {
          const hhmm = c[body][ev];
          if (!hhmm) continue;
          const ref = usnoUnixMs(c.date, hhmm);
          // Search from 30 minutes before USNO's time: the next event must be USNO's.
          const found = engine.riseSet({ unixMs: ref - 30 * 60000 }, body, place, 'upper-limb')[ev];
          expect(found, `${c.place.name} ${c.date} ${body} ${ev}`).not.toBeNull();
          const diff = (engine.unixMs(found!) - ref) / 1000;
          n++;
          if (Math.abs(diff) > Math.abs(worst.s)) worst = { s: diff, what: `${c.place.name} ${c.date} ${body}${ev}` };
          expect(Math.abs(diff), `${c.place.name} ${c.date} ${body} ${ev}`).toBeLessThanOrEqual(60);
        }
      }
    }
    console.log(`${n} rise/set times; worst ${worst.s.toFixed(1)} s (${worst.what})`);
    expect(n).toBeGreaterThanOrEqual(90);
  });
});

describe('Hindu convention (centre of the disc, no refraction)', () => {
  /** True altitude of the geocentric centre, ecliptic latitude ignored (the Hindu rule). */
  function altitude(jdUT: number, ipl: number, lat: number, lon: number): number {
    const t = engine.instant({ jdUT });
    const ecl = engine.swe.calc(t.jdTT, ipl, SEFLG_SWIEPH).value;
    return engine.swe.azalt(t.jdUT, lon, lat, 0, 0, 0, ecl[0], 0)[1];
  }

  it('the centre is on the geometric horizon at the instant found, to within 1 s of time', () => {
    // The library's rise search takes a fixed number of Newton steps (swecl.c,
    // rise_set_fast), so its result is good to a fraction of a second, not to the
    // millisecond. Altitude residual / altitude rate converts it to time.
    let worst = 0;
    for (const c of usno.cases) {
      const place = { latitude: c.place.lat, longitude: c.place.lon };
      for (const [body, ipl] of [['sun', SE_SUN], ['moon', SE_MOON]] as const) {
        const rs = engine.riseSet({ unixMs: Date.parse(`${c.date}T00:00:00Z`) }, body, place, 'hindu');
        for (const t of [rs.rise, rs.set]) {
          if (!t) continue;
          const h = 1 / 86400;
          const alt = altitude(t.jdUT, ipl, place.latitude, place.longitude);
          const rate = (altitude(t.jdUT + h, ipl, place.latitude, place.longitude) - altitude(t.jdUT - h, ipl, place.latitude, place.longitude)) / 2;
          const seconds = Math.abs(alt / rate);
          worst = Math.max(worst, seconds);
          expect(seconds, `${c.place.name} ${c.date} ${body}`).toBeLessThan(1);
        }
      }
    }
    console.log(`Hindu rise/set: worst distance from the exact horizon crossing ${worst.toFixed(3)} s`);
  });

  it('Hindu sunrise comes 1–15 minutes after upper-limb sunrise (no refraction, centre not limb)', () => {
    for (const c of usno.cases) {
      const place = { latitude: c.place.lat, longitude: c.place.lon };
      const a = engine.riseSet({ unixMs: Date.parse(`${c.date}T00:00:00Z`) }, 'sun', place, 'upper-limb').rise!;
      // Search from just before the upper-limb rise, so both are the same morning.
      const b = engine.riseSet({ jdUT: a.jdUT - 600 / 86400 }, 'sun', place, 'hindu').rise!;
      const d = (b.jdUT - a.jdUT) * 86400;
      expect(d, `${c.place.name} ${c.date}`).toBeGreaterThan(60);
      expect(d).toBeLessThan(15 * 60);
    }
  });
});

describe('polar day and night', () => {
  it('returns null, not a wrong time, when the Sun does not rise', () => {
    const rs = engine.riseSet({ unixMs: Date.parse('2026-12-21T00:00:00Z') }, 'sun', { latitude: 78.22, longitude: 15.65 }, 'upper-limb');
    expect(rs.rise).toBeNull();
    expect(rs.set).toBeNull();
  });
});
