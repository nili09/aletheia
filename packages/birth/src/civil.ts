/**
 * From a birth time as written (a wall-clock reading at a place) to the instants it can mean.
 *
 * - In India (zone Asia/Kolkata) the clocks come from india.ts, which replaces the tzdb.
 * - Elsewhere the tzdb decides; a reading the clock showed twice (clocks went back) or never
 *   (clocks jumped forward) has two possible instants.
 * - Any birth may instead be read on local mean time or on a stated UTC offset.
 *
 * More than one option means the person entering the birth must choose; nothing is picked
 * silently.
 */
import { indianClocks, indianRegion, SOURCES as INDIA_SOURCES, type SourceId } from './india.ts';
import { assertLocalTime, canonicalZone, localSeconds, offsetAt, resolveInZone, type LocalTime, type ZoneTable } from './zones.ts';

export interface BirthPlace {
  latitude: number;
  longitude: number;
  /** IANA zone name. */
  zone: string;
  /** GeoNames admin codes (state, district), used for India's city clocks. */
  admin1?: string;
  admin2?: string;
}

export interface ClockOption {
  /** Stable id, saved with the chart: an India clock id, 'zone', 'zone-earlier', 'zone-later', 'zone-old', 'zone-new', 'lmt' or 'custom'. */
  id: string;
  name: string;
  /** Seconds east of UTC. */
  offsetSeconds: number;
  /** The instant, Unix milliseconds (UTC). */
  unixMs: number;
  note: string;
  sources: string[];
}

export interface TimeResolution {
  ambiguous: boolean;
  why: string;
  options: ClockOption[];
  zone: string;
  tzdb: string;
  /** The tzdb's own offset(s) for the reading in this zone, for comparison (empty outside the table). */
  tzdbOffsets: number[];
}

const sources = (ids: readonly SourceId[]) => ids.map((s) => INDIA_SOURCES[s]);

export function resolveBirthTime(table: ZoneTable, local: LocalTime, place: BirthPlace): TimeResolution {
  assertLocalTime(local);
  const zone = canonicalZone(table, place.zone);
  const L = localSeconds(local);
  const tz = tryResolveInZone(table, zone, local);
  const tzdbOffsets = tz?.readings.map((r) => r.offsetSeconds) ?? [];
  const tzdbSource = `IANA tzdb ${table.tzdb}, zone ${zone}`;

  if (zone === 'Asia/Kolkata') {
    const india = indianClocks(local, place.longitude, indianRegion(place.admin1, place.admin2, place.latitude, place.longitude));
    return {
      ambiguous: india.ambiguous,
      why: india.why,
      options: india.clocks.map((c) => ({ id: c.id, name: c.name, offsetSeconds: c.offsetSeconds, unixMs: (L - c.offsetSeconds) * 1000, note: c.note, sources: sources(c.sources) })),
      zone,
      tzdb: table.tzdb,
      tzdbOffsets,
    };
  }
  if (!tz) throw new RangeError(`the zone table covers 1800–2099; read this birth on local mean time or a stated UTC offset`);
  const names =
    tz.kind === 'unique'
      ? [['zone', zone, 'The zone’s offset at the time, daylight saving included.']]
      : tz.kind === 'fold'
        ? [
            ['zone-earlier', 'First time (before the clocks went back)', 'The clocks went back an hour: this reading happened twice.'],
            ['zone-later', 'Second time (after the clocks went back)', 'The clocks went back an hour: this reading happened twice.'],
          ]
        : [
            ['zone-old', 'On the clock before the change', 'The clocks jumped forward over this reading: no clock showed it.'],
            ['zone-new', 'On the clock after the change', 'The clocks jumped forward over this reading: no clock showed it.'],
          ];
  return {
    ambiguous: tz.kind !== 'unique',
    why: tz.kind === 'unique' ? '' : names[0]![2]!,
    options: tz.readings.map((r, i) => ({ id: names[i]![0]!, name: names[i]![1]!, offsetSeconds: r.offsetSeconds, unixMs: r.unixSeconds * 1000, note: names[i]![2]!, sources: [tzdbSource] })),
    zone,
    tzdb: table.tzdb,
    tzdbOffsets,
  };
}

function tryResolveInZone(table: ZoneTable, zone: string, local: LocalTime) {
  try {
    return resolveInZone(table, zone, local);
  } catch (e) {
    if (e instanceof RangeError && /covers/.test(e.message)) return null;
    throw e;
  }
}

/** The reading on the birthplace's local mean time. */
export function lmtOption(local: LocalTime, longitude: number): ClockOption {
  const offsetSeconds = longitude * 240;
  return {
    id: 'lmt',
    name: 'Local mean time',
    offsetSeconds,
    unixMs: (localSeconds(local) - offsetSeconds) * 1000,
    note: 'The mean solar time of the birthplace.',
    sources: [INDIA_SOURCES.lmt],
  };
}

/** The reading on a stated offset from UTC (seconds east). */
export function customOption(local: LocalTime, offsetSeconds: number): ClockOption {
  if (!(Math.abs(offsetSeconds) <= 26 * 3600)) throw new RangeError(`UTC offset out of range: ${offsetSeconds} s`);
  return {
    id: 'custom',
    name: `UTC${formatOffset(offsetSeconds)}`,
    offsetSeconds,
    unixMs: (localSeconds(local) - offsetSeconds) * 1000,
    note: 'An offset stated by the person entering the birth.',
    sources: ['Entered by hand'],
  };
}

/** "+05:30", "−04:51", "+05:53:20", "+04:51:31.2" (seconds only when present). */
export function formatOffset(seconds: number): string {
  const sign = seconds < 0 ? '−' : '+';
  const a = Math.abs(seconds);
  const h = Math.floor(a / 3600);
  const m = Math.floor((a % 3600) / 60);
  const s = a - h * 3600 - m * 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const sec = s === 0 ? '' : `:${Number.isInteger(s) ? pad(s) : s.toFixed(1).padStart(4, '0')}`;
  return `${sign}${pad(h)}:${pad(m)}${sec}`;
}

/** The zone's offset at an instant, or null outside the table. */
export function zoneOffset(table: ZoneTable, zone: string, unixMs: number): number | null {
  const t = unixMs / 1000;
  return t >= table.range[0] && t < table.range[1] ? offsetAt(table, zone, t) : null;
}
