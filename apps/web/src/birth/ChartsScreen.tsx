/**
 * Charts saved on this device. Each shows how far its birth time can move before the lagna,
 * the navāṃśa lagna, the D60 lagna or the Moon's nakṣatra changes; tapping it shows every
 * input, convention and source.
 */
import { Fragment, useEffect, useRef, useState } from 'react';
import { DEFAULT_JYOTISH, RASHIS, type Sensitivity } from '@aletheia/engine';
import { formatOffset } from '@aletheia/birth';
import { engine } from '../engine/client.ts';
import { Item, PlaceTrace } from './BirthScreen.tsx';
import { holdText, localText, QUANTITY_NAMES, sensitivityLine, span, utcText, valueName } from './format.ts';
import { exportFile, listCharts, parseExport, persisted, saveCharts, TIME_QUALITIES, type SavedChart } from './store.ts';

export default function ChartsScreen({ onClose, onNew }: { onClose: () => void; onNew: () => void }) {
  const [charts, setCharts] = useState<SavedChart[] | null>(null);
  const [sens, setSens] = useState<Record<string, Sensitivity>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [durable, setDurable] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const load = () =>
    listCharts().then(setCharts, (e: unknown) => {
      setCharts([]);
      setMessage(`Could not read saved charts: ${String(e)}`);
    });
  useEffect(() => {
    void load();
    persisted().then(setDurable, () => setDurable(false));
  }, []);

  // Sensitivity of each chart, one after another in the engine worker.
  useEffect(() => {
    if (!charts) return;
    let current = true;
    (async () => {
      for (const c of charts) {
        if (!current) return;
        const s = await engine().call('sensitivity', { time: { unixMs: c.unixMs }, place: { latitude: c.place.latitude, longitude: c.place.longitude, altitude: c.place.elevation ?? 0 }, settings: DEFAULT_JYOTISH });
        if (current) setSens((m) => ({ ...m, [c.id]: s }));
      }
    })().catch((e: unknown) => current && setMessage(String(e)));
    return () => {
      current = false;
    };
  }, [charts]);

  const doExport = () => {
    if (!charts?.length) return;
    const f = exportFile(charts);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([f.text], { type: 'application/json' }));
    a.download = f.name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = async (input: HTMLInputElement) => {
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      const imported = parseExport(await f.text());
      await saveCharts(imported);
      setMessage(`Imported ${imported.length} chart${imported.length === 1 ? '' : 's'}.`);
      await load();
    } catch (e) {
      setMessage(`Not imported: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <main className="page charts">
      <header className="truth-head">
        <button type="button" className="control" onClick={onClose}>
          Now
        </button>
        <h1 className="truth-title">Charts</h1>
      </header>

      <p className="actions">
        <button type="button" className="control" onClick={onNew}>
          New chart
        </button>
        <button type="button" className="control" onClick={doExport} disabled={!charts?.length}>
          Export
        </button>
        <button type="button" className="control" onClick={() => file.current?.click()}>
          Import
        </button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void doImport(e.target)} />
      </p>
      {message && <p className="hint" role="status">{message}</p>}

      <section aria-labelledby="h-saved">
        <h2 id="h-saved">
          Saved <span className="conv">on this device{durable === null ? '' : durable ? ' · persistent storage' : ' · the browser may clear it; export to keep a copy'}</span>
        </h2>
        <ul className="rows">
          {charts?.map((c) => {
            const s = sens[c.id];
            const open = selected === c.id;
            return (
              <li key={c.id} className={open ? 'row selected' : 'row'}>
                <button type="button" className="row-main stacked" aria-expanded={open} onClick={() => setSelected(open ? null : c.id)}>
                  <span className="line">
                    <span className="label">{c.label}</span>
                    <span className="value">{s ? RASHIS[s.holds[0]!.value] : ''}</span>
                  </span>
                  <span className="sub">
                    {localText(c.local)} · {c.place.name} · {c.clock.name} · {TIME_QUALITIES[c.quality]}
                  </span>
                  <span className="sensitivity">
                    {s
                      ? sensitivityLine(s)
                          .split(' · ')
                          .map((part, i) => (
                            <Fragment key={i}>
                              {i > 0 && ' · '}
                              <span className="nowrap">{part}</span>
                            </Fragment>
                          ))
                      : 'Computing…'}
                  </span>
                  {s?.instant.precision === 'reduced' && <span className="reduced">reduced precision (outside 1800–2400)</span>}
                </button>
                {open && <ChartTrace chart={c} s={s} />}
              </li>
            );
          })}
          {charts && !charts.length && <li className="row placeholder">No charts yet.</li>}
        </ul>
      </section>
    </main>
  );
}

function ChartTrace({ chart: c, s }: { chart: SavedChart; s: Sensitivity | undefined }) {
  return (
    <div className="trace">
      <dl>
        <Item k="Written">{localText(c.local)}, {c.place.name}</Item>
        <Item k="Clock">
          {c.clock.name}, UTC{formatOffset(c.clock.offsetSeconds)} (chosen when saved; zone {c.place.zone}, tzdb {c.tzdb})
        </Item>
        <Item k="Instant">{utcText(c.unixMs)}{s && ` · JD UT ${s.instant.jdUT.toFixed(6)} · ΔT ${s.instant.deltaTSeconds.toFixed(2)} s`}</Item>
        {s && (
          <>
            <Item k="Ascendant">
              {RASHIS[s.holds[0]!.value]} {(s.ascendant % 30).toFixed(4)}° (sidereal {s.ascendant.toFixed(6)}°); Moon {s.moon.toFixed(6)}°
            </Item>
            {s.holds.map((h) => (
              <Item key={h.quantity} k={QUANTITY_NAMES[h.quantity]}>
                {valueName(h, h.value)} {holdText(h)}: {side(h, 'earlier')}; {side(h, 'later')}
              </Item>
            ))}
            <Item k="Found">
              Crossings of {s.holds.map((h) => `${+h.partDegrees.toFixed(4)}°`).join(', ')} boundaries, bracketed by sampling and refined by Brent’s method to 1 ms; searched {s.searchedDays} days each way
            </Item>
            <Item k="Convention">Lahiri ayanāṃśa; navāṃśa and D60 of BPHS 6.12, 6.33; true nodes; whole-sign lagna</Item>
          </>
        )}
      </dl>
      <PlaceTrace place={c.place} />
    </div>
  );
}

function side(h: Sensitivity['holds'][number], which: 'earlier' | 'later'): string {
  const x = h[which];
  if (!x) return `${which}: no change within the search`;
  return `${span(x.seconds)} ${which} (${x.seconds < 0 ? '−' : '+'}${Math.abs(x.seconds).toFixed(1)} s) → ${valueName(h, x.value)}`;
}
