/**
 * Truth: the engine's raw output, live, for checking. Hidden; opened by holding the ring
 * on Now. Every value can be tapped to show its inputs, convention and source.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, FULL_PRECISION_JD_TT, type GrahaPosition, type HorizonsReport, type Place, type Settings } from '@aletheia/engine';
import type { Result, Snapshot } from '@aletheia/engine/worker';
import { engine } from '../engine/client.ts';
import { formatUtcOffset } from '../now/time.ts';
import { useNow } from '../now/useNow.ts';
import {
  clock,
  describeEvents,
  fixed,
  GRAHA_NAMES,
  GRAHA_ORDER,
  groupByInstant,
  inSign,
  longitude360,
  nakshatraOf,
  shortDate,
  signedDms,
  dms,
} from './format.ts';

/** Until Settings has a place, the ascendant is shown for Ujjain, the classical prime meridian. */
const PLACE: Place & { name: string } = { name: 'Ujjain', latitude: 23.1765, longitude: 75.7885, altitude: 0 };
const SETTINGS: Settings = { ...DEFAULT_SETTINGS };
const EVENT_ROWS = 5;

type NextEvents = Result<'nextEvents'>;

const FRAME = 'Geocentric, apparent (light-time, aberration, deflection), ecliptic and true equinox of date; precession IAU 2006, nutation IAU 2000B.';

