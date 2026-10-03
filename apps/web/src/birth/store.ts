/**
 * Saved charts, on this device only: IndexedDB database "aletheia", store "charts".
 * Nothing here leaves the device; export writes a file the owner saves themselves.
 */
import type { LocalTime } from '@aletheia/birth';

export const TIME_QUALITIES = {
  certificate: 'Birth certificate',
  family: 'Family memory',
  rectified: 'Rectified',
  unknown: 'Unknown',
} as const;
export type TimeQuality = keyof typeof TIME_QUALITIES;

export interface SavedPlace {
  name: string;
  /** District and state, or province and country. */
  region: string;
  latitude: number;
  longitude: number;
  /** Metres; from GeoNames' elevation model when known. */
  elevation?: number;
  zone: string;
  country?: string;
  admin1?: string;
  admin2?: string;
  source: 'geonames' | 'openstreetmap' | 'coordinates';
  geonameId?: number;
  osm?: string;
  /** For coordinates and OpenStreetMap places: the nearest indexed place, which gave the region codes. */
  nearest?: { name: string; region: string; km: number };
}

export interface SavedChart {
  id: string;
  label: string;
  quality: TimeQuality;
  /** The birth time as written. */
  local: LocalTime;
  place: SavedPlace;
  /** The clock the time was read on, as chosen. */
  clock: { id: string; name: string; offsetSeconds: number };
  /** The birth instant, Unix milliseconds (UTC). */
  unixMs: number;
  tzdb: string;
  created: string;
  updated: string;
}

const DB = 'aletheia';
const STORE = 'charts';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req ? req.result : undefined);
    };
    t.onerror = t.onabort = () => {
      db.close();
      reject(t.error);
    };
  });
}

export async function listCharts(): Promise<SavedChart[]> {
  const all = ((await tx('readonly', (s) => s.getAll())) ?? []) as SavedChart[];
  return all.sort((a, b) => (a.created < b.created ? 1 : -1));
}

export async function saveCharts(charts: SavedChart[]): Promise<void> {
  await tx('readwrite', (s) => {
    for (const c of charts) s.put(c);
  });
}

/** Ask the browser not to clear this site's storage under pressure. Returns whether it is persistent. */
export async function persist(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return (await navigator.storage.persisted()) || navigator.storage.persist();
}

export async function persisted(): Promise<boolean> {
  return (await navigator.storage?.persisted?.()) ?? false;
}

// ---------- export and import ----------

export const EXPORT_FORMAT = 'aletheia-charts';

export function exportFile(charts: SavedChart[], now = new Date()): { name: string; text: string } {
  return {
    name: `aletheia-charts-${now.toISOString().slice(0, 10)}.json`,
    text: JSON.stringify({ format: EXPORT_FORMAT, version: 1, exported: now.toISOString(), charts }, null, 1) + '\n',
  };
}

/** The charts of an export file, checked field by field; throws on anything else. */
export function parseExport(text: string): SavedChart[] {
  const data = JSON.parse(text) as { format?: unknown; version?: unknown; charts?: unknown };
  if (data.format !== EXPORT_FORMAT || data.version !== 1 || !Array.isArray(data.charts)) throw new Error('not an Aletheia charts file (version 1)');
  return data.charts.map((c: unknown, i: number) => {
    if (!isChart(c)) throw new Error(`chart ${i + 1} is incomplete or malformed`);
    return c;
  });
}

const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
const str = (x: unknown) => typeof x === 'string';

function isChart(c: unknown): c is SavedChart {
  const x = c as SavedChart;
  return (
    !!x && str(x.id) && str(x.label) && x.quality in TIME_QUALITIES && num(x.unixMs) && str(x.tzdb) && str(x.created) && str(x.updated) &&
    !!x.local && ['year', 'month', 'day', 'hour', 'minute', 'second'].every((k) => num(x.local[k as keyof LocalTime])) &&
    !!x.place && str(x.place.name) && str(x.place.region) && num(x.place.latitude) && Math.abs(x.place.latitude) <= 90 && num(x.place.longitude) && Math.abs(x.place.longitude) <= 180 && str(x.place.zone) &&
    ['geonames', 'openstreetmap', 'coordinates'].includes(x.place.source) &&
    !!x.clock && str(x.clock.id) && str(x.clock.name) && num(x.clock.offsetSeconds)
  );
}
