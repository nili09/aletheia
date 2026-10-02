/**
 * Astronomical events in the sidereal zodiac, found to well within one second:
 * sign, nakṣatra and pada ingresses of every graha; stations; conjunctions of any two
 * grahas; tithi boundaries; new and full moons; saṅkrāntis (the Sun's sign ingresses).
 *
 * Method. For each function of time (a sidereal longitude, a longitude difference, the
 * Moon–Sun elongation):
 *   1. find the times where its rate changes sign (stations, or relative stations for a
 *      pair), by sampling the rate and refining with Brent's method;
 *   2. sample the function, with those times as extra sample points, so that between two
 *      consecutive samples the function is monotonic and moves less than 180°;
 *   3. every division boundary passed between two samples is crossed exactly once there:
 *      bracket it and refine with Brent's method (tolerance 1e-8 day).
 * Event times are computed on TT, the ephemeris's own uniform time scale.
 *
 * verifyEvent() re-evaluates the function half a second either side of a found event and
 * checks that it lies on opposite sides of the target, i.e. the crossing is within ±0.5 s.
 */
import { FULL_PRECISION_JD_TT, precisionForJdTT } from '../precision.ts';
import { SEFLG_MOSEPH, SEFLG_SWIEPH } from '../swe/constants.ts';
import type { SwissEph } from '../swe/swisseph.ts';
import { GRAHAS, siderealLongitude, type Graha, type NodeKind } from '../grahas.ts';
import { instantFromJdTT, type Instant } from '../time.ts';
import { brent, DEFAULT_TOLERANCE, samplePoints, SECOND, wrap180 } from './roots.ts';

export type EventKind =
  | 'sign-ingress'
  | 'nakshatra-ingress'
  | 'pada-ingress'
  | 'sankranti'
  | 'station'
  | 'conjunction'
  | 'tithi'
  | 'new-moon'
  | 'full-moon';

export const EVENT_KINDS: readonly EventKind[] = [
  'sign-ingress',
  'nakshatra-ingress',
  'pada-ingress',
  'sankranti',
  'station',
  'conjunction',
  'tithi',
  'new-moon',
  'full-moon',
];

interface Base {
  instant: Instant;
}

export interface IngressEvent extends Base {
  kind: 'sign-ingress' | 'nakshatra-ingress' | 'pada-ingress' | 'sankranti';
  graha: Graha;
  /** The boundary crossed, sidereal degrees. */
  boundary: number;
  /** Index entered: sign 0..11, nakṣatra 0..26, or pada 0..107 counted from 0° Aśvinī. */
  entered: number;
  /** Index left. */
  left: number;
  motion: 'direct' | 'retrograde';
}

export interface StationEvent extends Base {
  kind: 'station';
  graha: Graha;
  /** The motion that begins at the station. */
  turns: 'retrograde' | 'direct';
  /** Sidereal longitude at the station. */
  longitude: number;
}

export interface ConjunctionEvent extends Base {
  kind: 'conjunction';
  grahas: [Graha, Graha];
  /** Sidereal longitude of the first graha at conjunction (equal to the second's). */
  longitude: number;
}

export interface TithiEvent extends Base {
  kind: 'tithi' | 'new-moon' | 'full-moon';
  /** Moon − Sun elongation boundary crossed, degrees (multiple of 12). */
  boundary: number;
  /** Tithi that begins, 1..30 (1 = Śukla Pratipadā, 16 = Kṛṣṇa Pratipadā). */
  tithi: number;
}

export type AstroEvent = IngressEvent | StationEvent | ConjunctionEvent | TithiEvent;

export interface EventQuery {
  /** Julian day TT, inclusive. */
  startTT: number;
  /** Julian day TT, exclusive. */
  endTT: number;
  kinds?: readonly EventKind[];
  grahas?: readonly Graha[];
  node: NodeKind;
}

/** Sampling steps in days: each graha moves well under 90° per step. */
const STEP: Record<Graha, number> = {
  sun: 1,
  moon: 0.5,
  mercury: 1,
  venus: 1,
  mars: 1,
  jupiter: 2,
  saturn: 2,
  rahu: 0.25,
  ketu: 0.25,
};

/**
 * Steps for finding sign changes of the speed. Retrograde and direct spells of the planets
 * last weeks, so a day is safe. The true node's speed reverses within days; its step is
 * checked against a 15-minute scan in test/events.test.ts.
 */
const RATE_STEP: Record<Graha, number> = {
  sun: 0,
  moon: 0,
  mercury: 1,
  venus: 1,
  mars: 1,
  jupiter: 2,
  saturn: 2,
  rahu: 0.125,
  ketu: 0.125,
};

const PLANETS_WITH_STATIONS: ReadonlySet<Graha> = new Set(['mercury', 'venus', 'mars', 'jupiter', 'saturn']);
const MAX_WINDOW_DAYS = 36525;

type Sample = { longitude: number; speed: number };

/** Ephemeris flag for an instant: the files where they cover it, else Moshier. */
function epheFlagAt(jdTT: number): number {
  return precisionForJdTT(jdTT) === 'full' ? SEFLG_SWIEPH : SEFLG_MOSEPH;
}

