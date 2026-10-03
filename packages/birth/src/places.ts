/**
 * The offline place index (GeoNames, CC BY 4.0): every populated place in India, and towns
 * of 5,000 people or more elsewhere. scripts/build-places.mjs describes the file format.
 *
 * Search is a scan of every name and alternate name (about 600 000), fast enough in a
 * worker and with no index to build: exact names first, then names starting with the
 * query, then names with a word starting with it; within each, larger places first. A
 * query "Rampur, Bareilly" also requires the district, state or country to match.
 */

export interface Region {
  country: string;
  /** GeoNames admin codes. */
  admin1: string;
  admin2: string;
  countryName: string;
  admin1Name: string;
  admin2Name: string;
}

export interface IndexedPlace {
  name: string;
  region: Region;
  /** Degrees, exactly as GeoNames gives them. */
  latitude: number;
  longitude: number;
  zone: string;
  /** Metres, GeoNames' elevation model value; undefined where it has none. */
  elevation?: number;
  /** 9 capital … 5 lower administrative seat, 0 other. */
  rank: number;
  population: number;
  geonameId?: number;
}

export interface PlaceMatch {
  place: IndexedPlace;
  /** The alternate name that matched, if not the place's own name. */
  alias?: string;
}

/** Search key: no diacritics, lower case, letters and digits separated by single spaces (as the build script). */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export class PlaceIndex {
  readonly places: IndexedPlace[] = [];
  private readonly keys: string[] = [];
  private readonly alias: { key: string; name: string; place: number }[] = [];
  private regionKeys = new Map<Region, string>();
  source = '';

  /** Parse one or more index files (their places are numbered per file). */
  static parse(...texts: string[]): PlaceIndex {
    const index = new PlaceIndex();
    for (const t of texts) index.add(t);
    return index;
  }

  private add(text: string): void {
    const lines = text.split('\n');
    if (lines[0] !== '#aletheia-places 1') throw new Error('not an Aletheia place index (version 1)');
    const base = this.places.length;
    let zones: string[] = [];
    let region: Region | null = null;
    let lat0 = 0;
    let lon0 = 0;
    let lat = 0;
    let zone = '';
    for (const line of lines) {
      if (!line) continue;
      const f = line.split('\t');
      switch (f[0]) {
        case '#zones':
          zones = f.slice(1);
          break;
        case 'R':
          region = { country: f[1]!, admin1: f[2]!, admin2: f[3]!, countryName: f[4]!, admin1Name: f[5]!, admin2Name: f[6]! };
          this.regionKeys.set(region, fold([region.admin2Name, region.admin1Name, region.countryName].join(' ')));
          lat0 = int(f[7]!);
          lon0 = int(f[8]!);
          lat = lat0;
          break;
        case 'P': {
          if (!region) throw new Error('place before its region');
          lat += int(f[2]!);
          if (f[4]) zone = zones[int(f[4])]!;
          const p: IndexedPlace = { name: f[1]!, region, latitude: lat / 1e5, longitude: (lon0 + int(f[3]!)) / 1e5, zone, rank: f[6] ? Number(f[6]) : 0, population: f[7] ? int(f[7]) : 0 };
          if (f[5]) p.elevation = int(f[5]);
          if (f[8]) p.geonameId = int(f[8]);
          this.places.push(p);
          this.keys.push(fold(p.name));
          break;
        }
        case 'A':
          this.alias.push({ key: fold(f[1]!), name: f[1]!, place: base + int(f[2]!) });
          break;
        default:
          if (line.startsWith('#source ')) this.source += (this.source ? '; ' : '') + line.slice(8);
          else if (!line.startsWith('#')) throw new Error(`unreadable line: ${line.slice(0, 40)}`);
      }
    }
  }

  get size(): number {
    return this.places.length;
  }

  search(query: string, limit = 20): PlaceMatch[] {
    const [head = '', ...rest] = query.split(',');
    const q = fold(head);
    if (!q) return [];
    const within = rest.map(fold).filter(Boolean);
    const inRegion = (p: IndexedPlace) => within.every((w) => wordPrefix(this.regionKeys.get(p.region)!, w));
    const best = new Map<number, { score: number; alias?: string }>();
    const consider = (i: number, key: string, alias?: string) => {
      const score = key === q ? 3 : key.startsWith(q) ? 2 : key.includes(' ' + q) ? 1 : 0;
      if (!score || !inRegion(this.places[i]!)) return;
      const prev = best.get(i);
      if (!prev || score > prev.score) best.set(i, alias === undefined ? { score } : { score, alias });
    };
    for (let i = 0; i < this.keys.length; i++) {
      const k = this.keys[i]!;
      if (k.startsWith(q) || k.includes(' ' + q)) consider(i, k);
    }
    for (const a of this.alias) if (a.key.includes(q)) consider(a.place, a.key, a.name);
    return [...best]
      .sort(([i, a], [j, b]) => b.score - a.score || this.places[j]!.rank - this.places[i]!.rank || this.places[j]!.population - this.places[i]!.population || (this.places[i]!.name < this.places[j]!.name ? -1 : 1))
      .slice(0, limit)
      .map(([i, m]) => (m.alias === undefined ? { place: this.places[i]! } : { place: this.places[i]!, alias: m.alias }));
  }

  /** The indexed place nearest a point, and its distance in km (great circle, mean Earth radius). */
  nearest(latitude: number, longitude: number): { place: IndexedPlace; km: number } {
    let best = -1;
    let bestD = Infinity;
    const cos = Math.cos((latitude * Math.PI) / 180);
    for (let i = 0; i < this.places.length; i++) {
      const p = this.places[i]!;
      const dy = p.latitude - latitude;
      const dx = wrap180(p.longitude - longitude) * cos;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) throw new Error('empty place index');
    const place = this.places[best]!;
    return { place, km: haversineKm(latitude, longitude, place.latitude, place.longitude) };
  }
}

const int = (s: string) => parseInt(s, 36);
const wrap180 = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;
const wordPrefix = (key: string, w: string) => key.startsWith(w) || key.includes(' ' + w);

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** "Bareilly, Uttar Pradesh" in India; "Île-de-France, France" elsewhere. */
export function regionLabel(r: Region): string {
  const parts = r.country === 'IN' ? [r.admin2Name, r.admin1Name] : [r.admin1Name, r.countryName];
  return parts.filter(Boolean).join(', ') || r.countryName;
}
