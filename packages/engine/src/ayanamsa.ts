/**
 * Ayanamsa: the longitude of the tropical zero point (vernal equinox) in the sidereal zodiac.
 *
 * Every predefined Swiss Ephemeris mode (0–46) is available. Lahiri (SE_SIDM_LAHIRI = 1) is
 * the default (docs/CANON.md). The "true" ayanamsa includes nutation in longitude, which is
 * what sidereal = tropical − ayanamsa needs, because apparent tropical longitudes include it.
 */
import { SE_NSIDM_PREDEF, SE_SIDM_LAHIRI, SEFLG_NONUT } from './swe/constants.ts';
import { ephemerisFlag, type SwissEph } from './swe/swisseph.ts';
import type { Instant } from './time.ts';
import type { Precision } from './precision.ts';

export const DEFAULT_AYANAMSA = SE_SIDM_LAHIRI;

/** Mode numbers 0..46, as defined in swephexp.h. */
export const AYANAMSA_MODES: readonly number[] = Array.from({ length: SE_NSIDM_PREDEF }, (_, i) => i);

/**
 * Modes whose sidereal positions the library defines as a projection onto the ecliptic of
 * the mode's reference epoch (it forces SE_SIDBIT_ECL_T0, sweph.c, swe_set_sid_mode):
 * J2000 (18), J1900 (19), B1950 (20) and Skydram/Mardyks (34). For these, and only these,
 * sidereal longitude is not tropical longitude minus the ayanamsa; the difference is a few
 * arcseconds (test/invariants.test.ts).
 *
 * No mode needs the star catalogue: the stars that star-based ayanamsas use (Spica,
 * Revati, Pushya, Mula, the galactic centre…) are built into the library
 * (sweph.c, get_builtin_star); test/ayanamsa.test.ts checks this.
 */
export const ECLIPTIC_T0_AYANAMSAS: ReadonlySet<number> = new Set([18, 19, 20, 34]);

export interface Ayanamsa {
  mode: number;
  name: string;
  /** True ayanamsa (with nutation), degrees. */
  value: number;
  /** Mean ayanamsa (without nutation), degrees. */
  mean: number;
  flags: number;
  precision: Precision;
}

export function assertAyanamsaMode(mode: number): void {
  if (!Number.isInteger(mode) || mode < 0 || mode >= SE_NSIDM_PREDEF) {
    throw new RangeError(`ayanamsa mode must be an integer 0..${SE_NSIDM_PREDEF - 1}, got ${mode}`);
  }
}

export function ayanamsa(swe: SwissEph, instant: Instant, mode: number): Ayanamsa {
  assertAyanamsaMode(mode);
  swe.setSidMode(mode);
  const f = ephemerisFlag(instant.ephemeris);
  const t = swe.ayanamsa(instant.jdTT, f);
  const m = swe.ayanamsa(instant.jdTT, f | SEFLG_NONUT);
  return { mode, name: swe.ayanamsaName(mode), value: t.value, mean: m.value, flags: t.flags, precision: instant.precision };
}
