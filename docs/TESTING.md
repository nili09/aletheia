# Testing

Accuracy is priority zero, so tests come before features. A feature is not done until its numbers agree with an outside reference that we did not compute ourselves.

## Layers

| Layer | Tool | Where | Command |
|---|---|---|---|
| Engine unit and reference tests | Vitest | `packages/engine/test` | `npm test -w @aletheia/engine` |
| Web unit tests | Vitest | `apps/web/src/**/*.test.ts(x)` | `npm test -w @aletheia/web` |
| Phone screenshots | Playwright (iPhone 13 on WebKit, Pixel 7 on Chromium) | `apps/web/e2e` | `npm run e2e` |

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

## Rules for reference tests

* Compare unrounded values. State the tolerance in the test and say why (for example, 0.001″ for longitudes against `swetest` with identical data files).
* Assert the Swiss Ephemeris return flags on every call. If a result came from the Moshier fallback, the test fails.
* Cover dates inside and outside 1800–2400, and check that results outside that range are marked reduced precision.
* Never update a fixture to make a failing test pass without recording why in the commit message.

## Screenshots

Any UI change is screenshotted on both phone profiles before it is committed. The clock is frozen in the Playwright tests so screenshots are reproducible.
