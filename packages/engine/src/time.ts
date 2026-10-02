/**
 * Instants on two time scales.
 *
 * - TT (Terrestrial Time) is the uniform scale of the ephemeris: positions are computed in TT.
 * - UT (UT1) follows Earth's rotation: sidereal time, houses, rising and setting use UT.
 * - Delta T = TT - UT comes from the Swiss Ephemeris (measured values in the past, its
 *   extrapolation in the future). Civil time (UTC) maps to UT1 via swe_utc_to_jd, which
 *   applies leap seconds since 1972.
 *
 * An Instant carries both Julian days so every computation states which scale it used.
 */
import type { Ephemeris, SwissEph } from './swe/swisseph.ts';
import { precisionForJdTT, type Precision } from './precision.ts';

export interface Instant {
  /** Julian day, Terrestrial Time. */
  jdTT: number;
  /** Julian day, Universal Time (UT1). */
  jdUT: number;
  /** TT - UT1 in seconds at this instant. */
  deltaTSeconds: number;
  /** The ephemeris used at this instant: the Swiss files where they cover it, else Moshier. */
  ephemeris: Ephemeris;
  precision: Precision;
}

export const SECONDS_PER_DAY = 86400;
const UNIX_EPOCH_JD_UTC = 2440587.5;

function ephemerisFor(jdTT: number): { ephemeris: Ephemeris; precision: Precision } {
  const precision = precisionForJdTT(jdTT);
  return { ephemeris: precision === 'full' ? 'swiss' : 'moshier', precision };
}

/** From a JD in TT. UT is found by fixed-point iteration on Delta T (which varies slowly). */
export function instantFromJdTT(swe: SwissEph, jdTT: number): Instant {
  const { ephemeris, precision } = ephemerisFor(jdTT);
  let jdUT = jdTT;
  for (let k = 0; k < 20; k++) {
    const next = jdTT - swe.deltaT(jdUT, ephemeris);
    if (next === jdUT) break;
    jdUT = next;
  }
  return { jdTT, jdUT, deltaTSeconds: (jdTT - jdUT) * SECONDS_PER_DAY, ephemeris, precision };
}

/** From a JD in UT1. */
export function instantFromJdUT(swe: SwissEph, jdUT: number): Instant {
  // Probe with the Moshier Delta T (needs no files) to learn which ephemeris covers the
  // instant, then use that ephemeris's own Delta T. The two differ by far less than the
  // probe needs.
  const probe = ephemerisFor(jdUT + swe.deltaT(jdUT, 'moshier'));
  const dt = swe.deltaT(jdUT, probe.ephemeris);
  const jdTT = jdUT + dt;
  return { jdTT, jdUT, deltaTSeconds: dt * SECONDS_PER_DAY, ...ephemerisFor(jdTT) };
}

/**
 * From Unix time in milliseconds (JavaScript Date, UTC). Unix time has no leap seconds, so
 * the UTC calendar fields are exact except during a leap second itself.
 */
export function instantFromUnixMs(swe: SwissEph, unixMs: number): Instant {
  if (!Number.isFinite(unixMs)) throw new RangeError(`unixMs must be finite, got ${unixMs}`);
  const d = new Date(unixMs);
  const year = d.getUTCFullYear();
  if (year < 1 || year > 9999) {
    // swe_utc_to_jd handles the Gregorian calendar only; outside years 1–9999 use the JD directly.
    return instantFromJdUT(swe, UNIX_EPOCH_JD_UTC + unixMs / 86400000);
  }
  const seconds = d.getUTCSeconds() + d.getUTCMilliseconds() / 1000;
  const { jdTT, jdUT } = swe.utcToJd(year, d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), seconds);
  const e = ephemerisFor(jdTT);
  // Outside the files, recompute TT with the Moshier ephemeris's Delta T.
  if (e.ephemeris !== 'swiss') return instantFromJdUT(swe, jdUT);
  return { jdTT, jdUT, deltaTSeconds: (jdTT - jdUT) * SECONDS_PER_DAY, ...e };
}

/** Unix time in milliseconds (UTC) of an instant. */
export function unixMsFromInstant(swe: SwissEph, instant: Instant): number {
  const u = swe.jdUTToUtc(instant.jdUT);
  if (u.year < 1 || u.year > 9999) return (instant.jdUT - UNIX_EPOCH_JD_UTC) * 86400000;
  return Date.UTC(u.year, u.month - 1, u.day, u.hour, u.minute, 0) + u.second * 1000;
}
