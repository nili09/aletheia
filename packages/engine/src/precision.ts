/**
 * Honest precision labelling (CLAUDE.md, "Priority zero"):
 * results for dates outside 1800–2400 are marked reduced precision.
 */

export type Precision = 'full' | 'reduced';

/** Inclusive range of years, astronomical numbering, given full precision. */
export const FULL_PRECISION_YEARS = { first: 1800, last: 2400 } as const;

export function precisionForYear(year: number): Precision {
  if (!Number.isInteger(year)) {
    throw new RangeError(`year must be an integer, got ${year}`);
  }
  return year >= FULL_PRECISION_YEARS.first && year <= FULL_PRECISION_YEARS.last
    ? 'full'
    : 'reduced';
}
