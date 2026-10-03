/**
 * States of the grahas that depend on the chart: cruel or gentle, combustion, planetary war.
 *
 * Cruel and gentle (BPHS 3.11): the Sun, Saturn, Mars, the waning Moon, Rahu and Ketu are
 * cruel; Mercury is cruel when joined with a cruel graha. Where "waning" begins and what
 * "joined" means are open (docs/CANON.md); the defaults are below.
 *
 * Combustion (Sūrya Siddhānta 9.2–9, 10.1): a graha is combust when it rises or sets within
 * its arc of the Sun. The arcs are kālāṃśas — degrees of sidereal time between the risings
 * (graha behind the Sun, seen in the east) or the settings (graha ahead, seen in the west)
 * at the observer's latitude. Rising and setting of a point with right ascension α and
 * declination δ at latitude φ happen at sidereal time α ∓ arcsin(tan φ tan δ) (oblique
 * ascension and descension). The alternative compares ecliptic longitudes.
 *
 * Planetary war (SS 7.1, 7.12, 7.19–23; BJ 2.20; PD 4.2): only Mars, Mercury, Jupiter,
 * Venus and Saturn; at war when less than a degree apart; the victor stands to the north.
 */
import type { Graha } from '../grahas.ts';
import { arc, type Planet } from './core.ts';
import type { Chart } from './chart.ts';
import type { RuleId } from './sources.ts';

const DEG = Math.PI / 180;

/** Combustion arcs in degrees (SS 9.6–8, 10.1): [direct, retrograde]. */
export const COMBUSTION_ARC: Readonly<Record<Exclude<Planet, 'sun'>, readonly [number, number]>> = {
  moon: [12, 12],
  mars: [17, 17],
  mercury: [14, 12],
  jupiter: [11, 11],
  venus: [10, 8],
  saturn: [15, 15],
};

export const STAR_GRAHAS = ['mars', 'mercury', 'jupiter', 'venus', 'saturn'] as const;

/** Moon − Sun, [0, 360). */
export function elongation(c: Chart): number {
  return arc(c.grahas.sun.longitude, c.grahas.moon.longitude);
}

/**
 * Cruel grahas of a chart (BPHS 3.11). Default reading: the Moon is cruel while less than
 * half lit (elongation < 90° or > 270°, Kṛṣṇa Aṣṭamī to Śukla Aṣṭamī); Mercury is cruel when
 * in the same sign as a cruel graha other than the Moon.
 */
export function crueltyOf(c: Chart): Record<Graha, boolean> {
  const e = elongation(c);
  const moonCruel = e < 90 || e > 270;
  const base: Graha[] = ['sun', 'mars', 'saturn', 'rahu', 'ketu'];
  const cruel = new Set<Graha>(base);
  if (moonCruel) cruel.add('moon');
  if (base.some((g) => c.grahas[g].sign === c.grahas.mercury.sign)) cruel.add('mercury');
  const out = {} as Record<Graha, boolean>;
  for (const g of Object.keys(c.grahas) as Graha[]) out[g] = cruel.has(g);
  return out;
}

export interface Combustion {
  graha: Exclude<Planet, 'sun'>;
  /** The arc used, degrees (by motion for Mercury and Venus). */
  arc: number;
  /** Separation measured: kālāṃśa (sidereal-time degrees) or ecliptic longitude difference. Null if the kālāṃśa is undefined (circumpolar at this latitude). */
  separation: number | null;
  /** Horizon used for the kālāṃśa: east (graha behind the Sun, rising before it) or west. */
  horizon: 'east' | 'west';
  combust: boolean | null;
}

/** Oblique ascension (east) or descension (west), degrees; null if the point never rises or sets. */
function obliqueTime(ra: number, dec: number, lat: number, horizon: 'east' | 'west'): number | null {
  const x = Math.tan(lat * DEG) * Math.tan(dec * DEG);
  if (Math.abs(x) > 1) return null;
  const ad = Math.asin(x) / DEG;
  return horizon === 'east' ? ra - ad : ra + ad;
}

export function combustion(c: Chart, method: Chart['settings']['combustion'] = c.settings.combustion): Combustion[] {
  const sun = c.grahas.sun;
  return (Object.keys(COMBUSTION_ARC) as Array<Exclude<Planet, 'sun'>>).map((g) => {
    const p = c.grahas[g];
    const a = COMBUSTION_ARC[g][p.retrograde ? 1 : 0];
    // Behind the Sun in longitude: seen in the east before sunrise (SS 9.2–3).
    const ahead = arc(sun.longitude, p.longitude) < 180;
    const horizon = ahead ? 'west' : 'east';
    let separation: number | null;
    if (method === 'longitude') {
      const d = arc(sun.longitude, p.longitude);
      separation = d > 180 ? 360 - d : d;
    } else {
      const tp = obliqueTime(p.ra, p.dec, c.place.latitude, horizon);
      const ts = obliqueTime(sun.ra, sun.dec, c.place.latitude, horizon);
      if (tp === null || ts === null) separation = null;
      else {
        const d = arc(ts, tp);
        separation = d > 180 ? 360 - d : d;
      }
    }
    return { graha: g, arc: a, separation, horizon, combust: separation === null ? null : separation < a };
  });
}

export interface War {
  grahas: [Planet, Planet];
  /** Angular distance on the sky, degrees. */
  separation: number;
  /** Ecliptic longitude difference, degrees. */
  longitudeDifference: number;
  /** The graha with the greater ecliptic latitude (the northern one), SS 7.21, BJ 2.20, PD 4.2. */
  victor: Planet;
  /** Clauses of SS 7.21–23 not applied: brightness, and Venus “mostly” winning. */
  notApplied: string[];
  provisional: RuleId[];
}

/** Planetary wars in a chart: pairs of star-grahas less than 1° apart on the sky (default) or in longitude. */
export function wars(c: Chart, measure: 'sky' | 'longitude' = 'sky'): War[] {
  const out: War[] = [];
  for (let i = 0; i < STAR_GRAHAS.length; i++) {
    for (let j = i + 1; j < STAR_GRAHAS.length; j++) {
      const a = c.grahas[STAR_GRAHAS[i]!];
      const b = c.grahas[STAR_GRAHAS[j]!];
      const dl = arc(a.longitude, b.longitude);
      const dLon = dl > 180 ? 360 - dl : dl;
      // Great-circle distance from ecliptic coordinates (haversine, stable for small angles).
      const h = Math.sin(((b.latitude - a.latitude) * DEG) / 2) ** 2 + Math.cos(a.latitude * DEG) * Math.cos(b.latitude * DEG) * Math.sin((dLon * DEG) / 2) ** 2;
      const sep = (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / DEG;
      if ((measure === 'sky' ? sep : dLon) >= 1) continue;
      const victor = a.latitude >= b.latitude ? (a.graha as Planet) : (b.graha as Planet);
      const notApplied = ['SS 7.21: a brighter graha in the south may win'];
      if (a.graha === 'venus' || b.graha === 'venus') notApplied.push('SS 7.23: Venus mostly wins, north or south');
      out.push({ grahas: [a.graha as Planet, b.graha as Planet], separation: sep, longitudeDifference: dLon, victor, notApplied, provisional: ['graha-yuddha'] });
    }
  }
  return out;
}
