/**
 * The worker boundary, in-process: EngineClient talking to serveEngine through a fake
 * message channel. Checks lazy file loading, the cache, ordering and error reporting.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_JYOTISH, DEFAULT_SETTINGS, type EpheFile, type HorizonsFixture } from '../src/index.ts';
import { EngineClient, serveEngine, type Request, type Response, type WorkerLike } from '../src/worker/index.ts';
import { fixture, loadEngine, readEphe } from './helpers.ts';

function channel(onFile: (name: EpheFile) => void) {
  const toHost: Array<(e: { data: Request }) => void> = [];
  const toClient: Array<(e: { data: Response }) => void> = [];
  const host = serveEngine(
    {
      postMessage: (m) => queueMicrotask(() => toClient.forEach((l) => l({ data: structuredClone(m) }))),
      addEventListener: (_t, l) => toHost.push(l),
    },
    {
      file: async (name) => {
        onFile(name);
        return readEphe(name);
      },
      horizonsFixture: async () => fixture<HorizonsFixture>('horizons-positions.json'),
    },
  );
  const worker: WorkerLike = {
    postMessage: (m) => queueMicrotask(() => toHost.forEach((l) => l({ data: structuredClone(m) }))),
    addEventListener: (t: 'message' | 'error', l: (e: never) => void) => {
      if (t === 'message') toClient.push(l as (e: { data: Response }) => void);
    },
    terminate: () => undefined,
  };
  return { client: new EngineClient(worker), host };
}

const place = { latitude: 23.1765, longitude: 75.7885 };

describe('engine worker protocol', () => {
  it('loads data files lazily: planets on first use, stars only when asked', async () => {
    const loaded: EpheFile[] = [];
    const { client } = channel((f) => loaded.push(f));
    expect(loaded).toEqual([]);
    const snap = await client.call('snapshot', { time: { unixMs: Date.parse('2026-10-02T15:37:42Z') }, place, settings: { ...DEFAULT_SETTINGS } });
    expect(loaded.sort()).toEqual(['semo_18.se1', 'sepl_18.se1']);
    expect(snap.grahas).toHaveLength(9);
    expect(snap.otherNodes.map((p) => p.node)).toEqual(['mean', 'mean']);
    expect(snap.files.map((f) => f.jplNumber)).toEqual([441, 441]);
    await client.call('fixedStar', { time: { jdTT: 2461315.5 }, star: 'Spica', mode: 1 });
    expect(loaded).toContain('sefstars.txt');
    expect(loaded).toHaveLength(3);
  });

  it('answers a repeated request from its cache', async () => {
    const { client, host } = channel(() => undefined);
    const params = { time: { jdTT: 2461315.5 }, settings: { ...DEFAULT_SETTINGS } };
    const a = await host.handle('positions', params);
    const b = await host.handle('positions', params);
    expect(a.cached).toBe(false);
    expect(b.cached).toBe(true);
    expect(b.result).toEqual(a.result);
    expect(await client.call('positions', params)).toEqual(a.result);
  });

  it('runs requests in order and reports errors without breaking later ones', async () => {
    const { client } = channel(() => undefined);
    const bad = client.call('ayanamsa', { time: { jdTT: 2461315.5 }, mode: 99 });
    const good = client.call('ayanamsa', { time: { jdTT: 2461315.5 }, mode: 1 });
    await expect(bad).rejects.toMatchObject({ name: 'RangeError' });
    expect((await good).name).toMatch(/Lahiri/);
  });

  it('gives the next events each with its own ±0.5 s re-check, and the live JPL check', async () => {
    const { client } = channel(() => undefined);
    const next = await client.call('nextEvents', { time: { unixMs: Date.parse('2026-10-02T15:37:42Z') }, count: 5, settings: { ...DEFAULT_SETTINGS } });
    expect(next).toHaveLength(5);
    for (const e of next) expect(e.check.ok).toBe(true);
    const report = await client.call('horizonsCheck', {});
    expect(report.count).toBe(420);
    expect(report.pass).toBe(true);
  });

  it('serves the pañcāṅga and the kundali, unchanged by the structured clone', async () => {
    const { client } = channel(() => undefined);
    const engine = await loadEngine();
    const time = { unixMs: Date.parse('2026-10-03T06:30:00Z') };
    const settings = { ...DEFAULT_JYOTISH };
    expect(await client.call('panchang', { time, place, settings })).toEqual(engine.panchang(time, place, settings));
    expect(await client.call('kundali', { time, place, settings })).toEqual(engine.kundali(time, place, settings));
  });
});
