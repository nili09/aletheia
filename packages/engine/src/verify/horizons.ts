/**
 * Compare the engine with NASA JPL Horizons (fixture: test/fixtures/horizons-positions.json).
 *
 * Matching the frame exactly (docs/TESTING.md, "Positions against JPL Horizons"):
 *   - same instant: Horizons' echoed epoch, a Julian day in TT, passed to swe_calc as TT;
 *   - same observer: Earth's centre (Horizons 500@399; Swiss Ephemeris geocentric default);
 *   - same corrections: apparent place with light-time, gravitational deflection and
 *     stellar (annual) aberration, no refraction (Horizons quantity 31, AIRLESS; Swiss
 *     Ephemeris default flags);
 *   - same frame: ecliptic and true equinox of date, i.e. nutation included in both.
 * The one difference we do not remove is the precession-nutation model: Horizons quantity
 * 31 uses IAU 1976/1980 (with IERS corrections since 1962), the engine IAU 2006/2000B.
 * icrfResiduals() isolates it: astrometric ICRF positions involve no precession or
 * nutation, so their residuals are the ephemeris (and barycentre) difference alone.
 *
 * Used by the Vitest suite and, live on the device, by the Truth screen.
 */
import {
  SEFLG_EQUATORIAL,
  SEFLG_ICRS,
  SEFLG_J2000,
  SEFLG_NOABERR,
  SEFLG_NOGDEFL,
  SEFLG_SPEED,
  SEFLG_SWIEPH,
} from '../swe/constants.ts';
import type { Engine } from '../engine.ts';
import { iplOf, type Graha } from '../grahas.ts';
import { wrap180 } from '../events/roots.ts';

export interface HorizonsRow {
  jdTT: string;
  raIcrfDeg: string;
  decIcrfDeg: string;
  deltaAu: string;
  deldotKmS: string;
  eclLonDeg: string;
  eclLatDeg: string;
}

export interface HorizonsFixture {
  retrieved: string;
  source: string;
  bodies: Record<string, { horizonsCode: string; ephemerisSource?: string; rows: HorizonsRow[] }>;
}

export const HORIZONS_BODIES = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const satisfies readonly Graha[];
export type HorizonsBody = (typeof HORIZONS_BODIES)[number];

/** The target: apparent geocentric ecliptic longitude within 1″ of JPL (CLAUDE.md task brief). */
export const LONGITUDE_TOLERANCE_ARCSEC = 1;

export interface Residual {
  jdTT: number;
  /** Engine minus Horizons, arcseconds. */
  longitude: number;
  latitude: number;
}

export interface BodyReport {
  body: HorizonsBody;
  horizonsSource: string;
  count: number;
  /** Largest |longitude residual| and where it occurred. */
  worst: Residual;
  maxAbsLatitude: number;
  rmsLongitude: number;
  pass: boolean;
}

export interface HorizonsReport {
  retrieved: string;
  toleranceArcsec: number;
  bodies: BodyReport[];
  pass: boolean;
  count: number;
}

export function residuals(engine: Engine, fixture: HorizonsFixture, body: HorizonsBody): Residual[] {
  const data = fixture.bodies[body];
  if (!data) throw new Error(`Horizons fixture has no ${body}`);
  return data.rows.map((r) => {
    const jdTT = Number(r.jdTT);
    const x = engine.swe.calc(jdTT, iplOf(body, 'true'), SEFLG_SWIEPH | SEFLG_SPEED).value;
    return {
      jdTT,
      longitude: wrap180(x[0] - Number(r.eclLonDeg)) * 3600,
      latitude: (x[1] - Number(r.eclLatDeg)) * 3600,
    };
  });
}

export function compareWithHorizons(engine: Engine, fixture: HorizonsFixture): HorizonsReport {
  const bodies = HORIZONS_BODIES.map((body): BodyReport => {
    const res = residuals(engine, fixture, body);
    let worst = res[0]!;
    for (const r of res) if (Math.abs(r.longitude) > Math.abs(worst.longitude)) worst = r;
    const rms = Math.sqrt(res.reduce((s, r) => s + r.longitude * r.longitude, 0) / res.length);
    return {
      body,
      horizonsSource: fixture.bodies[body]?.ephemerisSource ?? '',
      count: res.length,
      worst,
      maxAbsLatitude: Math.max(...res.map((r) => Math.abs(r.latitude))),
      rmsLongitude: rms,
      pass: Math.abs(worst.longitude) <= LONGITUDE_TOLERANCE_ARCSEC,
    };
  });
  return {
    retrieved: fixture.retrieved,
    toleranceArcsec: LONGITUDE_TOLERANCE_ARCSEC,
    bodies,
    pass: bodies.every((b) => b.pass),
    count: bodies.reduce((n, b) => n + b.count, 0),
  };
}

/**
 * Diagnostic: angular separation, arcseconds, between the engine's and Horizons'
 * astrometric ICRF RA/Dec (light-time only; no aberration, deflection, precession or
 * nutation). This is the ephemeris difference with every frame model removed.
 */
export function icrfResiduals(engine: Engine, fixture: HorizonsFixture, body: HorizonsBody): number[] {
  const data = fixture.bodies[body];
  if (!data) throw new Error(`Horizons fixture has no ${body}`);
  const flags = SEFLG_SWIEPH | SEFLG_J2000 | SEFLG_ICRS | SEFLG_EQUATORIAL | SEFLG_NOABERR | SEFLG_NOGDEFL;
  const rad = Math.PI / 180;
  return data.rows.map((r) => {
    const x = engine.swe.calc(Number(r.jdTT), iplOf(body, 'true'), flags).value;
    const ra = Number(r.raIcrfDeg) * rad;
    const dec = Number(r.decIcrfDeg) * rad;
    const ra2 = x[0] * rad;
    const dec2 = x[1] * rad;
    // Haversine: well conditioned for tiny separations.
    const h = Math.sin((dec2 - dec) / 2) ** 2 + Math.cos(dec) * Math.cos(dec2) * Math.sin((ra2 - ra) / 2) ** 2;
    return (2 * Math.asin(Math.sqrt(h))) / rad * 3600;
  });
}
