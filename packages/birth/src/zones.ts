/**
 * IANA time zones: the UTC offset of a zone at an instant, and the instants a local clock
 * reading can mean.
 *
 * The table (data/zones.json, scripts/build-zones.py) holds every zone's offset changes
 * from 1800 to 2100 to the second, from the tzdb compiled by zic. Offsets include daylight
 * saving and war time where the tzdb records them. Outside the table's range nothing is
 * guessed: the functions throw, and the caller must ask for the clock.
 */

export interface ZoneTable {
  source: string;
  tzdb: string;
  /** Unix seconds: the table covers [range[0], range[1]). */
  range: [number, number];
  /** zone → [offset at range start, t1, offset from t1, t2, offset from t2, …], seconds. */
  zones: Record<string, number[]>;
  /** Backward-compatible name → zone. */
  links: Record<string, string>;
}

/** A reading of a wall clock: proleptic Gregorian calendar, 24-hour time. */
export interface LocalTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The zone a name refers to (following a backward-compatible link). */
export function canonicalZone(table: ZoneTable, name: string): string {
  if (table.zones[name]) return name;
  const target = table.links[name];
  if (target && table.zones[target]) return target;
  throw new RangeError(`unknown time zone ${name}`);
}

function inRange(table: ZoneTable, unixSeconds: number): void {
  if (!(unixSeconds >= table.range[0] && unixSeconds < table.range[1])) {
    throw new RangeError(`the zone table (tzdb ${table.tzdb}) covers 1800–2099; ${new Date(unixSeconds * 1000).toISOString()} is outside it`);
  }
}

/** UTC offset in seconds (east positive) of a zone at a Unix time in seconds. */
export function offsetAt(table: ZoneTable, zone: string, unixSeconds: number): number {
  inRange(table, unixSeconds);
  const seq = table.zones[canonicalZone(table, zone)]!;
  // Binary search over the change times at odd indices.
  let lo = 0;
  let hi = (seq.length - 1) / 2; // number of changes
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (seq[2 * mid - 1]! <= unixSeconds) lo = mid;
    else hi = mid - 1;
  }
  return seq[2 * lo]!;
}

/** Seconds of a wall-clock reading counted as if it were UTC (the reading's own scale). */
export function localSeconds(l: LocalTime): number {
  const ms = Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute, 0);
  // Date.UTC maps years 0–99 to 1900–1999; set the year explicitly.
  const d = new Date(ms);
  d.setUTCFullYear(l.year, l.month - 1, l.day);
  return d.getTime() / 1000 + l.second;
}

/** Reject impossible readings (31 April, 24:00, 61 seconds). */
export function assertLocalTime(l: LocalTime): void {
  const ok =
    Number.isInteger(l.year) && Number.isInteger(l.month) && Number.isInteger(l.day) && Number.isInteger(l.hour) && Number.isInteger(l.minute) &&
    l.month >= 1 && l.month <= 12 && l.hour >= 0 && l.hour <= 23 && l.minute >= 0 && l.minute <= 59 && l.second >= 0 && l.second < 60 &&
    l.day >= 1 && l.day <= daysInMonth(l.year, l.month);
  if (!ok) throw new RangeError(`not a valid date and time: ${JSON.stringify(l)}`);
}

export function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}

export interface ZoneReading {
  offsetSeconds: number;
  unixSeconds: number;
}

/**
 * The instants a wall-clock reading in a zone can mean:
 * - 'unique': one instant.
 * - 'fold': the clock went back and the reading happened twice (earlier first).
 * - 'gap': the clock jumped forward over the reading, so no clock showed it; each offset
 *   either side of the jump is offered (the reading on the old clock first).
 */
export function resolveInZone(table: ZoneTable, zone: string, local: LocalTime): { kind: 'unique' | 'fold' | 'gap'; readings: ZoneReading[] } {
  assertLocalTime(local);
  const L = localSeconds(local);
  // Every offset in force within two days of the reading (no zone's offset exceeds ±26 h).
  const offsets = new Set<number>();
  for (const t of [L - 2 * 86400, L - 86400, L, L + 86400, L + 2 * 86400]) offsets.add(offsetAt(table, zone, t));
  const seq = table.zones[canonicalZone(table, zone)]!;
  for (let i = 1; i < seq.length; i += 2) {
    if (Math.abs(seq[i]! - L) <= 2 * 86400) {
      offsets.add(seq[i - 1]!);
      offsets.add(seq[i + 1]!);
    }
  }
  const readings = [...offsets]
    .map((o) => ({ offsetSeconds: o, unixSeconds: L - o }))
    .filter((r) => offsetAt(table, zone, r.unixSeconds) === r.offsetSeconds)
    .sort((a, b) => a.unixSeconds - b.unixSeconds);
  if (readings.length === 1) return { kind: 'unique', readings };
  if (readings.length === 2) return { kind: 'fold', readings };
  if (readings.length > 2) throw new Error(`${zone}: ${readings.length} instants for one reading`);
  // A gap: the offsets before and after the change the reading falls in.
  const before = offsetAt(table, zone, L - Math.max(...offsets) - 1);
  const after = offsetAt(table, zone, L - Math.min(...offsets) + 1);
  return {
    kind: 'gap',
    readings: [before, after].map((o) => ({ offsetSeconds: o, unixSeconds: L - o })),
  };
}
