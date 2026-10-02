/**
 * Ascendant, MC and house cusps for an instant and a place.
 *
 * Whole-sign houses are the default (docs/CANON.md). Every Swiss Ephemeris house system is
 * available by its letter. Cusps come in both zodiacs: the library computes the sidereal
 * set itself (SEFLG_SIDEREAL), so for whole-sign houses the sidereal cusps are the starts of
 * the sidereal signs, not the tropical ones shifted.
 *
 * Houses use UT (Earth's rotation): the local apparent sidereal time is the ARMC / 15.
 */
import { SEFLG_SIDEREAL } from './swe/constants.ts';
import { ephemerisFlag, type SwissEph } from './swe/swisseph.ts';
import type { Instant } from './time.ts';
import type { Precision } from './precision.ts';

export interface Place {
  /** Geodetic latitude, degrees north positive. */
  latitude: number;
  /** Longitude, degrees east positive. */
  longitude: number;
  /** Metres above sea level. */
  altitude?: number;
}

/** House systems by Swiss Ephemeris letter. 'W' whole sign is the default. */
export const HOUSE_SYSTEMS = ['W', 'P', 'K', 'O', 'R', 'C', 'E', 'A', 'V', 'X', 'H', 'T', 'B', 'M', 'U', 'G', 'Y', 'N', 'F', 'D', 'L', 'Q', 'I', 'i', 'S'] as const;
export type HouseSystem = (typeof HOUSE_SYSTEMS)[number];
export const DEFAULT_HOUSE_SYSTEM: HouseSystem = 'W';

export interface Houses {
  system: HouseSystem;
  systemName: string;
  /** Degrees; tropical and sidereal (current ayanamsa). */
  ascendant: { tropical: number; sidereal: number };
  mc: { tropical: number; sidereal: number };
  /** Right ascension of the MC = local apparent sidereal time × 15, degrees. */
  armc: number;
  /** Cusps 1..n (12, or 36 for Gauquelin sectors), degrees. */
  cusps: { tropical: number[]; sidereal: number[] };
  /** Ascendant speed, degrees per day (tropical). */
  ascendantSpeed: number;
  precision: Precision;
}

export function assertPlace(place: Place): void {
  const { latitude, longitude, altitude = 0 } = place;
  if (!(latitude >= -90 && latitude <= 90)) throw new RangeError(`latitude must be in [-90, 90], got ${latitude}`);
  if (!(longitude >= -180 && longitude <= 360)) throw new RangeError(`longitude must be in [-180, 360], got ${longitude}`);
  if (!Number.isFinite(altitude)) throw new RangeError(`altitude must be finite, got ${altitude}`);
}

/** The caller must have set the sidereal mode. */
export function houses(swe: SwissEph, instant: Instant, place: Place, system: HouseSystem): Houses {
  assertPlace(place);
  if (!HOUSE_SYSTEMS.includes(system)) throw new RangeError(`unknown house system ${system}`);
  const f = ephemerisFlag(instant.ephemeris);
  const trop = swe.houses(instant.jdUT, f, place.latitude, place.longitude, system);
  const sid = swe.houses(instant.jdUT, f | SEFLG_SIDEREAL, place.latitude, place.longitude, system);
  const n = system === 'G' ? 36 : 12;
  return {
    system,
    systemName: swe.houseName(system),
    ascendant: { tropical: trop.ascmc[0]!, sidereal: sid.ascmc[0]! },
    mc: { tropical: trop.ascmc[1]!, sidereal: sid.ascmc[1]! },
    armc: trop.ascmc[2]!,
    cusps: { tropical: trop.cusps.slice(1, n + 1), sidereal: sid.cusps.slice(1, n + 1) },
    ascendantSpeed: trop.ascmcSpeed[0]!,
    precision: instant.precision,
  };
}
