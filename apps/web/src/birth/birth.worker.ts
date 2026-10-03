/**
 * The birth worker: place search, coordinates → zone, and the clock question, all off the
 * main thread. The zone table (~0.6 MB) loads on the first request; the place index
 * (~15 MB of text, ~7 MB compressed) on the first search or coordinate lookup. The service
 * worker caches each file the first time it is fetched (vite.config.ts).
 */
import tzlookup from '@photostructure/tz-lookup';
import { canonicalZone, PlaceIndex, resolveBirthTime, type ZoneTable } from '@aletheia/birth';
import zonesUrl from '@aletheia/birth/data/zones.json?url';
import indiaUrl from '@aletheia/birth/data/places-india.txt?url';
import worldUrl from '@aletheia/birth/data/places-world.txt?url';
import type { BirthMethods, BirthRequest, BirthResponse } from './birth-protocol.ts';

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not load ${url}: HTTP ${res.status}`);
  return res;
}

let zones: Promise<ZoneTable> | null = null;
let places: Promise<PlaceIndex> | null = null;
const zoneTable = () => (zones ??= fetchOk(zonesUrl).then((r) => r.json() as Promise<ZoneTable>));
const placeIndex = () =>
  (places ??= Promise.all([fetchOk(indiaUrl).then((r) => r.text()), fetchOk(worldUrl).then((r) => r.text())]).then(([a, b]) => PlaceIndex.parse(a, b)));

const methods: { [M in keyof BirthMethods]: (p: BirthMethods[M]['params']) => Promise<BirthMethods[M]['result']> } = {
  async search({ query, limit }) {
    const index = await placeIndex();
    return { matches: index.search(query, limit), source: index.source };
  },
  async locate({ latitude, longitude }) {
    const [index, table] = await Promise.all([placeIndex(), zoneTable()]);
    const zone = canonicalZone(table, tzlookup(latitude, longitude));
    return { zone, nearest: index.nearest(latitude, longitude) };
  },
  async resolve({ local, place }) {
    return resolveBirthTime(await zoneTable(), local, place);
  },
  async zoneInfo() {
    const t = await zoneTable();
    return { tzdb: t.tzdb, source: t.source };
  },
};

self.addEventListener('message', (e: MessageEvent<BirthRequest>) => {
  const { id, method, params } = e.data;
  (methods[method] as (p: unknown) => Promise<unknown>)(params).then(
    (result) => self.postMessage({ id, ok: true, result } satisfies BirthResponse),
    (err: unknown) => self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies BirthResponse),
  );
});
