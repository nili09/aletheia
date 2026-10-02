# The astronomy engine

`packages/engine` wraps the official Swiss Ephemeris C library, compiled to WebAssembly, in deterministic TypeScript. In the app it runs in a Web Worker.

## Pieces

| Path | What |
|---|---|
| `wasm/build.mjs`, `wasm/swisseph.lock.json` | Reproducible build: exact upstream commit, Emscripten version, exported functions |
| `vendor/swisseph.{mjs,wasm}`, `vendor/BUILD.json` | Committed build output, with SHA-256 of every output and data file |
| `ephe/` | `sepl_18.se1`, `semo_18.se1` (JPL DE441), `sefstars.txt` |
| `src/swe/swisseph.ts` | Typed binding. Checks every return flag; throws on any fallback |
| `src/engine.ts` | `Engine`: positions, ayanamsa, houses, rise/set, eclipses, stars, events |
| `src/events/` | Event finder: bracket by sampling, refine with Brent's method |
| `src/worker/` | Worker host (lazy files, serial queue, 64-entry LRU cache) and typed client |
| `src/verify/horizons.ts` | The JPL comparison, shared by the tests and the Truth screen |
| `scripts/fetch-*.mjs` | Regenerate the reference fixtures from NASA, JPL and USNO |

## Rebuilding the WebAssembly

Only needed when changing the pinned Swiss Ephemeris commit or Emscripten version. The app build never needs Emscripten.

```bash
git clone https://github.com/emscripten-core/emsdk.git .tools/emsdk
```

```bash
python .tools/emsdk/emsdk.py install 6.0.10
```

```bash
python .tools/emsdk/emsdk.py activate 6.0.10
```

```bash
npm run build:wasm -w @aletheia/engine
```

The script clones Astrodienst's repository into `.tools/swisseph`, checks out the locked commit, refuses a different version of either input, compiles with `-O3 -ffp-contract=off -fno-fast-math` (exact IEEE arithmetic), and rewrites `vendor/BUILD.json`. `test/coverage.test.ts` checks the shipped bytes against it.

## Precision and the files

Full precision is **1800-01-03 0h TT to 2400-01-10 20:37 TT** (`FULL_PRECISION_JD_TT`), the files' real coverage less one day at the start: an apparent position looks back by the light-time (up to 1.14 h for Saturn), so the first hours of the file cannot give every graha. Outside it the engine asks for the Moshier analytic ephemeris explicitly and labels every result `reduced`. Inside it, any fallback throws.

Functions that report no flags (`swe_rise_trans`, eclipse searches) are followed by a flag-checked probe of the Sun and Moon at the start and at every returned time, because `swe_rise_trans` falls back to Moshier silently. After any error the library's file state is reset: without that, a failed call at the start of the range made the next valid call ask for the wrong file.

## Loading in the app

Nothing astronomical loads until Truth is opened. The worker then fetches the WebAssembly (precached by the service worker) and the planet and Moon files; the star catalogue and the JPL fixture only when needed. The service worker caches each data file on first fetch (`aletheia-ephemeris`, cache-first; names are content-hashed), so the engine works offline afterwards.

## Conventions not settled by the texts

Jupiter and Saturn are system barycentres (at most 0.075″ from the planet; centre-of-body data covers only 1900–2047 and needs extra files). Positions use precession IAU 2006 and nutation IAU 2000B (the library default). Retrograde means the sidereal longitude speed is negative. These are recorded in docs/CANON.md.
