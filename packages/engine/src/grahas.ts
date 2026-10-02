/**
 * Positions of the nine grahas.
 *
 * Frame (Swiss Ephemeris defaults, unchanged): geocentric, apparent (light-time, annual
 * aberration, gravitational deflection), ecliptic and true equinox of date (precession
 * IAU 2006 / Vondrák 2011, nutation IAU 2000B). Jupiter and Saturn are their system
 * barycentres (at most 0.075″ from the planet's centre; see docs/TESTING.md).
 *
 * Sidereal longitude = tropical longitude − true ayanamsa (with nutation), as computed by
 * the library with SEFLG_SIDEREAL; test/invariants.test.ts checks the identity.
 */
import {
  SE_JUPITER,
  SE_MARS,
  SE_MEAN_NODE,
  SE_MERCURY,
  SE_MOON,
  SE_SATURN,
  SE_SUN,
  SE_TRUE_NODE,
  SE_VENUS,
  SEFLG_SIDEREAL,
  SEFLG_SPEED,
} from './swe/constants.ts';
import { ephemerisFlag, type Six, type SwissEph } from './swe/swisseph.ts';
import type { Instant } from './time.ts';
import type { Precision } from './precision.ts';

export type Graha = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'rahu' | 'ketu';
export const GRAHAS: readonly Graha[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'rahu', 'ketu'];

/** Rahu as the true (osculating) or the mean lunar ascending node. Default: true (docs/CANON.md). */
export type NodeKind = 'true' | 'mean';

export interface Coordinates {
  /** Degrees, [0, 360). */
  longitude: number;
  /** Degrees. */
  latitude: number;
  /** Astronomical units. */
  distance: number;
  /** Degrees per day. */
  longitudeSpeed: number;
  latitudeSpeed: number;
  /** AU per day. */
  distanceSpeed: number;
}

export interface GrahaPosition {
  graha: Graha;
  tropical: Coordinates;
  sidereal: Coordinates;
  /** Moving backwards against the stars: sidereal longitude speed < 0 (docs/CANON.md). */
  retrograde: boolean;
  /** For rahu and ketu only. */
  node?: NodeKind;
  /** Swiss Ephemeris flags the library reports it used (tropical, sidereal). */
  flags: { tropical: number; sidereal: number };
  ephemeris: Instant['ephemeris'];
  precision: Precision;
}

const IPL: Record<Exclude<Graha, 'rahu' | 'ketu'>, number> = {
  sun: SE_SUN,
  moon: SE_MOON,
  mercury: SE_MERCURY,
  venus: SE_VENUS,
  mars: SE_MARS,
  jupiter: SE_JUPITER,
  saturn: SE_SATURN,
};

export function iplOf(graha: Graha, node: NodeKind): number {
  if (graha === 'rahu' || graha === 'ketu') return node === 'true' ? SE_TRUE_NODE : SE_MEAN_NODE;
  return IPL[graha];
}

function coords(x: Six): Coordinates {
  return { longitude: x[0], latitude: x[1], distance: x[2], longitudeSpeed: x[3], latitudeSpeed: x[4], distanceSpeed: x[5] };
}

/** Ketu is the descending node: exactly opposite Rahu, with Rahu's motion. */
function opposite(c: Coordinates): Coordinates {
  const lon = c.longitude + 180;
  return {
    longitude: lon >= 360 ? lon - 360 : lon,
    latitude: -c.latitude,
    distance: c.distance,
    longitudeSpeed: c.longitudeSpeed,
    latitudeSpeed: -c.latitudeSpeed,
    distanceSpeed: c.distanceSpeed,
  };
}

/** The caller must have set the sidereal mode (SwissEph.setSidMode). */
export function grahaPosition(swe: SwissEph, instant: Instant, graha: Graha, node: NodeKind): GrahaPosition {
  const base = ephemerisFlag(instant.ephemeris) | SEFLG_SPEED;
  const ipl = iplOf(graha, node);
  const trop = swe.calc(instant.jdTT, ipl, base);
  const sid = swe.calc(instant.jdTT, ipl, base | SEFLG_SIDEREAL);
  let tropical = coords(trop.value);
  let sidereal = coords(sid.value);
  if (graha === 'ketu') {
    tropical = opposite(tropical);
    sidereal = opposite(sidereal);
  }
  const p: GrahaPosition = {
    graha,
    tropical,
    sidereal,
    retrograde: sidereal.longitudeSpeed < 0,
    flags: { tropical: trop.flags, sidereal: sid.flags },
    ephemeris: instant.ephemeris,
    precision: instant.precision,
  };
  if (graha === 'rahu' || graha === 'ketu') p.node = node;
  return p;
}

/** Sidereal longitude and speed only: the fast path the event finder samples. */
export function siderealLongitude(swe: SwissEph, jdTT: number, ephemerisFlagBits: number, graha: Graha, node: NodeKind): { longitude: number; speed: number } {
  const x = swe.calc(jdTT, iplOf(graha, node), ephemerisFlagBits | SEFLG_SPEED | SEFLG_SIDEREAL).value;
  const lon = graha === 'ketu' ? x[0] + 180 : x[0];
  return { longitude: lon >= 360 ? lon - 360 : lon, speed: x[3] };
}
