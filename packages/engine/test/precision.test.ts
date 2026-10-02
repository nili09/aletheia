import { describe, expect, it } from 'vitest';
import { precisionForYear } from '../src/index.ts';

describe('precisionForYear', () => {
  it('is full at and inside the 1800–2400 boundaries', () => {
    expect(precisionForYear(1800)).toBe('full');
    expect(precisionForYear(2026)).toBe('full');
    expect(precisionForYear(2400)).toBe('full');
  });

  it('is reduced just outside the boundaries', () => {
    expect(precisionForYear(1799)).toBe('reduced');
    expect(precisionForYear(2401)).toBe('reduced');
    expect(precisionForYear(-3101)).toBe('reduced');
  });

  it('rejects non-integer years loudly', () => {
    expect(() => precisionForYear(2000.5)).toThrow(RangeError);
    expect(() => precisionForYear(Number.NaN)).toThrow(RangeError);
  });
});
