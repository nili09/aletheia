/**
 * New chart: the birth as written (date, time, place), the clock it was read on, and how
 * much the time can be trusted. When the clock is not certain (India's clock history, or a
 * daylight-saving change) the person chooses; each choice shows what it changes.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_JYOTISH } from '@aletheia/engine';
import { assertLocalTime, customOption, formatOffset, lmtOption, regionLabel, type ClockOption, type LocalTime, type PlaceMatch, type TimeResolution } from '@aletheia/birth';
import { engine } from '../engine/client.ts';
import { birth } from './client.ts';
import { compareText, localText, pointNames, utcText, type BirthPoint } from './format.ts';
import { giveConsent, hasConsent, OSM_ATTRIBUTION, searchOsm, type OsmPlace } from './nominatim.ts';
import { persist, saveCharts, TIME_QUALITIES, type SavedChart, type SavedPlace, type TimeQuality } from './store.ts';

type Fields = { day: string; month: string; year: string; hour: string; minute: string; second: string };
const EMPTY: Fields = { day: '', month: '', year: '', hour: '', minute: '', second: '' };

function toLocal(f: Fields): LocalTime | null {
  const n = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN);
  const l = { year: n(f.year), month: n(f.month), day: n(f.day), hour: n(f.hour), minute: n(f.minute), second: f.second.trim() ? n(f.second) : 0 };
  if (!(l.year >= 1 && l.year <= 9999)) return null;
  try {
    assertLocalTime(l);
    return l;
  } catch {
    return null;
  }
}

export default function BirthScreen({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState('');
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [place, setPlace] = useState<SavedPlace | null>(null);
  const [quality, setQuality] = useState<TimeQuality | null>(null);
  const [clockId, setClockId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const local = useMemo(() => toLocal(fields), [fields]);
  const [resolution, setResolution] = useState<TimeResolution | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [other, setOther] = useState(false);
  const [customText, setCustomText] = useState('');
  const [points, setPoints] = useState<Map<string, BirthPoint & { unixMs: number }>>(new Map());

  // The clocks this reading could have come from.
  useEffect(() => {
    setResolution(null);
    setResolveError(null);
    setClockId(null);
    if (!local || !place) return;
    let current = true;
    birth('resolve', { local, place: { latitude: place.latitude, longitude: place.longitude, zone: place.zone, ...(place.admin1 !== undefined && { admin1: place.admin1 }), ...(place.admin2 !== undefined && { admin2: place.admin2 }) } }).then(
      (r) => {
        if (!current) return;
        setResolution(r);
        if (!r.ambiguous) setClockId(r.options[0]!.id);
      },
      (e: unknown) => current && setResolveError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      current = false;
    };
  }, [local, place]);

  const options: ClockOption[] = useMemo(() => {
    if (!local || !place) return [];
    const out = [...(resolution?.options ?? [])];
    if (other || resolveError) {
      if (!out.some((o) => o.id === 'lmt')) out.push(lmtOption(local, place.longitude));
      const off = parseOffset(customText);
      if (off !== null) out.push(customOption(local, off));
    }
    return out;
  }, [resolution, resolveError, other, customText, local, place]);

  // What each reading makes of the chart (engine worker).
  useEffect(() => {
    if (!place || !options.length) return;
    let current = true;
    engine()
      .call('birthPoints', { times: options.map((o) => ({ unixMs: o.unixMs })), place: { latitude: place.latitude, longitude: place.longitude, altitude: place.elevation ?? 0 }, settings: DEFAULT_JYOTISH })
      .then(
        (ps) => current && setPoints(new Map(options.map((o, i) => [o.id, { ...ps[i]!, unixMs: o.unixMs }]))),
        (e: unknown) => current && setError(String(e)),
      );
    return () => {
      current = false;
    };
  }, [options, place]);

  const chosen = options.find((o) => o.id === clockId) ?? null;
  const ready = !!(label.trim() && local && place && chosen && quality);

  const save = async () => {
    if (!ready) return;
    const now = new Date().toISOString();
    const chart: SavedChart = {
      id: crypto.randomUUID(),
      label: label.trim(),
      quality: quality!,
      local: local!,
      place: place!,
      clock: { id: chosen!.id, name: chosen!.name, offsetSeconds: chosen!.offsetSeconds },
      unixMs: chosen!.unixMs,
      tzdb: resolution?.tzdb ?? (await birth('zoneInfo', {})).tzdb,
      created: now,
      updated: now,
    };
    try {
      await saveCharts([chart]);
      await persist();
      onSaved();
    } catch (e) {
      setError(`Could not save: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const set = (k: keyof Fields) => (e: { target: { value: string } }) => setFields((f) => ({ ...f, [k]: e.target.value }));
  const first = options[0] ? points.get(options[0].id) : undefined;

  return (
    <main className="page birth">
      <header className="truth-head">
        <button type="button" className="control" onClick={onClose}>
          Charts
        </button>
        <h1 className="truth-title">New chart</h1>
      </header>

      <section aria-labelledby="h-name">
        <h2 id="h-name">Name</h2>
        <input className="text wide" aria-labelledby="h-name" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Whose chart" autoComplete="off" />
      </section>

      <section aria-labelledby="h-when">
        <h2 id="h-when">
          Birth date and time <span className="conv">as written · 24-hour</span>
        </h2>
        <div className="inputs">
          <Num label="Day" value={fields.day} onChange={set('day')} max={2} />
          <Num label="Month" value={fields.month} onChange={set('month')} max={2} />
          <Num label="Year" value={fields.year} onChange={set('year')} max={4} />
        </div>
        <div className="inputs">
          <Num label="Hour" value={fields.hour} onChange={set('hour')} max={2} />
          <Num label="Minute" value={fields.minute} onChange={set('minute')} max={2} />
          <Num label="Second" value={fields.second} onChange={set('second')} max={2} optional />
        </div>
        {local && <p className="hint">{localText(local)}</p>}
      </section>

      <PlacePicker place={place} onPlace={setPlace} onError={setError} />

      {local && place && (
        <section aria-labelledby="h-clock">
          <h2 id="h-clock">{resolution?.ambiguous ? 'Which clock was the time read on?' : 'Clock'}</h2>
          {resolution?.ambiguous && <p className="hint">{resolution.why}</p>}
          {resolveError && <p className="hint warn">{resolveError}</p>}
          <ul className="rows" role="radiogroup" aria-labelledby="h-clock">
            {options.map((o, i) => {
              const p = points.get(o.id);
              const names = p && pointNames(p);
              return (
                <ClockRow key={o.id} option={o} checked={clockId === o.id} onCheck={() => setClockId(o.id)} zone={resolution?.zone} tzdb={resolution?.tzdb} tzdbOffsets={resolution?.tzdbOffsets ?? []}>
                  {names && (i === 0 || !first ? <>Lagna {names.lagna} · navāṃśa {names.navamsa} · Moon in {names.nakshatra}</> : first && p && <>{compareText(first, p)}</>)}
                </ClockRow>
              );
            })}
          </ul>
          {!other && !resolveError ? (
            <button type="button" className="link" onClick={() => setOther(true)}>
              Another clock…
            </button>
          ) : (
            <label className="inline">
              <span>UTC offset</span>
              <input className="text" value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="+05:30" inputMode="text" autoComplete="off" />
            </label>
          )}
        </section>
      )}

      <section aria-labelledby="h-quality">
        <h2 id="h-quality">How sure is the time?</h2>
        <div className="chips" role="radiogroup" aria-labelledby="h-quality">
          {(Object.keys(TIME_QUALITIES) as TimeQuality[]).map((q) => (
            <button key={q} type="button" role="radio" aria-checked={quality === q} className={quality === q ? 'chip selected' : 'chip'} onClick={() => setQuality(q)}>
              {TIME_QUALITIES[q]}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p className="truth-error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="control primary" disabled={!ready} onClick={save}>
        Save chart
      </button>
      {!ready && <p className="hint">{missing(label, local, place, chosen, quality, !!resolution?.ambiguous)}</p>}
      <footer className="truth-foot">Places: GeoNames (geonames.org), CC BY 4.0 · Time zones: IANA tzdb{resolution ? ` ${resolution.tzdb}` : ''} · India’s clocks: docs/CANON.md</footer>
    </main>
  );
}

function missing(label: string, local: LocalTime | null, place: SavedPlace | null, chosen: ClockOption | null, quality: TimeQuality | null, ask: boolean): string {
  const m: string[] = [];
  if (!label.trim()) m.push('a name');
  if (!local) m.push('a valid date and time');
  if (!place) m.push('a place');
  if (local && place && !chosen) m.push(ask ? 'the clock' : 'a clock');
  if (!quality) m.push('how sure the time is');
  return `Still needed: ${m.join(', ')}.`;
}

/** "+05:30", "-4:51", "5:53:20", "+6" → seconds east; null if not an offset. */
export function parseOffset(s: string): number | null {
  const m = /^\s*([+\-−]?)(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*$/.exec(s);
  if (!m) return null;
  const v = Number(m[2]) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
  if (Number(m[3] ?? 0) > 59 || Number(m[4] ?? 0) > 59 || v > 14 * 3600) return null;
  return m[1] === '-' || m[1] === '−' ? -v : v;
}

function Num({ label, value, onChange, max, optional }: { label: string; value: string; onChange: (e: { target: { value: string } }) => void; max: number; optional?: boolean }) {
  return (
    <label className="num">
      <span>
        {label}
        {optional && <span className="muted"> (optional)</span>}
      </span>
      <input className="text" inputMode="numeric" pattern="[0-9]*" maxLength={max} size={max} value={value} onChange={onChange} aria-label={label} autoComplete="off" />
    </label>
  );
}

function ClockRow({ option: o, checked, onCheck, zone, tzdb, tzdbOffsets, children }: { option: ClockOption; checked: boolean; onCheck: () => void; zone: string | undefined; tzdb: string | undefined; tzdbOffsets: number[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={checked ? 'row selected' : 'row'}>
      <div className="choice">
        <button type="button" role="radio" aria-checked={checked} className="row-main" onClick={onCheck}>
          <span className="name wrap">
            {o.name}
            <span className="sub">{children}</span>
          </span>
          <span className="value">UTC{formatOffset(o.offsetSeconds)}</span>
        </button>
        <button type="button" className="why" aria-expanded={open} aria-label={`Sources for ${o.name}`} onClick={() => setOpen((x) => !x)}>
          ⓘ
        </button>
      </div>
      {open && (
        <div className="trace">
          <dl>
            <Item k="Clock">{o.note}</Item>
            <Item k="Offset">UTC{formatOffset(o.offsetSeconds)} ({o.offsetSeconds} s)</Item>
            <Item k="Instant">{utcText(o.unixMs)}</Item>
            {zone && (
              <Item k="tzdb">
                {zone}, tzdb {tzdb}: {tzdbOffsets.length ? tzdbOffsets.map((x) => `UTC${formatOffset(x)}`).join(' or ') : 'outside 1800–2099'}
              </Item>
            )}
            <Item k="Sources">
              <ul className="sources">
                {o.sources.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </Item>
          </dl>
        </div>
      )}
    </li>
  );
}

export function Item({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="item">
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Find the place: the offline index as you type; OpenStreetMap on request; or coordinates. */
function PlacePicker({ place, onPlace, onError }: { place: SavedPlace | null; onPlace: (p: SavedPlace | null) => void; onError: (e: string | null) => void }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<PlaceMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [osm, setOsm] = useState<OsmPlace[] | null>(null);
  const [askConsent, setAskConsent] = useState(false);
  const [coords, setCoords] = useState(false);
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    setOsm(null);
    const q = query.trim();
    if (q.length < 2) {
      setMatches(null);
      return;
    }
    const n = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      birth('search', { query: q, limit: 12 }).then(
        (r) => n === seq.current && (setMatches(r.matches), setLoading(false)),
        (e: unknown) => n === seq.current && (onError(String(e)), setLoading(false)),
      );
    }, 150);
    return () => clearTimeout(t);
  }, [query, onError]);

  const choose = (m: PlaceMatch) => {
    const p = m.place;
    onPlace({
      name: p.name,
      region: regionLabel(p.region),
      latitude: p.latitude,
      longitude: p.longitude,
      ...(p.elevation !== undefined && { elevation: p.elevation }),
      zone: p.zone,
      country: p.region.country,
      admin1: p.region.admin1,
      admin2: p.region.admin2,
      source: 'geonames',
      ...(p.geonameId !== undefined && { geonameId: p.geonameId }),
    });
  };

  /** A point (from OpenStreetMap or typed): its zone, and the nearest indexed place for the region. */
  const locate = async (latitude: number, longitude: number, name: string, region: string | null, source: SavedPlace['source'], osmId?: string) => {
    try {
      const r = await birth('locate', { latitude, longitude });
      const near = r.nearest.place;
      onPlace({
        name,
        region: region ?? `near ${near.name}, ${regionLabel(near.region)}`,
        latitude,
        longitude,
        zone: r.zone,
        country: near.region.country,
        admin1: near.region.admin1,
        admin2: near.region.admin2,
        source,
        ...(osmId && { osm: osmId }),
        nearest: { name: near.name, region: regionLabel(near.region), km: r.nearest.km },
      });
    } catch (e) {
      onError(String(e));
    }
  };

  const searchOnline = async () => {
    if (!hasConsent()) return setAskConsent(true);
    try {
      setOsm(await searchOsm(query));
    } catch (e) {
      onError(String(e));
    }
  };

  if (place) {
    return (
      <section aria-labelledby="h-place">
        <h2 id="h-place">Place</h2>
        <ul className="rows">
          <li className={open ? 'row selected' : 'row'}>
            <button type="button" className="row-main" aria-expanded={open} onClick={() => setOpen((x) => !x)}>
              <span className="name wrap">
                {place.name}
                <span className="sub">{place.region}</span>
              </span>
              <span className="value">{coordText(place.latitude, place.longitude)}</span>
            </button>
            {open && <PlaceTrace place={place} />}
          </li>
        </ul>
        <button type="button" className="link" onClick={() => (onPlace(null), setOpen(false))}>
          Change place
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="h-place">
      <h2 id="h-place">Place</h2>
      {!coords ? (
        <>
          <input className="text wide" aria-labelledby="h-place" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Town or village; “Rampur, Bareilly” for the district" autoComplete="off" />
          {loading && !matches && <p className="hint">Opening the place index…</p>}
          {matches && (
            <ul className="rows results">
              {matches.map((m, i) => (
                <li key={i} className="row">
                  <button type="button" className="row-main" onClick={() => choose(m)}>
                    <span className="name wrap">
                      {m.place.name}
                      {m.alias && <span className="alias"> ({m.alias})</span>}
                      <span className="sub">{regionLabel(m.place.region)}</span>
                    </span>
                    <span className="value sub">{coordText(m.place.latitude, m.place.longitude)}</span>
                  </button>
                </li>
              ))}
              {!matches.length && <li className="row placeholder">No place of that name in the offline index.</li>}
            </ul>
          )}
          {osm && (
            <ul className="rows results">
              {osm.map((o) => (
                <li key={o.osm} className="row">
                  <button type="button" className="row-main" onClick={() => locate(o.latitude, o.longitude, o.name, o.display.split(', ').slice(1).join(', '), 'openstreetmap', o.osm)}>
                    <span className="name wrap">
                      {o.name}
                      <span className="sub">{o.display.split(', ').slice(1).join(', ')}</span>
                    </span>
                    <span className="value sub">{coordText(o.latitude, o.longitude)}</span>
                  </button>
                </li>
              ))}
              {!osm.length && <li className="row placeholder">OpenStreetMap found nothing.</li>}
              <li className="attribution">{OSM_ATTRIBUTION}</li>
            </ul>
          )}
          {askConsent && (
            <div className="consent" role="dialog" aria-labelledby="h-consent">
              <p id="h-consent">
                Search OpenStreetMap? The words in the search box are sent to nominatim.openstreetmap.org (OpenStreetMap Foundation). Nothing else leaves this device.
              </p>
              <button
                type="button"
                className="control"
                onClick={() => {
                  giveConsent();
                  setAskConsent(false);
                  void searchOnline();
                }}
              >
                Yes, search online
              </button>{' '}
              <button type="button" className="control" onClick={() => setAskConsent(false)}>
                No
              </button>
            </div>
          )}
          <p className="actions">
            {query.trim().length >= 2 && (
              <button type="button" className="link" onClick={searchOnline}>
                Search OpenStreetMap (online)
              </button>
            )}
            <button type="button" className="link" onClick={() => setCoords(true)}>
              Enter coordinates
            </button>
          </p>
        </>
      ) : (
        <>
          <div className="inputs">
            <label className="num">
              <span>Latitude °N</span>
              <input className="text" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="19.07283" size={9} autoComplete="off" />
            </label>
            <label className="num">
              <span>Longitude °E</span>
              <input className="text" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="72.88261" size={9} autoComplete="off" />
            </label>
          </div>
          <p className="hint">Decimal degrees; south and west negative.</p>
          <p className="actions">
            <button
              type="button"
              className="link"
              disabled={!validCoord(lat, 90) || !validCoord(lon, 180)}
              onClick={() => locate(Number(lat), Number(lon), coordText(Number(lat), Number(lon)), null, 'coordinates')}
            >
              Use these coordinates
            </button>
            <button type="button" className="link" onClick={() => setCoords(false)}>
              Search by name
            </button>
          </p>
        </>
      )}
    </section>
  );
}

const validCoord = (s: string, max: number) => /^\s*-?\d+(\.\d+)?\s*$/.test(s) && Math.abs(Number(s)) <= max;

export function coordText(lat: number, lon: number): string {
  return `${Math.abs(lat)}° ${lat < 0 ? 'S' : 'N'} ${Math.abs(lon)}° ${lon < 0 ? 'W' : 'E'}`;
}

export function PlaceTrace({ place }: { place: SavedPlace }) {
  return (
    <div className="trace">
      <dl>
        <Item k="Latitude">{place.latitude}° (geodetic, north positive)</Item>
        <Item k="Longitude">{place.longitude}° (east positive)</Item>
        <Item k="Altitude">{place.elevation !== undefined ? `${place.elevation} m (GeoNames elevation model)` : '0 m (not known)'}</Item>
        <Item k="Zone">{place.zone}{place.source === 'geonames' ? ' (GeoNames)' : ' (from the coordinates: tz-lookup, timezone-boundary-builder data)'}</Item>
        {place.nearest && (
          <Item k="Nearest">
            {place.nearest.name}, {place.nearest.region}, {place.nearest.km.toFixed(1)} km: gives the state and district
          </Item>
        )}
        <Item k="Source">
          {place.source === 'geonames'
            ? `GeoNames${place.geonameId ? ` ${place.geonameId}` : ''} (geonames.org, CC BY 4.0)`
            : place.source === 'openstreetmap'
              ? `OpenStreetMap ${place.osm} (${OSM_ATTRIBUTION})`
              : 'Typed by hand'}
        </Item>
      </dl>
    </div>
  );
}
