/**
 * Birth-time sensitivity: how far the birth time can move, earlier and later, before the
 * lagna, the navāṃśa lagna, the D60 lagna or the Moon's nakṣatra changes.
 *
 * Each is a crossing found by the event finder (bracket by sampling, refine with Brent's
 * method to 1e-8 day): the sidereal ascendant reaching the next or previous multiple of
 * 30° (lagna), 3°20′ (navāṃśa: every 3°20′ starts a new navāṃśa sign, BPHS 6.12) or 30′
 * (ṣaṣṭyaṃśa: every half degree starts a new D60 sign, BPHS 6.33); the Moon's sidereal
 * longitude reaching a multiple of 13°20′. A division of the ascendant at these boundaries
 * always changes sign, since consecutive parts map to consecutive signs and the first part
 * of a sign never maps to the sign the last part of the previous one does.
 *
 * The ascendant is a function of UT (Earth's rotation), the Moon of TT; the shifts are
 * reported in seconds of time. Below about 66° of latitude the ascendant always increases;
 * nearer the poles it can stall or turn back, and a crossing twice within one sampling step
 * could be missed.
 */
import { Sky } from '../events/events.ts';
import { findCrossings } from '../events/roots.ts';
import { houses, type Place } from '../houses.ts';
import type { SwissEph } from '../swe/swisseph.ts';
import { instantFromJdUT, type Instant } from '../time.ts';
import { vargaSign } from './vargas.ts';
import type { JyotishSettings } from './settings.ts';

export type SensitiveQuantity = 'lagna' | 'navamsa-lagna' | 'd60-lagna' | 'moon-nakshatra';

export interface Hold {
  quantity: SensitiveQuantity;
  /** Sign (0 = Meṣa) or nakṣatra (0 = Aśvinī) at the birth time. */
  value: number;
  /** Degrees per part: 30, 10/3, 0.5 or 40/3. */
  partDegrees: number;
  /** Seconds of time to the change, earlier (negative) and later (positive); null if beyond the search. */
  earlier: { seconds: number; value: number } | null;
  later: { seconds: number; value: number } | null;
}

export interface Sensitivity {
  instant: Instant;
  /** Sidereal ascendant and Moon at the birth time, degrees. */
  ascendant: number;
  moon: number;
  holds: Hold[];
  /** How far each side was searched, days. */
  searchedDays: number;
}

/** Windows searched in turn, days: the first that holds a change ends the search. */
const WINDOWS = [1 / 24, 1 / 4, 1.5];
const SEARCH_DAYS = WINDOWS.at(-1)!;
/** Sampling steps, days: the ascendant moves a few degrees in two minutes, the Moon about 0.6° an hour. */
const ASC_STEP = 2 / 1440;
const MOON_STEP = 1 / 24;

/** The caller must have set the sidereal mode. */
export function sensitivity(swe: SwissEph, instant: Instant, place: Place, s: JyotishSettings): Sensitivity {
  const asc = (jdUT: number) => houses(swe, instantFromJdUT(swe, jdUT), place, 'W').ascendant.sidereal;
  const sky = new Sky(swe, s.node);
  const moon = (jdTT: number) => sky.lon('moon', jdTT);
  const a0 = asc(instant.jdUT);
  const m0 = moon(instant.jdTT);
  const sign = (lon: number, n: 1 | 9 | 60) => vargaSign(lon, n, s.vargas).sign;
  const hold = (quantity: SensitiveQuantity, f: (t: number) => number, t: number, x0: number, part: number, step: number, value: (lon: number) => number): Hold => {
    const k = Math.floor(x0 / part);
    const targets = [k * part, ((k + 1) * part) % 360];
    const nearest = (dir: -1 | 1): number | undefined => {
      for (const w of WINDOWS) {
        const [a, b] = dir < 0 ? [t - w, t] : [t, t + w];
        const found = targets.flatMap((target) => findCrossings(f, target, a, b, { step: Math.min(step, w / 12), angular: true })).filter((x) => (dir < 0 ? x < t : x > t));
        if (found.length) return dir < 0 ? Math.max(...found) : Math.min(...found);
      }
      return undefined;
    };
    const side = (dir: -1 | 1) => {
      const x = nearest(dir);
      if (x === undefined) return null;
      // The value just past the crossing (1e-8 day beyond the root, which Brent places within 0.5e-8).
      const past = f(x + dir * 1e-8);
      return { seconds: (x - t) * 86400, value: value(((past % 360) + 360) % 360) };
    };
    return { quantity, value: value(x0), partDegrees: part, earlier: side(-1), later: side(1) };
  };
  return {
    instant,
    ascendant: a0,
    moon: m0,
    holds: [
      hold('lagna', asc, instant.jdUT, a0, 30, ASC_STEP, (l) => sign(l, 1)),
      hold('navamsa-lagna', asc, instant.jdUT, a0, 30 / 9, ASC_STEP, (l) => sign(l, 9)),
      hold('d60-lagna', asc, instant.jdUT, a0, 0.5, ASC_STEP, (l) => sign(l, 60)),
      hold('moon-nakshatra', moon, instant.jdTT, m0, 40 / 3, MOON_STEP, (l) => Math.floor(l / (40 / 3))),
    ],
    searchedDays: SEARCH_DAYS,
  };
}
