/**
 * Honest precision labelling (CLAUDE.md, "Priority zero"): results are full precision only
 * where the shipped Swiss Ephemeris files cover the instant; elsewhere the engine uses the
 * Moshier analytic ephemeris and marks the result reduced precision.
 *
 * The shipped files are sepl_18.se1 (planets) and semo_18.se1 (Moon), generated from JPL
 * DE441. Their real coverage, read from the files themselves, is narrower than the nominal
 * "1800–2400": it starts on 1800-01-02 0h TT and ends on 2400-01-10 ~20:37 TT.
 *
 * Full precision starts one day after the files do. An apparent position looks back by the
 * light-time (measured: up to 1.14 h, Saturn), so the first hours of the file cannot give
 * every graha; one day covers that with a wide margin. At the end nothing looks forward,
 * and every graha computes up to the file's last instant. test/coverage.test.ts checks
 * both bounds against the files.
 */

export type Precision = 'full' | 'reduced';

/** First and last Julian day (TT) of full precision. */
export const FULL_PRECISION_JD_TT = {
  /** 1800-01-03 00:00 TT: one day after sepl_18.se1 starts (semo_18.se1 starts 9 days earlier). */
  first: 2378497.5,
  /** 2400-01-10 ~20:37 TT, end of sepl_18.se1 (semo_18.se1 ends 5 days later). */
  last: 2597651.3591467496,
} as const;

export function precisionForJdTT(jdTT: number): Precision {
  if (!Number.isFinite(jdTT)) throw new RangeError(`Julian day must be finite, got ${jdTT}`);
  return jdTT >= FULL_PRECISION_JD_TT.first && jdTT <= FULL_PRECISION_JD_TT.last ? 'full' : 'reduced';
}
