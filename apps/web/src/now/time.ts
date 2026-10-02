/** Local civil time helpers for the Now screen. Pure functions, no rounding of the instant. */

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 24-hour local clock, to the second: "21:07:05". Seconds are truncated, never rounded up. */
export function formatClock(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** Offset of local civil time from UTC: "UTC+05:30", "UTC−03:00", "UTC+00:00". */
export function formatUtcOffset(d: Date): string {
  const minutesEast = -d.getTimezoneOffset();
  const sign = minutesEast < 0 ? '−' : '+';
  const abs = Math.abs(minutesEast);
  return `UTC${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

/** Long local date in the reader's locale: "Friday, 2 October 2026". */
export function formatLongDate(d: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/** Milliseconds until the next whole second of the given instant. Always in (0, 1000]. */
export function msToNextSecond(epochMs: number): number {
  const into = ((epochMs % 1000) + 1000) % 1000;
  return 1000 - into;
}
