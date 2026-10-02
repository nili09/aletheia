/**
 * Root finding for the event finder: bracket a crossing by sampling, then refine it with
 * Brent's method (R. P. Brent, "Algorithms for Minimization without Derivatives", 1973,
 * ch. 4, procedure zero), which combines bisection, secant and inverse quadratic
 * interpolation and never leaves the bracket.
 *
 * Times are Julian days. The default tolerance, 1e-8 day (0.86 ms), is well inside the
 * 1-second requirement; a Julian day near 2.46 million is resolved to 40 µs by a double.
 */

export const SECOND = 1 / 86400;
export const DEFAULT_TOLERANCE = 1e-8;

/** Wrap an angle difference to [-180, 180). */
export function wrap180(x: number): number {
  const y = (((x + 180) % 360) + 360) % 360;
  return y - 180;
}

/**
 * Brent's zero: a root of f in [a, b], given f(a) and f(b) of opposite sign (or one zero).
 * Converges to within tol (days).
 */
export function brent(f: (t: number) => number, a: number, b: number, fa: number, fb: number, tol = DEFAULT_TOLERANCE): number {
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (Math.sign(fa) === Math.sign(fb)) throw new RangeError('brent: root is not bracketed');
  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;
  for (let iter = 0; iter < 200; iter++) {
    if (Math.sign(fb) === Math.sign(fc)) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + 0.5 * tol;
    const m = 0.5 * (c - b);
    if (Math.abs(m) <= tol1 || fb === 0) return b;
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      // Interpolation: secant if a == c, else inverse quadratic.
      const s = fb / fa;
      let p: number;
      let q: number;
      if (a === c) {
        p = 2 * m * s;
        q = 1 - s;
      } else {
        const qa = fa / fc;
        const r = fb / fc;
        p = s * (2 * m * qa * (qa - r) - (b - a) * (r - 1));
        q = (qa - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q;
      else p = -p;
      if (2 * p < Math.min(3 * m * q - Math.abs(tol1 * q), Math.abs(e * q))) {
        e = d;
        d = p / q;
      } else {
        d = m;
        e = d;
      }
    } else {
      d = m;
      e = d;
    }
    a = b;
    fa = fb;
    b += Math.abs(d) > tol1 ? d : m > 0 ? tol1 : -tol1;
    fb = f(b);
  }
  throw new Error('brent: no convergence in 200 iterations');
}

export interface CrossingOptions {
  /** Sampling step in days. It must be short enough that f crosses the target at most once per step. */
  step: number;
  /** Treat f as an angle in degrees: crossings are of target mod 360. */
  angular?: boolean;
  /** Extra sample points (for example stationary points) that must be bracket ends. */
  splitAt?: readonly number[];
  /** Root tolerance in days (default 1e-8). */
  tolerance?: number;
}

/**
 * All times in [start, end) at which f crosses target. Brackets by sampling every
 * options.step days (plus the split points), then refines each bracket with Brent.
 *
 * For angular functions, the residual is wrap180(f − target); a jump of the residual from
 * about +180 to −180 is the far side of the circle, not a crossing, and is skipped.
 */
export function findCrossings(f: (t: number) => number, target: number, start: number, end: number, options: CrossingOptions): number[] {
  const { step, angular = false, splitAt = [], tolerance = DEFAULT_TOLERANCE } = options;
  if (!(end > start)) throw new RangeError('findCrossings: end must be after start');
  if (!(step > 0)) throw new RangeError('findCrossings: step must be positive');
  const g = angular ? (t: number) => wrap180(f(t) - target) : (t: number) => f(t) - target;
  const times = samplePoints(start, end, step, splitAt);
  const roots: number[] = [];
  let t0 = times[0]!;
  let g0 = g(t0);
  for (let i = 1; i < times.length; i++) {
    const t1 = times[i]!;
    const g1 = g(t1);
    const crosses = g0 === 0 || (Math.sign(g0) !== Math.sign(g1) && g1 !== 0);
    if (crosses && (!angular || Math.abs(g0 - g1) < 180)) {
      const r = brent(g, t0, t1, g0, g1, tolerance);
      if (r >= start && r < end) roots.push(r);
    }
    t0 = t1;
    g0 = g1;
  }
  return roots;
}

/** The first crossing in [start, end), or null. */
export function findCrossing(f: (t: number) => number, target: number, start: number, end: number, options: CrossingOptions): number | null {
  return findCrossings(f, target, start, end, options)[0] ?? null;
}

/** start, start + step, …, end, merged with the split points inside (start, end), sorted, unique. */
export function samplePoints(start: number, end: number, step: number, splitAt: readonly number[] = []): number[] {
  const n = Math.ceil((end - start) / step);
  const pts: number[] = [];
  for (let i = 0; i < n; i++) pts.push(start + i * step);
  pts.push(end);
  for (const s of splitAt) if (s > start && s < end) pts.push(s);
  pts.sort((x, y) => x - y);
  return pts.filter((x, i) => i === 0 || x !== pts[i - 1]);
}
