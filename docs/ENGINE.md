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
| `scripts/fetch-*.mjs` | Regenerate the reference fixtures (NASA, JPL, USNO, Drik Panchang) and the Sanskrit verses |

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

## Jyotish

`src/jyotish/` builds the classical calculations on the verified sky. Each rule is tied to its source in `src/jyotish/sources.ts` (rule id → verses, our translation, a plain-English Yantra explanation, and a status: canon, pending or unsourced) and recorded in docs/CANON.md.

| Path | What |
|---|---|
| `sources.ts`, `verses.json` | The Mantra and Yantra doors. `verses.json` is the Sanskrit, verbatim, from `scripts/fetch-verses.mjs` (BPHS, Bṛhajjātaka and Phaladīpikā from sanskritdocuments.org; Sūrya Siddhānta from GRETIL) |
| `core.ts` | Signs, lords, weekday order, house counting |
| `dignity.ts` | Exaltation, debilitation, mūlatrikoṇa, own sign; natural friendship computed from BPHS 3.55; temporal and compound |
| `vargas.ts` | The sixteen vargas of BPHS 6 |
| `panchang.ts` | Tithi, nakṣatra and pada, yoga, karaṇa (each span with exact start and end), vāra; amānta and pūrṇimānta month with adhika and kṣaya; pakṣa, saṃvatsara, ṛtu, ayana; day and night eighths (Gulika, Yamagaṇḍa), Rāhu kāla, horās, muhūrtas, abhijit |
| `chart.ts` | A chart as plain data: sidereal, tropical and equatorial positions, lagna and MC, the vāra day, horā lord |
| `states.ts` | Cruel and gentle grahas, combustion (kālāṃśa or longitude), planetary war |
| `jaimini.ts` | Chara kārakas, ārūḍha padas, signs with two lords, upapada, kārakāṃśa, argalā |
| `dasha.ts` | Viṃśottarī and Yoginī to any depth (five levels: mahā to prāṇa), cara daśā |
| `ashtakavarga.ts` | Bhinna and sarva aṣṭakavarga (BPHS or BJ tables), trikoṇa and ekādhipatya śodhana |
| `shadbala.ts` | Ṣaḍbala, all six components in virūpas and rūpas, with the precise aspects of BPHS 26 |
| `kundali.ts` | Everything above for one chart, in one object |
| `settings.ts` | The jyotish conventions, all switchable |

`Engine.panchang(t, place, settings)` gives the pañcāṅga of the vāra day (sunrise to next sunrise) containing t; `Engine.chart` and `Engine.kundali` give a chart and its full analysis. The worker serves both (`panchang`, `kundali`). A kundali takes about 25 ms, a pañcāṅga about 45 ms, in Node on a desktop.

Every result carries `provisional`: the ids of the rules it used whose reading awaits Nilesh's decision. The UI must show these results as provisional until the rule is settled.

Times in daśās are Julian days TT (a daśā year is `dashaYearDays` days of TT). Pañcāṅga and chart instants are `Instant`s with both TT and UT.
