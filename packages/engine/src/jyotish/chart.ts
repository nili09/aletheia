/**
 * A birth chart as plain data: everything the jyotish rules need, computed once from the
 * ephemeris with flags checked, so the rules themselves are pure functions of a Chart.
 *
 * - Grahas: sidereal longitude, latitude and speed (the zodiac of the rules); tropical
 *   longitude (ayana bala works on sāyana longitudes); apparent right ascension and
 *   declination of date (kālāṃśa, hour angle).
 * - Lagna and MC: sidereal, from the house computation (whole-sign houses take the lagna's
 *   sign as the 1st).
 * - The vāra day containing the instant: sunrise before it, sunset, next sunrise; the
 *   weekday and the horā lord at the instant.
 */
import { grahaPosition, GRAHAS, type Graha } from '../grahas.ts';
import { houses, type Place } from '../houses.ts';
import { nextRiseSet } from '../riseset.ts';
import { SEFLG_EQUATORIAL } from '../swe/constants.ts';
import { ephemerisFlag, type SwissEph } from '../swe/swisseph.ts';
import { iplOf } from '../grahas.ts';
import type { Instant } from '../time.ts';
import type { Precision } from '../precision.ts';
import { SEVEN, signOf, type Planet, type Sign } from './core.ts';
import { HORA_ORDER, sunriseAtOrBefore, weekdayAt } from './panchang.ts';
import type { JyotishSettings } from './settings.ts';

export interface ChartGraha {
  graha: Graha;
  /** Sidereal longitude, degrees [0, 360). */
  longitude: number;
  /** Ecliptic latitude, degrees. */
  latitude: number;
  /** Sidereal longitude speed, degrees per day. */
  speed: number;
  retrograde: boolean;
  /** Tropical (sāyana) longitude. */
  tropical: number;
  /** Apparent right ascension and declination of date, degrees. */
  ra: number;
  dec: number;
  sign: Sign;
}

export interface Chart {
  instant: Instant;
  place: Place;
  settings: JyotishSettings;
  grahas: Record<Graha, ChartGraha>;
  /** Sidereal ascendant and MC, degrees. */
  ascendant: number;
  mc: number;
  /** Local apparent sidereal time × 15, degrees. */
  armc: number;
  lagna: Sign;
  sunrise: Instant;
  sunset: Instant;
  nextSunrise: Instant;
  /** Born between sunrise and sunset. */
  day: boolean;
  /** Weekday of the vāra day (0 = Sunday). */
  vara: number;
  /** Lord of the horā running at the instant. */
  horaLord: Planet;
  precision: Precision;
}

/** The caller must have set the sidereal mode. */
export function buildChart(swe: SwissEph, instant: Instant, place: Place, s: JyotishSettings): Chart {
  const f = ephemerisFlag(instant.ephemeris);
  const grahas = {} as Record<Graha, ChartGraha>;
  for (const g of GRAHAS) {
    const p = grahaPosition(swe, instant, g, s.node);
    const eq = swe.calc(instant.jdTT, iplOf(g, s.node), f | SEFLG_EQUATORIAL).value;
    let ra = eq[0];
    let dec = eq[1];
    if (g === 'ketu') {
      ra = (ra + 180) % 360;
      dec = -dec;
    }
    grahas[g] = {
      graha: g,
      longitude: p.sidereal.longitude,
      latitude: p.sidereal.latitude,
      speed: p.sidereal.longitudeSpeed,
      retrograde: p.retrograde,
      tropical: p.tropical.longitude,
      ra,
      dec,
      sign: signOf(p.sidereal.longitude),
    };
  }
  const h = houses(swe, instant, place, 'W');
  const conv = s.riseConvention;
  const sunrise = sunriseAtOrBefore(swe, instant.jdUT, place, conv);
  const sunset = nextRiseSet(swe, sunrise, 'sun', place, conv).set;
  if (!sunset) throw new RangeError('chart: the Sun does not set at this place on this date');
  const nextSunrise = nextRiseSet(swe, sunset, 'sun', place, conv).rise;
  if (!nextSunrise) throw new RangeError('chart: the Sun does not rise again at this place on this date');
  const vara = weekdayAt(sunrise.jdUT, place.longitude);
  const t = instant.jdUT;
  let part: number;
  if (s.hora === 'equal') part = Math.floor(((t - sunrise.jdUT) / (nextSunrise.jdUT - sunrise.jdUT)) * 24);
  else if (t < sunset.jdUT) part = Math.floor(((t - sunrise.jdUT) / (sunset.jdUT - sunrise.jdUT)) * 12);
  else part = 12 + Math.floor(((t - sunset.jdUT) / (nextSunrise.jdUT - sunset.jdUT)) * 12);
  const horaLord = HORA_ORDER[(HORA_ORDER.indexOf(SEVEN[vara]!) + Math.min(part, 23)) % 7]!;
  return {
    instant,
    place,
    settings: s,
    grahas,
    ascendant: h.ascendant.sidereal,
    mc: h.mc.sidereal,
    armc: h.armc,
    lagna: signOf(h.ascendant.sidereal),
    sunrise,
    sunset,
    nextSunrise,
    day: t < sunset.jdUT,
    vara,
    horaLord,
    precision: instant.precision === 'reduced' || sunrise.precision === 'reduced' ? 'reduced' : 'full',
  };
}

/** Sidereal longitudes of the nine grahas. */
export function longitudes(c: Chart): Record<Graha, number> {
  const out = {} as Record<Graha, number>;
  for (const g of GRAHAS) out[g] = c.grahas[g].longitude;
  return out;
}

/** D1 signs of the seven planets. */
export function planetSigns(c: Chart): Record<Planet, Sign> {
  const out = {} as Record<Planet, Sign>;
  for (const g of SEVEN) out[g] = c.grahas[g].sign;
  return out;
}
