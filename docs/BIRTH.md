# Birth inputs

Wrong birth data is the commonest cause of a wrong chart. `packages/birth` makes the inputs as trustworthy as the engine: where (an offline place index), on which clock (IANA time zones, and India's own clock history), and so at which instant. The engine then says how far the time can move before the chart changes.

## Pieces

| Path | What |
|---|---|
| `packages/birth/data/places-india.txt`, `places-world.txt` | The place index from GeoNames (CC BY 4.0): every populated place in India with its district and state, and towns of 5 000+ elsewhere. 612 216 places, 15.5 MB of text, about 7.3 MB compressed |
| `packages/birth/data/zones.json` | Every IANA zone's UTC offset, 1800–2099, each change to the second (tzdb 2026e) |
| `src/places.ts` | Reads the index; search (exact, prefix, word prefix; old names such as Bombay and Calcutta; “Rampur, Bareilly” narrows by district); nearest place |
| `src/zones.ts` | Offset at an instant; the instants a wall-clock reading can mean (one, two in a fall-back fold, none in a spring-forward gap) |
| `src/india.ts` | India's clocks: local mean time, Madras railway time, IST, Calcutta Time, Bengal war time, war time, Bombay Time, each with its period and sources (docs/CANON.md) |
| `src/civil.ts` | A birth as written → the clock options and their instants; local mean time and a stated offset for any birth |
| `packages/engine/src/jyotish/sensitivity.ts` | How far the time can move before the lagna, navāṃśa lagna, D60 lagna or Moon's nakṣatra changes |
| `apps/web/src/birth/` | The birth worker (search, zone lookup, clock question, off the main thread), the New chart and Charts screens, IndexedDB storage, export and import, the Nominatim fallback |

## The flow

1. **Name, date and time as written.** Day, month, year; hour, minute and optional second, 24-hour.
2. **Place.** Typing searches the offline index in the birth worker (the index loads on first use and is cached by the service worker). Each result shows its district and state. If the place is missing: **Search OpenStreetMap** (online, after consent, see below) or **Enter coordinates** (decimal degrees; the zone comes from the timezone-boundary-builder polygons, the state and district from the nearest indexed place, shown with its distance).
3. **Clock.** If only one clock is possible, it is shown with its offset. If more than one is (an Indian birth in an ambiguous period, or a daylight-saving change), the screen asks **Which clock was the time read on?**, says why, and under each option shows what changes against the first, for example “39 minutes apart; lagna moves from Mithuna to Karka”. Nothing is pre-selected; saving waits for the choice. ⓘ shows the offset, the instant in UTC, the tzdb's own reading and the sources. **Another clock…** adds local mean time and a typed UTC offset.
4. **How sure is the time:** birth certificate, family memory, rectified, unknown.
5. **Save.** The chart is stored on the device; the app asks the browser for persistent storage.

**Charts** lists saved charts, newest first, each with its line of sensitivity, for example “Lagna holds −24 min / +1 h 48 min · Navāṃśa lagna −9 / +5 min · D60 −9 s / +2 min · Moon’s nakṣatra −22 h 55 min / +1 h 34 min”. Durations are truncated, never rounded up: the lagna holds at least that long. Tapping a chart shows the written time, the clock and offset, the instant (UTC, JD UT, ΔT), each crossing to a tenth of a second with the sign or nakṣatra it leads to, the conventions, and the place's coordinates, elevation, zone and source.

**Export** writes every chart to one file (`aletheia-charts-YYYY-MM-DD.json`, format `aletheia-charts` version 1); **Import** reads such a file, checks every field, and adds or replaces charts by id.

## The five test births (checkpoint)

From `apps/web/src/birth/format.test.ts` (engine in Node) and `apps/web/e2e/birth.spec.ts` (both phones). Lahiri, whole-sign lagna.

| Birth as written | Clocks offered (first is the commonest) | What the second clock changes |
|---|---|---|
| Mumbai, 12 May 1934, 10:15 | IST · Bombay Time | 39 minutes apart; lagna moves from Mithuna to Karka; navāṃśa lagna from Mithuna to Siṃha |
| Mumbai, 20 Aug 1943, 06:40 | War time (IST + 1 h) · IST · Bombay Time | IST: 1 hour apart; lagna moves from Karka to Siṃha; navāṃśa lagna from Makara to Mithuna. Bombay Time: 1 h 39 min apart; lagna Karka → Siṃha; navāṃśa Makara → Siṃha |
| Kolkata, 3 Nov 1938, 21:30 | Calcutta Time · IST | 23 min 20 s apart; navāṃśa lagna from Meṣa to Vṛṣabha |
| Kolkata, 10 Mar 1942, 04:50 | Bengal war time · IST | 1 hour apart; lagna moves from Makara to Kumbha; navāṃśa lagna from Mithuna to Vṛścika |
| Kolkata, 14 Feb 1948, 13:05 | IST · Calcutta Time | 23 min 20 s apart; lagna moves from Mithuna to Vṛṣabha; navāṃśa lagna from Tulā to Kanyā |

Controls (`packages/birth/test/india.test.ts`): Mumbai 1958 and Kolkata 1950 ask nothing (IST); Delhi 1938 asks nothing; Delhi 1943 asks war time or IST; Delhi December 1941 offers the tzdb's +6:30; Chennai 1890 offers local mean time or Madras time.

Screenshots: `docs/screenshots/birth-search-*`, `birth-clock-*`, `clock-<city>-<year>-*` (the question for each of the five), `charts-*`, `charts-trace-*`, `birth-consent-*`, on iPhone 13 and Pixel 7.

## Privacy

Everything above runs on the device. The one exception is **Search OpenStreetMap**: the first time, the app asks “Search OpenStreetMap? The words in the search box are sent to nominatim.openstreetmap.org (OpenStreetMap Foundation). Nothing else leaves this device.” Only after “Yes” is anything sent, and then only the search words. Within Nominatim's usage policy: one request at a time and at most one a second, only on a button press (no search-as-you-type), results cached for the session, the browser's Referer identifies the app, and results carry “© OpenStreetMap contributors, ODbL”. The consent is kept in `localStorage` (`aletheia.consent.openstreetmap`, with its date).

Saved charts live in IndexedDB (`aletheia`, store `charts`) and leave the device only in a file the owner exports.

## Rebuilding the data

Only needed to refresh GeoNames or move to a new tzdb release; the app build never downloads anything.

```bash
npm run build:places -w @aletheia/birth
```

```bash
npm run build:zones -w @aletheia/birth
```

`build:places` downloads `IN.zip`, `cities5000.zip`, `admin1CodesASCII.txt`, `admin2Codes.txt` and `countryInfo.txt` from download.geonames.org. `build:zones` needs Python 3.9+ (`zoneinfo`): it downloads the pinned `tzdata` wheel from PyPI (version and SHA-256 in `scripts/build-zones.py`) and the IANA source of the same release, then regenerates the ICU cross-check (`test/fixtures/icu-zones.json`, about 8 minutes). Update `RELEASED_SINCE_ICU` in `test/zones.test.ts` from the tzdb NEWS file when the releases differ.

## Not done

* Times written in ghaṭīs and palas from sunrise (the older Indian way) are not yet an input.
* Saved charts cannot yet be edited or deleted in the app (to remove one: export, clear the site's data, edit the file, import it).
* Births before 1800 outside India have no zone table: read them on local mean time or a stated offset.
