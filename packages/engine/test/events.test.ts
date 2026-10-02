/**
 * The event finder.
 *
 * 1. Generic root finding: findCrossings and Brent against functions with known roots.
 * 2. Every event found in a year of all kinds, all grahas, is re-evaluated half a second
 *    either side of its time; the function must be on opposite sides of the target, i.e.
 *    the crossing is within ±0.5 s (the requirement is 1 s).
 * 3. Completeness: brute-force scans at a much finer step find exactly the same crossings.
 * 4. New and full moons against NASA's phase table (UT, to the minute), 2010–2011.
 *    Tolerance 60 s, set before measuring: NASA rounds to the minute (±30 s).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { brent, findCrossing, findCrossings, GRAHAS, SECOND, wrap180, type AstroEvent, type Engine, type Graha } from '../src/index.ts';
import { SEFLG_SWIEPH } from '../src/swe/constants.ts';
import { siderealLongitude } from '../src/grahas.ts';
import { fixture, loadEngine } from './helpers.ts';

let engine: Engine;
beforeAll(async () => {
  engine = await loadEngine();
});

describe('root finding', () => {
  it('Brent finds the root of cos in [0, 3] to 1e-12', () => {
    const r = brent(Math.cos, 0, 3, Math.cos(0), Math.cos(3), 1e-12);
    expect(Math.abs(r - Math.PI / 2)).toBeLessThan(1e-12);
  });

  it('findCrossings finds every crossing of sin(t) = 0.5 over ten periods', () => {
    const roots = findCrossings(Math.sin, 0.5, 0, 20 * Math.PI, { step: 0.5, tolerance: 1e-12 });
    expect(roots).toHaveLength(20);
    for (const r of roots) expect(Math.abs(Math.sin(r) - 0.5)).toBeLessThan(1e-11);
  });

  it('treats angles modulo 360 and ignores the jump from 359.9° to 0°', () => {
    const angle = (t: number) => (t * 50) % 360; // 50°/day, wraps every 7.2 days
    const roots = findCrossings(angle, 100, 0, 30, { step: 0.25, angular: true, tolerance: 1e-12 });
    expect(roots.map((r) => Math.round(r * 1e6) / 1e6)).toEqual([2, 9.2, 16.4, 23.6]);
    expect(findCrossing(angle, 0, 0.1, 30, { step: 0.25, angular: true })).toBeCloseTo(7.2, 9);
  });

  it('wrap180 maps to [-180, 180)', () => {
    expect(wrap180(190)).toBe(-170);
    expect(wrap180(-190)).toBe(170);
    expect(wrap180(180)).toBe(-180);
    expect(wrap180(0)).toBe(0);
  });
});

describe('every event, re-evaluated at its time', () => {
  let events: AstroEvent[];
  beforeAll(() => {
    events = engine.events({ start: { unixMs: Date.parse('2026-01-01T00:00:00Z') }, end: { unixMs: Date.parse('2027-01-01T00:00:00Z') } });
  });

  it('finds all kinds of event in a year', () => {
    const kinds = new Set(events.map((e) => e.kind));
    expect([...kinds].sort()).toEqual(['conjunction', 'full-moon', 'nakshatra-ingress', 'new-moon', 'pada-ingress', 'sankranti', 'sign-ingress', 'station', 'tithi']);
    expect(events.filter((e) => e.kind === 'sankranti')).toHaveLength(12);
    expect(events.filter((e) => e.kind === 'new-moon').length).toBeGreaterThanOrEqual(12);
    // Mercury turns retrograde three or four times a year.
    expect(events.filter((e) => e.kind === 'station' && e.graha === 'mercury' && e.turns === 'retrograde').length).toBeGreaterThanOrEqual(3);
    console.log(`${events.length} events in 2026`);
  });

  it('every one crosses its target within ±0.5 s of the time found', () => {
    for (const e of events) {
      const check = engine.verifyEvent(e);
      expect(check.ok, `${e.kind} ${'graha' in e ? e.graha : ''} at JD TT ${e.instant.jdTT}: ${check.before} / ${check.after}`).toBe(true);
    }
  });

  it('ingress indices are consistent with the boundary and the motion', () => {
    for (const e of events) {
      if (e.kind !== 'pada-ingress') continue;
      const span = 360 / 108;
      expect(Math.round(e.boundary / span) % 108).toBe(e.motion === 'direct' ? e.entered : e.left);
    }
  });
});

describe('completeness against brute-force scans', () => {
  /** Count sign changes of the pada/nakshatra/sign index by sampling every `step` days. */
  function bruteCrossings(graha: Graha, start: number, end: number, step: number, span: number): number {
    let n = 0;
    let prev = Math.floor(siderealLongitude(engine.swe, start, SEFLG_SWIEPH, graha, 'true').longitude / span);
    for (let t = start + step; t <= end; t += step) {
      const k = Math.floor(siderealLongitude(engine.swe, t, SEFLG_SWIEPH, graha, 'true').longitude / span);
      if (k !== prev) n++;
      prev = k;
    }
    return n;
  }

  it('pada ingresses of every graha over 2026 match an hourly scan (true node: every 5 min)', () => {
    const start = 2461041.5;
    const end = start + 365;
    engine.swe.setSidMode(1);
    const found = engine.events({ start: { jdTT: start }, end: { jdTT: end }, kinds: ['pada-ingress'] });
    for (const g of GRAHAS) {
      const step = g === 'rahu' || g === 'ketu' ? 5 / 1440 : 1 / 24;
      const brute = bruteCrossings(g, start, end, step, 10 / 3);
      const ours = found.filter((e) => e.kind === 'pada-ingress' && e.graha === g).length;
      expect(ours, g).toBe(brute);
    }
  });

  it('true-node speed reversals seen at the 3-hour step match a 15-minute scan over 3 years', () => {
    const start = 2461041.5;
    const end = start + 3 * 365;
    engine.swe.setSidMode(1);
    let brute = 0;
    let prev = Math.sign(siderealLongitude(engine.swe, start, SEFLG_SWIEPH, 'rahu', 'true').speed);
    for (let t = start + 15 / 1440; t <= end; t += 15 / 1440) {
      const s = Math.sign(siderealLongitude(engine.swe, t, SEFLG_SWIEPH, 'rahu', 'true').speed);
      if (s !== prev && s !== 0) brute++;
      if (s !== 0) prev = s;
    }
    // The finder splits the true node's ingress search at its speed reversals, found by
    // sampling the speed every 0.125 day (RATE_STEP in src/events/events.ts). That step must
    // see every reversal the 15-minute scan sees.
    const roots: number[] = [];
    const step = 0.125;
    let t0 = start;
    let v0 = siderealLongitude(engine.swe, t0, SEFLG_SWIEPH, 'rahu', 'true').speed;
    for (let t1 = start + step; t1 <= end; t1 += step) {
      const v1 = siderealLongitude(engine.swe, t1, SEFLG_SWIEPH, 'rahu', 'true').speed;
      if (Math.sign(v0) !== Math.sign(v1)) roots.push(t1);
      t0 = t1;
      v0 = v1;
    }
    expect(roots.length).toBe(brute);
    console.log(`true node: ${brute} speed reversals in 3 years`);
  });
});

