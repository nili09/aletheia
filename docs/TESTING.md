# Testing

Accuracy is priority zero, so tests come before features. A feature is not done until its numbers agree with an outside reference that we did not compute ourselves.

## Layers

| Layer | Tool | Where | Command |
|---|---|---|---|
| Engine unit and reference tests | Vitest | `packages/engine/test` | `npm test -w @aletheia/engine` |
| Web unit tests | Vitest | `apps/web/src/**/*.test.ts(x)` | `npm test -w @aletheia/web` |
| Phone screenshots and Truth screen | Playwright (iPhone 13 on WebKit, Pixel 7 on Chromium) | `apps/web/e2e` | `npm run e2e` |

`npm test` at the root runs every Vitest suite. `npm run e2e` builds the app, serves the production build with `vite preview`, and writes screenshots to `docs/screenshots/`.

Playwright browsers are installed once per machine with `npx playwright install chromium webkit`.

## Outside references

Every computed quantity must be checked against at least one of these, with the reference values stored as fixtures next to the test and the source recorded in the fixture file:

| Quantity | Reference |
|---|---|
| Planetary longitudes, speeds, ayanamsa | `swetest` from the official Swiss Ephemeris distribution, same data files (`sepl_*.se1`, `semo_*.se1`), same flags |
| Geocentric positions, rise and set times | JPL Horizons (ssd.jpl.nasa.gov/horizons) |
| Sunrise, sunset, twilight | US Naval Observatory Astronomical Applications data; JPL Horizons |
| Julian day, delta T | Swiss Ephemeris `swe_julday` / `swe_deltat`; Espenak and Meeus tables |
| Tithi, nakshatra, yoga, karana, sunrise-based panchanga | Rashtriya Panchang (Positional Astronomy Centre, Kolkata), cross-checked with `swetest` |
| Classical rules (dashas, vargas, karakas) | Worked examples quoted from the text named in docs/CANON.md |
| Pañcāṅga end times, day divisions, months (secondary) | Drik Panchang (drikpanchang.com), an independent computation with the same conventions, to the minute; until Rashtriya Panchang data are available |

## Rules for reference tests

* Compare unrounded values. State the tolerance in the test and say why (for example, 0.001″ for longitudes against `swetest` with identical data files).
* Assert the Swiss Ephemeris return flags on every call. If a result came from the Moshier fallback, the test fails.
* Cover dates inside and outside 1800–2400, and check that results outside that range are marked reduced precision.
* Never update a fixture to make a failing test pass without recording why in the commit message.

## Engine reference tests

Fixtures live in `packages/engine/test/fixtures/`, each recording its source, query and retrieval date; `npm run fetch:references -w @aletheia/engine` regenerates them (seeded, so the same instants come back). Tests read only the fixtures and run offline. Tolerances were set before measuring; results are from the commit that introduced them.

| Test | Reference | Compared | Tolerance and why | Result |
|---|---|---|---|---|
| `horizons.test.ts` | JPL Horizons, 60 seeded instants 1900–2100 × Sun, Moon, Mercury–Saturn | Apparent geocentric ecliptic longitude | **1″** (task target) | Worst +0.27″ (Jupiter); Sun–Mars ≤ 0.212″ |
| `eclipses.test.ts` | NASA Five Millennium Canon, 20 eclipses 1950–2050, every type | Type; greatest eclipse in TT | Type exact; 60 s gross-error guard only (task: report residuals) | Types all match; worst 4.67 s solar, 4.66 s lunar |
| `events.test.ts` | NASA phases 2010–2011 (49) | New and full moons, UT | 60 s (NASA rounds to the minute) | Worst 35.1 s |
| `events.test.ts` | Re-evaluation; brute-force scans | Every event of 2026 (3139): crossing within ±0.5 s; pada ingresses vs hourly scan | Exact | All pass |
| `riseset.test.ts` | USNO, 8 places × 3 dates 1950–2050 | Sun and Moon rise and set, upper limb | 60 s (minute rounding, 34′ vs 34.6′ refraction) | 96 times, worst −34.2 s |
| `riseset.test.ts` | Definition | Hindu rise/set: centre on the geometric horizon | 1 s | Worst 0.345 s |
| `houses.test.ts` | JPL Horizons LAST, 4 sites × 6 instants 1962–2020 | ARMC / 15 | 0.05 s of time | **Fails: worst 0.061 s** (see below) |
| `houses.test.ts` | Textbook formula | Ascendant from ARMC, latitude, true obliquity | 1e-6″ | Pass |
| `ayanamsa.test.ts` | IAE 1989 p. 556 | Lahiri at 1956-03-21 0h TT | 0.01″ | 0.008″ (IAU 1980 vs 2000B nutation) |
| `invariants.test.ts` | — | Ketu = Rahu + 180°; sidereal = tropical − ayanamsa; tithis 1…30 between new moons | 2 ulp of 360; 1e-9° | Pass (see exceptions) |
| `coverage.test.ts` | `vendor/BUILD.json`, file headers | Shipped bytes; coverage; Moshier outside; every function throws without files | Exact | Pass |
| `panchang.test.ts` | Drik Panchang, 12 days 1990–2024, New Delhi, Ujjain, Chennai, Mumbai | Sunrise, sunset; end of every tithi, nakṣatra, yoga, karaṇa of the day; Rāhu kāla, Yamagaṇḍa, Gulika, abhijit; months; Śaka year | 90 s (Drik shows minutes; coordinates and elevation may differ) | Sunrise/sunset worst 36 s; tithi 87 s; karaṇa 88 s; nakṣatra 65 s; day portions 33 s; months and years all agree. **Fails: yoga worst 135 s** (see below) |
| `panchang.test.ts` | Definition; BPHS 3.66–69; SS 12.78–79; SS 2.67 | Limbs tile the day; each boundary crosses its multiple within ±0.5 s; day eighths and lords; horā order; adhika Jyeṣṭha 2026 | Exact | Pass |
| `vargas.test.ts` | BPHS 6.5–33; BJ 1.4, 1.6, 1.7, 1.11 | Every varga rule; D9 = pada at 100 000 longitudes; D60 worked by hand; boundaries ±1e-9° | Exact | Pass |
| `dignity.test.ts` | BJ 1.13–14, 2.16–17 | Exaltation degrees; MT; natural friendship derived from BPHS 3.55 equals Varāhamihira's table | Exact | Pass |
| `ashtakavarga.test.ts` | BPHS 66.16–60, BJ 9.1–7, each transcribed in its own form | Both tables; karaṇa counts; the four BPHS/BJ differences; totals; reductions case by case | Exact | Pass (one karaṇa count in the BPHS e-text contradicts its own list: Venus, 4th) |
| `dasha.test.ts` | BPHS 46.12–16, 46.155–167, 46.195–200, 51.1–2, worked by hand | Lords, balance, antardaśās, yoginīs, cara daśā counts and every two-lord test | 1e-9 day | Pass |
| `shadbala.test.ts` | BPHS 26.6–12 read off the verses; khaṇḍas vs sine; SS 1.51–52; Swiss Ephemeris heliocentric longitudes 1800–2400 | Aspects; ayana; year and month lords; Meeus mean longitudes within the equation of centre, averaging out; ceṣṭā at opposition/conjunction; natonnata at noon; pakṣa at full moon | Exact; mean longitudes within e.o.c. + margin, mean < 0.5° | Pass |
| `jaimini.test.ts` | BPHS 29.5 worked example; 31.3–7, 32.3–5 worked by hand; spherical astronomy; the 2020-12-21 Jupiter–Saturn conjunction | Kārakas, padas, argalā; kālāṃśa = ΔRA at the equator; arcs; war detection and victor | Exact (1e-9°) | Pass |
| `sources.test.ts` | `verses.json` | Every cited verse has Sanskrit and a translation; nothing uncited; open rules say what is open | Exact | Pass |
| `consistency.test.ts` | Invariants | 1000 seeded random charts 1800–2400 (lat ±60°): SAV 337 and per-graha totals in both tables; D9 = pada; daśās tile at five levels; padas; kāraka order; ṣaḍbala ranges and sums; 200 pañcāṅgas tile; reduced precision outside the files | Exact | Pass (≈12 s) |

