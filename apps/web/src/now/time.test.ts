import { describe, expect, it } from 'vitest';
import { formatClock, formatUtcOffset, msToNextSecond } from './time.ts';

describe('formatClock', () => {
  it('pads every field to two digits', () => {
    expect(formatClock(new Date(2026, 9, 2, 7, 3, 9))).toBe('07:03:09');
  });

  it('truncates, never rounds, the seconds', () => {
    expect(formatClock(new Date(2026, 9, 2, 23, 59, 59, 999))).toBe('23:59:59');
  });
});

describe('formatUtcOffset', () => {
  const at = (offsetMinutesWest: number) =>
    ({ getTimezoneOffset: () => offsetMinutesWest }) as Date;

  it('formats half-hour zones east of Greenwich', () => {
    expect(formatUtcOffset(at(-330))).toBe('UTC+05:30');
  });

  it('formats zones west of Greenwich with a true minus sign', () => {
    expect(formatUtcOffset(at(180))).toBe('UTC−03:00');
  });

  it('formats UTC itself as positive zero', () => {
    expect(formatUtcOffset(at(0))).toBe('UTC+00:00');
  });

  it('formats quarter-hour zones (Nepal, Chatham)', () => {
    expect(formatUtcOffset(at(-345))).toBe('UTC+05:45');
    expect(formatUtcOffset(at(-825))).toBe('UTC+13:45');
  });
});

describe('msToNextSecond', () => {
  it('waits the remainder of the current second', () => {
    expect(msToNextSecond(1_000_250)).toBe(750);
  });

  it('waits a full second when exactly on a boundary', () => {
    expect(msToNextSecond(1_000_000)).toBe(1000);
  });

  it('handles instants before 1970', () => {
    expect(msToNextSecond(-250)).toBe(250);
  });
});