export default function TruthScreen({ onClose }: { onClose: () => void }) {
  const now = useNow();
  // Compute for the whole second shown, so the clock and the values describe the same instant.
  const unixMs = Math.floor(now.getTime() / 1000) * 1000;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [events, setEvents] = useState<NextEvents | null>(null);
  const [jpl, setJpl] = useState<HorizonsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const eventsPending = useRef(false);

  useEffect(() => {
    let current = true;
    engine()
      .call('snapshot', { time: { unixMs }, place: PLACE, settings: SETTINGS })
      .then((s) => current && setSnap(s), (e: unknown) => current && setError(String(e)));
    return () => {
      current = false;
    };
  }, [unixMs]);

  // The next events: fetched on opening, and again once the first one has passed.
  const firstEvent = events?.[0]?.unixMs;
  useEffect(() => {
    if (eventsPending.current || (firstEvent !== undefined && unixMs < firstEvent)) return;
    eventsPending.current = true;
    engine()
      .call('nextEvents', { time: { unixMs }, count: 24, settings: SETTINGS })
      .then(setEvents, (e: unknown) => setError(String(e)))
      .finally(() => (eventsPending.current = false));
  }, [unixMs, firstEvent]);

  // The JPL comparison, run once on this device against the bundled fixture.
  useEffect(() => {
    engine().call('horizonsCheck', {}).then(setJpl, (e: unknown) => setError(String(e)));
  }, []);

  const toggle = (key: string) => setSelected((s) => (s === key ? null : key));
  const row = (key: string, main: ReactNode, trace: () => ReactNode) => (
    <li key={key} className={selected === key ? 'row selected' : 'row'}>
      <button type="button" className="row-main" aria-expanded={selected === key} onClick={() => toggle(key)}>
        {main}
      </button>
      {selected === key && <div className="trace">{trace()}</div>}
    </li>
  );

  return (
    <main className="truth">
      <header className="truth-head">
        <button type="button" className="control" onClick={onClose}>
          Now
        </button>
        <h1 className="truth-title">Truth</h1>
      </header>

      <p className="truth-instant">
        <time dateTime={new Date(unixMs).toISOString()}>{clock(unixMs)}</time>
        <span className="muted">
          {' '}
          {shortDate(unixMs)} · {formatUtcOffset(now)}
        </span>
      </p>
      {snap && (
        <p className="truth-meta">
          JD UT {fixed(snap.instant.jdUT, 6)} · ΔT {fixed(snap.instant.deltaTSeconds, 2)} s
          {snap.instant.precision === 'reduced' && <span className="reduced"> · reduced precision</span>}
        </p>
      )}
      {error && <p className="truth-error" role="alert">{error}</p>}

      <section aria-labelledby="h-grahas">
        <h2 id="h-grahas">
          Grahas <span className="conv">sidereal · {snap?.ayanamsa.name ?? 'Lahiri'} · {SETTINGS.node} nodes</span>
        </h2>
        <ul className="rows">
          {snap
            ? GRAHA_ORDER.map((g) => {
                const p = snap.grahas.find((x) => x.graha === g)!;
                return row(g, <GrahaLine p={p} />, () => <GrahaTrace p={p} snap={snap} />);
              })
            : GRAHA_ORDER.map((g) => <li key={g} className="row placeholder">{GRAHA_NAMES[g].sa}</li>)}
          {snap?.otherNodes.map((p) => row(`${p.graha}-other`, <GrahaLine p={p} suffix={`${p.node} node`} />, () => <GrahaTrace p={p} snap={snap} />))}
        </ul>
      </section>

      {snap && (
        <section aria-labelledby="h-frame">
          <h2 id="h-frame">Frame</h2>
          <ul className="rows">
            {row(
              'ayanamsa',
              <Line name="Ayanāṃśa" sub={snap.ayanamsa.name} value={dms(snap.ayanamsa.value)} />,
              () => (
                <dl>
                  <Item k="Mode">Swiss Ephemeris sidereal mode {snap.ayanamsa.mode} ({snap.ayanamsa.name})</Item>
                  <Item k="True">{fixed(snap.ayanamsa.value, 9)}° (with nutation)</Item>
                  <Item k="Mean">{fixed(snap.ayanamsa.mean, 9)}°</Item>
                  <Item k="Definition">23°15′00.658″ true at 1956-03-21 0h TT (Indian Astronomical Ephemeris 1989, p. 556), carried into the IAU 2006 frame by Swiss Ephemeris (+0.13″, constant).</Item>
                  <Item k="Instant">JD TT {fixed(snap.instant.jdTT, 6)}</Item>
                  <Item k="Source">Swiss Ephemeris {snap.version}</Item>
                </dl>
              ),
            )}
            {row(
              'lagna',
              <Line name="Lagna" sub={`${PLACE.name} · whole-sign`} value={signAndDms(snap.houses.ascendant.sidereal)} />,
              () => (
                <dl>
                  <Item k="Place">
                    {PLACE.name}, {dms(PLACE.latitude)} N, {dms(PLACE.longitude)} E (default until a place is set)
                  </Item>
                  <Item k="Sidereal">{fixed(snap.houses.ascendant.sidereal, 8)}°</Item>
                  <Item k="Tropical">{fixed(snap.houses.ascendant.tropical, 8)}°</Item>
                  <Item k="ARMC">
                    {fixed(snap.houses.armc, 8)}° (local apparent sidereal time {fixed(snap.houses.armc / 15, 8)} h)
                  </Item>
                  <Item k="Houses">{snap.houses.systemName}: cusps at the starts of the signs from the lagna's sign</Item>
                  <Item k="Instant">
                    JD UT {fixed(snap.instant.jdUT, 6)} (houses follow Earth's rotation, UT1); ΔT {fixed(snap.instant.deltaTSeconds, 3)} s
                  </Item>
                  <Item k="Source">Swiss Ephemeris {snap.version}, swe_houses_ex2</Item>
                </dl>
              ),
            )}
          </ul>
        </section>
      )}

      <section aria-labelledby="h-events">
        <h2 id="h-events">Next events</h2>
        <ul className="rows">
          {events
            ? groupByInstant(events.filter((e) => e.unixMs >= unixMs))
                .slice(0, EVENT_ROWS)
                .map((g) => {
                  const e = g[0]!;
                  const key = `ev-${e.instant.jdTT}`;
                  return row(
                    key,
                    <Line name={describeEvents(g)} value={clock(e.unixMs)} sub={shortDate(e.unixMs)} wrap />,
                    () => (
                      <dl>
                        <Item k="Instant">
                          {new Date(e.unixMs).toISOString().replace('T', ' ').replace('Z', ' UTC')} · JD TT {fixed(e.instant.jdTT, 8)}
                        </Item>
                        <Item k="Found">Bracketed by sampling, refined by Brent's method to 1 ms</Item>
                        <Item k="Check">
                          {g.every((x) => x.check.ok) ? 'crossing confirmed' : 'CHECK FAILED'} between −0.5 s and +0.5 s ({g.length} event{g.length > 1 ? 's' : ''})
                        </Item>
                        <Item k="Frame">Sidereal, {snap?.ayanamsa.name ?? 'Lahiri'}, {SETTINGS.node} nodes</Item>
                      </dl>
                    ),
                  );
                })
            : Array.from({ length: EVENT_ROWS }, (_, i) => <li key={i} className="row placeholder">…</li>)}
        </ul>
      </section>

      <section aria-labelledby="h-jpl">
        <h2 id="h-jpl">
          Against JPL Horizons <span className="conv">run on this device</span>
        </h2>
        {jpl ? (
          <>
            <p className="jpl-summary">
              {jpl.count} positions, 1900–2100: {jpl.pass ? `all within ${jpl.toleranceArcsec}″` : 'TARGET MISSED'}
            </p>
            <ul className="rows">
              {jpl.bodies.map((b) =>
                row(
                  `jpl-${b.body}`,
                  <Line
                    name={GRAHA_NAMES[b.body].sa}
                    sub="worst |Δλ|"
                    value={`${b.worst.longitude >= 0 ? '+' : '−'}${fixed(Math.abs(b.worst.longitude), 3)}″`}
                  />,
                  () => (
                    <dl>
                      <Item k="Worst">
                        {fixed(b.worst.longitude, 4)}″ in longitude at JD TT {fixed(b.worst.jdTT, 6)}
                      </Item>
                      <Item k="RMS">{fixed(b.rmsLongitude, 4)}″ over {b.count} instants; latitude worst {fixed(b.maxAbsLatitude, 4)}″</Item>
                      <Item k="Reference">JPL Horizons quantity 31 ({b.horizonsSource}), retrieved {jpl.retrieved.slice(0, 10)}</Item>
                      <Item k="Why not 0">Horizons uses the IAU 1976/1980 precession-nutation model, the engine IAU 2006/2000B: about 0.2″ at 1900 and 2100</Item>
                    </dl>
                  ),
                ),
              )}
            </ul>
          </>
        ) : (
          <p className="jpl-summary muted">Comparing…</p>
        )}
      </section>

      <footer className="truth-foot">
        Swiss Ephemeris {snap?.version ?? ''} · JPL DE441 · full precision {jdSpan()}
      </footer>
    </main>
  );
}

function signAndDms(lon: number): string {
  const s = inSign(lon);
  return `${s.sign} ${s.dms}`;
}

function jdSpan(): string {
  return `JD ${FULL_PRECISION_JD_TT.first}–${Math.floor(FULL_PRECISION_JD_TT.last)}`;
}

function Line({ name, sub, value, wrap }: { name: string; sub?: string; value: string; wrap?: boolean }) {
  return (
    <>
      <span className={wrap ? 'name wrap' : 'name'}>
        {name}
        {sub && <span className="sub">{sub}</span>}
      </span>
      <span className="value">{value}</span>
    </>
  );
}

function GrahaLine({ p, suffix }: { p: GrahaPosition; suffix?: string }) {
  const s = inSign(p.sidereal.longitude);
  const n = nakshatraOf(p.sidereal.longitude);
  return (
    <>
      <span className="name">
        <span>
          {GRAHA_NAMES[p.graha].sa}
          {p.retrograde && (
            <span className="retro" title="retrograde">
              {' '}
              ℞
            </span>
          )}
        </span>
        <span className="sub">{suffix ?? `${n.name} ${n.pada}`}</span>
      </span>
      <span className="value">
        <span className="sign">{s.sign}</span> {s.dms}
      </span>
    </>
  );
}

function GrahaTrace({ p, snap }: { p: GrahaPosition; snap: Snapshot }) {
  const node = p.node ? ` · ${p.node === 'true' ? 'true (osculating)' : 'mean'} node` : '';
  return (
    <dl>
      <Item k="Sidereal">
        {fixed(p.sidereal.longitude, 8)}° = {longitude360(p.sidereal.longitude)}
      </Item>
      <Item k="Tropical">
        {fixed(p.tropical.longitude, 8)}° = {longitude360(p.tropical.longitude)}
      </Item>
      <Item k="Latitude">{signedDms(p.tropical.latitude)}</Item>
      <Item k="Speed">
        {fixed(p.sidereal.longitudeSpeed, 6)}°/day{p.retrograde ? ' (retrograde: moving back against the stars)' : ''}
      </Item>
      <Item k="Distance">{fixed(p.tropical.distance, 9)} AU</Item>
      <Item k="Instant">
        JD TT {fixed(snap.instant.jdTT, 6)} · JD UT {fixed(snap.instant.jdUT, 6)} · ΔT {fixed(snap.instant.deltaTSeconds, 3)} s
      </Item>
      <Item k="Frame">
        {FRAME} Ayanāṃśa {snap.ayanamsa.name}{node}.
      </Item>
      <Item k="Source">
        Swiss Ephemeris {snap.version}, {p.ephemeris === 'swiss' ? 'files from JPL DE441' : 'Moshier analytic ephemeris'} · flags {p.flags.tropical}/{p.flags.sidereal}
        {['jupiter', 'saturn'].includes(p.graha) ? ' · system barycentre (≤0.075″ from the planet)' : ''}
      </Item>
      <Item k="Precision">{p.precision}</Item>
    </dl>
  );
}

function Item({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="item">
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}
