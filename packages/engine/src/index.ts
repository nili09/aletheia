/**
 * @aletheia/engine — pure, deterministic calculation library.
 *
 * No UI code lives here. The Swiss Ephemeris (WebAssembly build) will be
 * wrapped in this package; until then it only carries rules that need no
 * ephemeris.
 */

export { precisionForYear, FULL_PRECISION_YEARS } from './precision.ts';
export type { Precision } from './precision.ts';