### Positions against JPL Horizons: how the frames are matched

* Instant: Horizons is asked for Julian days in TT, and the test uses the epoch Horizons echoes (it differs from the request by ~0.1 ms after Horizons' TT→TDB→TT round trip). No delta T enters.
* Observer: Earth's centre (`500@399`); Swiss Ephemeris geocentric default.
* Corrections: apparent place with light-time, gravitational deflection and annual aberration, no refraction (Horizons quantity 31, `AIRLESS`); Swiss Ephemeris default flags.
* Frame: ecliptic and true equinox of date, nutation included in both.
* Remaining difference: the precession-nutation model, IAU 1976/1980 in Horizons, IAU 2006/2000B in the engine. A diagnostic isolates it: Horizons' astrometric ICRF RA/Dec (quantity 1) involves no precession or nutation, and there the engine agrees to 1–4 mas for Sun–Mars, 0.071″ Jupiter and 0.048″ Saturn. Those two are exactly the system-barycentre offsets (the engine uses barycentres; Horizons the planets' centres). So the ~0.2″ in ecliptic longitude is the frame model, not the ephemeris.
* Swiss Ephemeris' Horizons-emulation flags (`SEFLG_JPLHOR*`) are silently dropped by the library unless it reads JPL's own binary files (sweph.c), so they cannot be used for this.

### Sidereal time against JPL: the open failure

One of 24 instants (Ujjain, 1978) misses 0.05 s by 0.011 s. Measured against IERS C04 daily UT1, each residual is the sum of two Earth-orientation effects the engine does not model: the library's delta T is a smoothed yearly table (up to 0.057 s from measured UT1), and Horizons applies polar motion to the site's longitude (up to −0.037 s at London, growing with tan latitude). The tolerance is unchanged pending Nilesh's decision.

### Ayanamsa exceptions

For modes 18, 19, 20 and 34 (J2000, J1900, B1950, Skydram) the library defines sidereal positions as a projection onto the ecliptic of the mode's epoch, so sidereal ≠ tropical − ayanamsa by a few arcseconds; the test checks that exactly these four differ. No mode needs `sefstars.txt`: the reference stars are built into the library.

## Screenshots

Any UI change is screenshotted on both phone profiles before it is committed. The clock is frozen in the Playwright tests so screenshots are reproducible. `truth.spec.ts` also checks that each phone shows exactly the arcseconds the engine computes in Node for the same instant.

### Pañcāṅga against Drik Panchang: the yoga failure

Yoga ends are 30–135 s earlier than Drik's (mean −71 s), nakṣatra ends about half as much (mean −25 s), while tithi and karaṇa ends, which do not depend on the ayanāṃśa, scatter around zero within the minute rounding. Yoga depends on the ayanāṃśa twice and nakṣatra once, so Drik's Lahiri is about 15–20″ larger than `SE_SIDM_LAHIRI`, which matches IAE 1989 to 0.008″ (`ayanamsa.test.ts`). Rerunning with the other Lahiri modes (43 Lahiri 1940, 46 Lahiri ICRC) fits worse. Three Drik new-moon times are 64–87 s earlier than ours; ours agree with NASA's phase tables to 35 s (`events.test.ts`). The 90 s tolerance, set before measuring, is unchanged pending Nilesh's decision.