describe('new and full moons against NASA', () => {
  const phases = fixture<{ phases: Array<{ kind: 'new' | 'full'; ut: string }> }>('nasa-phases.json').phases;

  it('agree within 60 s for 2010–2011', () => {
    const found = engine.events({ start: { unixMs: Date.parse('2010-01-01T00:00:00Z') }, end: { unixMs: Date.parse('2012-01-01T00:00:00Z') }, kinds: ['new-moon', 'full-moon'] });
    let worst = 0;
    for (const p of phases) {
      const ref = Date.parse(p.ut);
      const ours = found.filter((e) => e.kind === `${p.kind}-moon`).map((e) => engine.unixMs(e.instant));
      const nearest = ours.reduce((a, b) => (Math.abs(b - ref) < Math.abs(a - ref) ? b : a));
      const d = (nearest - ref) / 1000;
      worst = Math.max(worst, Math.abs(d));
      expect(Math.abs(d), `${p.kind} ${p.ut}`).toBeLessThanOrEqual(60);
    }
    expect(found.filter((e) => e.kind === 'new-moon').length + found.filter((e) => e.kind === 'full-moon').length).toBeGreaterThanOrEqual(phases.length - 1);
    console.log(`${phases.length} lunar phases; worst ${worst.toFixed(1)} s from NASA's minute`);
  });
});

describe('next events', () => {
  it('returns the next five events after an instant, in order, all after it', () => {
    const t = { unixMs: Date.parse('2026-10-02T15:37:42Z') };
    const start = engine.instant(t).jdTT;
    const next = engine.nextEvents(t, 5);
    expect(next).toHaveLength(5);
    for (let i = 0; i < next.length; i++) {
      expect(next[i]!.instant.jdTT).toBeGreaterThanOrEqual(start);
      if (i) expect(next[i]!.instant.jdTT).toBeGreaterThanOrEqual(next[i - 1]!.instant.jdTT);
    }
    expect(SECOND).toBe(1 / 86400);
  });
});
