/**
 * The optional online fallback: OpenStreetMap's Nominatim, used only after the owner says
 * yes, and only within its usage policy (operations.osmfoundation.org/policies/nominatim):
 * - one request at a time, at most one a second, and only on an explicit search (no
 *   search-as-you-type);
 * - the browser identifies the app by its Referer;
 * - results are cached for the session, so a repeated search is not sent again;
 * - the data are shown with "© OpenStreetMap contributors" (ODbL).
 * What is sent: the words typed into the search box. Nothing else.
 */

export const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors, ODbL';
const CONSENT_KEY = 'aletheia.consent.openstreetmap';

export interface OsmPlace {
  name: string;
  /** Nominatim's full display name. */
  display: string;
  latitude: number;
  longitude: number;
  /** "node/123", "way/456" or "relation/789". */
  osm: string;
}

export function hasConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) !== null;
  } catch {
    return false;
  }
}

export function giveConsent(now = new Date()): void {
  localStorage.setItem(CONSENT_KEY, now.toISOString());
}

const cache = new Map<string, OsmPlace[]>();
let last = 0;
let queue: Promise<unknown> = Promise.resolve();

export function searchOsm(query: string, fetchFn: typeof fetch = fetch, now = () => Date.now(), wait = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<OsmPlace[]> {
  if (!hasConsent()) return Promise.reject(new Error('OpenStreetMap search needs the owner’s consent'));
  const q = query.trim();
  const hit = cache.get(q.toLowerCase());
  if (hit) return Promise.resolve(hit);
  const run = queue.then(async () => {
    const gap = last + 1000 - now();
    if (gap > 0) await wait(gap);
    last = now();
    const url = `${NOMINATIM}?${new URLSearchParams({ q, format: 'jsonv2', limit: '10', 'accept-language': 'en' })}`;
    const res = await fetchFn(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`OpenStreetMap search failed: HTTP ${res.status}`);
    const rows = (await res.json()) as Array<{ name?: string; display_name: string; lat: string; lon: string; osm_type: string; osm_id: number }>;
    const out = rows.map((r) => ({ name: r.name || r.display_name.split(',')[0]!, display: r.display_name, latitude: Number(r.lat), longitude: Number(r.lon), osm: `${r.osm_type}/${r.osm_id}` }));
    cache.set(q.toLowerCase(), out);
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}