/** A memoised sidereal-longitude function per graha for one search. */
export class Sky {
  private readonly cache = new Map<string, Sample>();
  constructor(
    private readonly swe: SwissEph,
    readonly node: NodeKind,
  ) {}

  at(graha: Graha, jdTT: number): Sample {
    const key = `${graha}:${jdTT}`;
    let s = this.cache.get(key);
    if (!s) {
      s = siderealLongitude(this.swe, jdTT, epheFlagAt(jdTT), graha, this.node);
      this.cache.set(key, s);
    }
    return s;
  }

  lon(graha: Graha, jdTT: number): number {
    return this.at(graha, jdTT).longitude;
  }
}

/** Times in (start, end) where rate(t) changes sign, refined with Brent. */
function rateRoots(rate: (t: number) => number, start: number, end: number, step: number): number[] {
  const pts = samplePoints(start, end, step, [FULL_PRECISION_JD_TT.first, FULL_PRECISION_JD_TT.last]);
  const out: number[] = [];
  let t0 = pts[0]!;
  let r0 = rate(t0);
  for (let i = 1; i < pts.length; i++) {
    const t1 = pts[i]!;
    const r1 = rate(t1);
    if (r0 !== 0 && r1 !== 0 && Math.sign(r0) !== Math.sign(r1)) {
      out.push(brent(rate, t0, t1, r0, r1, DEFAULT_TOLERANCE));
    } else if (r1 === 0 && t1 < end) {
      out.push(t1);
    }
    t0 = t1;
    r0 = r1;
  }
  return out;
}

/**
 * Boundary crossings of an angle f(t) on a grid of `units` equal divisions of 360°, over
 * monotonic pieces between the given split points.
 */
function gridCrossings(
  f: (t: number) => number,
  start: number,
  end: number,
  step: number,
  splitAt: readonly number[],
  units: number,
): Array<{ t: number; k: number; direct: boolean }> {
  const span = 360 / units;
  const pts = samplePoints(start, end, step, [...splitAt, FULL_PRECISION_JD_TT.first, FULL_PRECISION_JD_TT.last]);
  const out: Array<{ t: number; k: number; direct: boolean }> = [];
  let t0 = pts[0]!;
  let a0 = f(t0);
  for (let i = 1; i < pts.length; i++) {
    const t1 = pts[i]!;
    const a1 = f(t1);
    const d = wrap180(a1 - a0);
    const u0 = a0 / span;
    const u1 = u0 + d / span;
    // Boundaries k strictly passed: (u0, u1] moving forward, (u1, u0] moving backward.
    const lo = d >= 0 ? Math.floor(u0) + 1 : Math.floor(u1) + 1;
    const hi = d >= 0 ? Math.floor(u1) : Math.floor(u0);
    for (let k = lo; k <= hi; k++) {
      const kk = ((k % units) + units) % units;
      const boundary = (kk * 360) / units;
      const g = (t: number) => wrap180(f(t) - boundary);
      const g0 = g(t0);
      const g1 = g(t1);
      if (g0 !== 0 && g1 !== 0 && Math.sign(g0) === Math.sign(g1)) {
        throw new Error(`event finder: boundary ${boundary}° not bracketed in [${t0}, ${t1}]`);
      }
      const t = brent(g, t0, t1, g0, g1, DEFAULT_TOLERANCE);
      if (t >= start && t < end) out.push({ t, k: kk, direct: d >= 0 });
    }
    t0 = t1;
    a0 = a1;
  }
  return out;
}

