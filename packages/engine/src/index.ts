/**
 * @aletheia/engine: pure, deterministic astronomy on the Swiss Ephemeris (WebAssembly).
 *
 * No UI code lives here. The app runs Engine inside a Web Worker (./worker); tests and
 * scripts use it directly.
 */

export { Engine, DEFAULT_SETTINGS, EPHE_FILES, PLANET_FILES, STAR_FILE } from './engine.ts';
export type { EpheFile, Settings, TimeInput } from './engine.ts';
export { precisionForJdTT, FULL_PRECISION_JD_TT } from './precision.ts';
export type { Precision } from './precision.ts';
export type { Instant } from './time.ts';
export { GRAHAS } from './grahas.ts';
export type { Coordinates, Graha, GrahaPosition, NodeKind } from './grahas.ts';
export { AYANAMSA_MODES, DEFAULT_AYANAMSA, ECLIPTIC_T0_AYANAMSAS } from './ayanamsa.ts';
export type { Ayanamsa } from './ayanamsa.ts';
export { HOUSE_SYSTEMS, DEFAULT_HOUSE_SYSTEM } from './houses.ts';
export type { Houses, HouseSystem, Place } from './houses.ts';
export { RISE_CONVENTIONS, DEFAULT_RISE_CONVENTION } from './riseset.ts';
export type { RiseConvention, RiseSet, RisingBody } from './riseset.ts';
export type { LunarEclipse, LunarEclipseType, SolarEclipse, SolarEclipseType } from './eclipses.ts';
export { YOGATARAS, YOGATARAS_STATUS } from './stars.ts';
export type { FixedStar, Yogatara } from './stars.ts';
export { EVENT_KINDS } from './events/events.ts';
export type { AstroEvent, ConjunctionEvent, EventCheck, EventKind, IngressEvent, StationEvent, TithiEvent } from './events/events.ts';
export { brent, findCrossing, findCrossings, wrap180, SECOND } from './events/roots.ts';
export type { CrossingOptions } from './events/roots.ts';
export { NAKSHATRAS, RASHIS, nakshatraPada, signIndex } from './zodiac.ts';
export { compareWithHorizons, HORIZONS_BODIES, LONGITUDE_TOLERANCE_ARCSEC } from './verify/horizons.ts';
export type { BodyReport, HorizonsFixture, HorizonsReport } from './verify/horizons.ts';
export { SwissEphError } from './swe/swisseph.ts';
