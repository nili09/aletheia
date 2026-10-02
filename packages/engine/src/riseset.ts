/**
 * Rising and setting of the Sun and the Moon, under the two sunrise conventions of
 * docs/CANON.md:
 *
 * - 'upper-limb' (default): the upper limb of the disc touches the horizon, with standard
 *   atmospheric refraction. Disc size follows the true distance; the Moon is topocentric.
 *   Standard refraction is the library's Sinclair formula at the standard pressure
 *   (1013.25 hPa, scaled to the observer's altitude) and 10 °C, its reference temperature:
 *   34.6′ at the horizon.
 * - 'hindu': the centre of the disc on the geometric horizon, no refraction, geocentric,
 *   ecliptic latitude ignored (Swiss Ephemeris SE_BIT_HINDU_RISING).
 */
import {
  SE_BIT_HINDU_RISING,
  SE_CALC_RISE,
  SE_CALC_SET,
  SE_MOON,
  SE_SUN,
} from './swe/constants.ts';
import { ephemerisFlag, type SwissEph } from './swe/swisseph.ts';
import { assertPlace, type Place } from './houses.ts';
import { instantFromJdUT, type Instant } from './time.ts';

export type RiseConvention = 'upper-limb' | 'hindu';
export const RISE_CONVENTIONS: readonly RiseConvention[] = ['upper-limb', 'hindu'];
export const DEFAULT_RISE_CONVENTION: RiseConvention = 'upper-limb';

export type RisingBody = 'sun' | 'moon';

/** Standard atmosphere for refraction: 0 means 1013.25 hPa scaled to altitude by the library. */
export const STANDARD_PRESSURE_HPA = 0;
export const STANDARD_TEMPERATURE_C = 10;

export interface RiseSet {
  body: RisingBody;
  convention: RiseConvention;
  /** Next rising after the start instant, or null if the body does not rise (polar day/night). */
  rise: Instant | null;
  /** Next setting after the start instant, or null if the body does not set. */
  set: Instant | null;
}

function rsmiFor(convention: RiseConvention): number {
  return convention === 'hindu' ? SE_BIT_HINDU_RISING : 0;
}

export function nextRiseSet(swe: SwissEph, from: Instant, body: RisingBody, place: Place, convention: RiseConvention): RiseSet {
  assertPlace(place);
  if (!RISE_CONVENTIONS.includes(convention)) throw new RangeError(`unknown rise convention ${convention}`);
  const ipl = body === 'sun' ? SE_SUN : SE_MOON;
  const f = ephemerisFlag(from.ephemeris);
  const alt = place.altitude ?? 0;
  const find = (event: number) => {
    const jd = swe.riseTrans(from.jdUT, ipl, f, event | rsmiFor(convention), place.longitude, place.latitude, alt, STANDARD_PRESSURE_HPA, STANDARD_TEMPERATURE_C);
    return jd === null ? null : instantFromJdUT(swe, jd);
  };
  return { body, convention, rise: find(SE_CALC_RISE), set: find(SE_CALC_SET) };
}
