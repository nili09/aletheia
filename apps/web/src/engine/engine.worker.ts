/**
 * The engine's Web Worker. All astronomy runs here, off the main thread.
 *
 * Vite resolves the file URLs at build time (hashed names). Nothing is fetched until the
 * first request: the WebAssembly and the planet and Moon files then, the star catalogue
 * and the JPL fixture only if a request needs them. The service worker caches each file
 * the first time it is fetched, so the engine then works offline (vite.config.ts).
 */
import { serveEngine, type Port } from '@aletheia/engine/worker';
import type { EpheFile, HorizonsFixture } from '@aletheia/engine';
import wasmUrl from '@aletheia/engine/vendor/swisseph.wasm?url';
import seplUrl from '@aletheia/engine/ephe/sepl_18.se1?url';
import semoUrl from '@aletheia/engine/ephe/semo_18.se1?url';
import starsUrl from '@aletheia/engine/ephe/sefstars.txt?url';
import horizonsUrl from '@aletheia/engine/fixtures/horizons-positions.json?url';

const FILES: Record<EpheFile, string> = {
  'sepl_18.se1': seplUrl,
  'semo_18.se1': semoUrl,
  'sefstars.txt': starsUrl,
};

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not load ${url}: HTTP ${res.status}`);
  return res;
}

serveEngine(self as unknown as Port, {
  wasm: { locateFile: () => wasmUrl },
  file: async (name) => new Uint8Array(await (await fetchOk(FILES[name])).arrayBuffer()),
  horizonsFixture: async () => (await (await fetchOk(horizonsUrl)).json()) as HorizonsFixture,
});