export function findEvents(swe: SwissEph, q: EventQuery): AstroEvent[] {
  const { startTT, endTT, node } = q;
  if (!(endTT > startTT)) throw new RangeError('findEvents: end must be after start');
  if (endTT - startTT > MAX_WINDOW_DAYS) throw new RangeError(`findEvents: window longer than ${MAX_WINDOW_DAYS} days`);
  const kinds = new Set(q.kinds ?? EVENT_KINDS);
  const grahas = q.grahas ?? GRAHAS;
  const sky = new Sky(swe, node);
  const events: AstroEvent[] = [];
  const at = (jdTT: number) => instantFromJdTT(swe, jdTT);

  const ingressKinds = kinds.has('sign-ingress') || kinds.has('nakshatra-ingress') || kinds.has('pada-ingress');
  const stationTimes = new Map<Graha, number[]>();
  const stationsOf = (g: Graha): number[] => {
    let s = stationTimes.get(g);
    if (!s) {
      const step = RATE_STEP[g];
      s = step > 0 && (PLANETS_WITH_STATIONS.has(g) || node === 'true') ? rateRoots((t) => sky.at(g, t).speed, startTT, endTT, step) : [];
      stationTimes.set(g, s);
    }
    return s;
  };

  for (const graha of grahas) {
    // Ingresses (and saṅkrāntis for the Sun).
    if (ingressKinds || (graha === 'sun' && kinds.has('sankranti'))) {
      for (const c of gridCrossings((t) => sky.lon(graha, t), startTT, endTT, STEP[graha], stationsOf(graha), 108)) {
        const entered = c.direct ? c.k : (c.k + 107) % 108;
        const left = c.direct ? (c.k + 107) % 108 : c.k;
        const boundary = (c.k * 360) / 108; // same expression as the root used
        const motion = c.direct ? 'direct' : 'retrograde';
        const instant = at(c.t);
        if (kinds.has('pada-ingress')) events.push({ kind: 'pada-ingress', graha, boundary, entered, left, motion, instant });
        if (c.k % 4 === 0 && kinds.has('nakshatra-ingress')) {
          events.push({ kind: 'nakshatra-ingress', graha, boundary, entered: Math.floor(entered / 4), left: Math.floor(left / 4), motion, instant });
        }
        if (c.k % 9 === 0) {
          const sign = { boundary, entered: Math.floor(entered / 9), left: Math.floor(left / 9), motion, instant } as const;
          if (kinds.has('sign-ingress')) events.push({ kind: 'sign-ingress', graha, ...sign });
          if (graha === 'sun' && kinds.has('sankranti')) events.push({ kind: 'sankranti', graha, ...sign });
        }
      }
    }
    // Stations of the planets.
    if (kinds.has('station') && PLANETS_WITH_STATIONS.has(graha)) {
      for (const t of stationsOf(graha)) {
        const after = sky.at(graha, t + SECOND).speed;
        events.push({ kind: 'station', graha, turns: after < 0 ? 'retrograde' : 'direct', longitude: sky.lon(graha, t), instant: at(t) });
      }
    }
  }

  // Conjunctions of every pair (Rahu and Ketu are always opposite, so never conjoin).
  if (kinds.has('conjunction')) {
    for (let i = 0; i < grahas.length; i++) {
      for (let j = i + 1; j < grahas.length; j++) {
        const a = grahas[i]!;
        const b = grahas[j]!;
        if ((a === 'rahu' && b === 'ketu') || (a === 'ketu' && b === 'rahu')) continue;
        const step = Math.min(STEP[a], STEP[b]);
        const rateStep = Math.min(RATE_STEP[a] || 1, RATE_STEP[b] || 1);
        const rel = (t: number) => sky.at(a, t).speed - sky.at(b, t).speed;
        const splits = rateRoots(rel, startTT, endTT, rateStep);
        const diff = (t: number) => sky.lon(a, t) - sky.lon(b, t);
        for (const c of gridCrossings(diff, startTT, endTT, step, splits, 1)) {
          events.push({ kind: 'conjunction', grahas: [a, b], longitude: sky.lon(a, c.t), instant: at(c.t) });
        }
      }
    }
  }

  // Tithis, new and full moons: the Moon–Sun elongation always increases.
  if (kinds.has('tithi') || kinds.has('new-moon') || kinds.has('full-moon')) {
    const elong = (t: number) => sky.lon('moon', t) - sky.lon('sun', t);
    for (const c of gridCrossings(elong, startTT, endTT, STEP.moon, [], 30)) {
      if (!c.direct) throw new Error('event finder: Moon–Sun elongation decreased');
      const base = { boundary: c.k * 12, tithi: c.k + 1, instant: at(c.t) };
      if (kinds.has('tithi')) events.push({ kind: 'tithi', ...base });
      if (c.k === 0 && kinds.has('new-moon')) events.push({ kind: 'new-moon', ...base });
      if (c.k === 15 && kinds.has('full-moon')) events.push({ kind: 'full-moon', ...base });
    }
  }

  return events.sort((x, y) => x.instant.jdTT - y.instant.jdTT);
}

/** The residual whose sign change defines the event, and its target. */
export function eventResidual(sky: Sky, e: AstroEvent): (jdTT: number) => number {
  switch (e.kind) {
    case 'sign-ingress':
    case 'nakshatra-ingress':
    case 'pada-ingress':
    case 'sankranti':
      return (t) => wrap180(sky.lon(e.graha, t) - e.boundary);
    case 'station':
      return (t) => sky.at(e.graha, t).speed;
    case 'conjunction':
      return (t) => wrap180(sky.lon(e.grahas[0], t) - sky.lon(e.grahas[1], t));
    case 'tithi':
    case 'new-moon':
    case 'full-moon':
      return (t) => wrap180(sky.lon('moon', t) - sky.lon('sun', t) - e.boundary);
  }
}

export interface EventCheck {
  /** Residual half a second before and after the event. */
  before: number;
  after: number;
  /** The residual changes sign across [t − 0.5 s, t + 0.5 s]. */
  ok: boolean;
}

export function verifyEvent(swe: SwissEph, node: NodeKind, e: AstroEvent): EventCheck {
  const r = eventResidual(new Sky(swe, node), e);
  const t = e.instant.jdTT;
  const before = r(t - 0.5 * SECOND);
  const after = r(t + 0.5 * SECOND);
  return { before, after, ok: before === 0 || after === 0 || Math.sign(before) !== Math.sign(after) };
}
