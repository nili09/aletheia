/**
 * The engine's side of the worker boundary. Environment-neutral: the host page supplies
 * how to load the WebAssembly and the data files (fetch in the app, fs in tests).
 *
 * - The engine is created on the first request, not at start-up.
 * - Data files are fetched the first time a request needs them: the planet and Moon files
 *   for any computation inside their coverage, the star catalogue only for fixed stars.
 * - Requests run one at a time, in order (the engine is synchronous and not re-entrant;
 *   file loading is the only await).
 * - A small LRU cache returns repeated requests without recomputing.
 */
import { Engine, PLANET_FILES, STAR_FILE, type EpheFile } from '../engine.ts';
import { GRAHAS } from '../grahas.ts';
import type { LoadOptions } from '../swe/swisseph.ts';
import { compareWithHorizons, type HorizonsFixture } from '../verify/horizons.ts';
import type { Method, Params, Request, Response, Result } from './protocol.ts';

export interface Resources {
  /** Options for loading the WebAssembly (e.g. locateFile returning the bundled URL). */
  wasm?: LoadOptions;
  /** Fetch an ephemeris data file. */
  file(name: EpheFile): Promise<Uint8Array>;
  /** Fetch the JPL Horizons reference fixture (for the live check on the Truth screen). */
  horizonsFixture?(): Promise<HorizonsFixture>;
}

export interface Port {
  postMessage(message: Response): void;
  addEventListener(type: 'message', listener: (e: { data: Request }) => void): void;
}

const CACHE_SIZE = 64;

export class EngineHost {
  private engine: Promise<Engine> | null = null;
  private readonly loading = new Map<EpheFile, Promise<void>>();
  private readonly cache = new Map<string, unknown>();
  private queue: Promise<unknown> = Promise.resolve();
  private fixture: Promise<HorizonsFixture> | null = null;

  constructor(private readonly resources: Resources) {}

  /** Run a request after all earlier ones, and resolve with its result. */
  handle<M extends Method>(method: M, params: Params<M>): Promise<{ result: Result<M>; cached: boolean }> {
    const run = this.queue.then(() => this.run(method, params));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async run<M extends Method>(method: M, params: Params<M>): Promise<{ result: Result<M>; cached: boolean }> {
    const key = `${method}:${JSON.stringify(params)}`;
    if (this.cache.has(key)) {
      const result = this.cache.get(key) as Result<M>;
      this.cache.delete(key); // refresh LRU position
      this.cache.set(key, result);
      return { result, cached: true };
    }
    const engine = await this.getEngine();
    await this.ensureFiles(engine, method === 'fixedStar' || method === 'yogataras');
    const result = await this.compute(engine, method, params);
    this.cache.set(key, result);
    if (this.cache.size > CACHE_SIZE) this.cache.delete(this.cache.keys().next().value!);
    return { result, cached: false };
  }

  private getEngine(): Promise<Engine> {
    this.engine ??= Engine.create(this.resources.wasm ?? {});
    return this.engine;
  }

  private async ensureFiles(engine: Engine, stars: boolean): Promise<void> {
    const want: EpheFile[] = stars ? [...PLANET_FILES, STAR_FILE] : [...PLANET_FILES];
    await Promise.all(
      want
        .filter((f) => !engine.hasFile(f))
        .map((f) => {
          let p = this.loading.get(f);
          if (!p) {
            p = this.resources.file(f).then((bytes) => engine.addFile(f, bytes));
            p.catch(() => this.loading.delete(f));
            this.loading.set(f, p);
          }
          return p;
        }),
    );
  }

  private async compute<M extends Method>(engine: Engine, method: M, params: Params<M>): Promise<Result<M>> {
    type R = Result<M>;
    switch (method) {
      case 'snapshot': {
        const { time, place, settings } = params as Params<'snapshot'>;
        const instant = engine.instant(time);
        const t = { jdTT: instant.jdTT };
        const other = settings.node === 'true' ? 'mean' : 'true';
        const snap: Result<'snapshot'> = {
          instant,
          version: engine.version,
          settings,
          grahas: engine.positions(t, settings),
          otherNodes: [engine.position(t, 'rahu', { ...settings, node: other }), engine.position(t, 'ketu', { ...settings, node: other })],
          ayanamsa: engine.ayanamsa(t, settings.ayanamsa),
          houses: engine.houses(t, place, settings),
          place,
          files: engine.fileData(),
        };
        return snap as R;
      }
      case 'positions': {
        const { time, settings } = params as Params<'positions'>;
        return engine.positions(time, settings) as R;
      }
      case 'ayanamsa': {
        const { time, mode } = params as Params<'ayanamsa'>;
        return engine.ayanamsa(time, mode) as R;
      }
      case 'houses': {
        const { time, place, settings } = params as Params<'houses'>;
        return engine.houses(time, place, settings) as R;
      }
      case 'riseSet': {
        const { time, body, place, convention } = params as Params<'riseSet'>;
        return engine.riseSet(time, body, place, convention) as R;
      }
      case 'solarEclipse': {
        const { time, backward } = params as Params<'solarEclipse'>;
        return engine.solarEclipse(time, backward) as R;
      }
      case 'lunarEclipse': {
        const { time, backward } = params as Params<'lunarEclipse'>;
        return engine.lunarEclipse(time, backward) as R;
      }
      case 'fixedStar': {
        const { time, star, mode } = params as Params<'fixedStar'>;
        return engine.fixedStar(time, star, mode) as R;
      }
      case 'yogataras': {
        const { time, mode } = params as Params<'yogataras'>;
        return engine.yogataras(time, mode) as R;
      }
      case 'events': {
        const { start, end, kinds, grahas, settings } = params as Params<'events'>;
        return engine.events({ start, end, ...(kinds && { kinds }), ...(grahas && { grahas }) }, settings) as R;
      }
      case 'nextEvents': {
        const { time, count, kinds, grahas, settings } = params as Params<'nextEvents'>;
        const found = engine.nextEvents(time, count, { ...(kinds && { kinds }), grahas: grahas ?? GRAHAS }, settings);
        // Each event carries its own re-check (the crossing within ±0.5 s) and its UTC time.
        return found.map((e) => ({ ...e, check: engine.verifyEvent(e, settings), unixMs: engine.unixMs(e.instant) })) as R;
      }
      case 'horizonsCheck': {
        if (!this.resources.horizonsFixture) throw new Error('no Horizons fixture available');
        this.fixture ??= this.resources.horizonsFixture();
        return compareWithHorizons(engine, await this.fixture) as R;
      }
    }
    throw new Error(`unknown method ${String(method)}`);
  }
}

/** Serve requests arriving on a worker's global scope (or any message port). */
export function serveEngine(port: Port, resources: Resources): EngineHost {
  const host = new EngineHost(resources);
  port.addEventListener('message', (e) => {
    const { id, method, params } = e.data;
    const t0 = performance.now();
    host.handle(method, params).then(
      ({ result, cached }) => port.postMessage({ id, ok: true, result, cached, ms: performance.now() - t0 }),
      (err: unknown) => {
        const error = err instanceof Error ? { name: err.name, message: err.message } : { name: 'Error', message: String(err) };
        port.postMessage({ id, ok: false, error });
      },
    );
  });
  return host;
}

