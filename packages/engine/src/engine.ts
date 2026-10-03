/**
 * The astronomy engine: one Swiss Ephemeris instance, its data files, and the settings
 * that every result depends on. Pure and deterministic: the same inputs and files give the
 * same numbers. Synchronous once created; the app runs it in a Web Worker (src/worker).
 *
 * Data files are added by the host (Node reads them from disk, the worker fetches them) so
 * this module has no I/O. Files are needed lazily: the planet and Moon files for any
 * instant they cover, the star catalogue only for fixed stars.
 */
import { ayanamsa, DEFAULT_AYANAMSA, assertAyanamsaMode, type Ayanamsa } from './ayanamsa.ts';
import { nextLunarEclipse, nextSolarEclipse, type LunarEclipse, type SolarEclipse } from './eclipses.ts';
import { findEvents, verifyEvent, type AstroEvent, type EventCheck, type EventKind } from './events/events.ts';
import { GRAHAS, grahaPosition, type Graha, type GrahaPosition, type NodeKind } from './grahas.ts';
import { DEFAULT_HOUSE_SYSTEM, houses, type Houses, type HouseSystem, type Place } from './houses.ts';
import { DEFAULT_RISE_CONVENTION, nextRiseSet, type RiseConvention, type RiseSet, type RisingBody } from './riseset.ts';
import { fixedStar, YOGATARAS, type FixedStar, type Yogatara } from './stars.ts';
import { SwissEph, SwissEphError, type FileData, type LoadOptions } from './swe/swisseph.ts';
import { instantFromJdTT, instantFromJdUT, instantFromUnixMs, unixMsFromInstant, type Instant } from './time.ts';
import { buildChart, type Chart } from './jyotish/chart.ts';
import { kundali, type Kundali } from './jyotish/kundali.ts';
import { panchang, type Panchang } from './jyotish/panchang.ts';
import { DEFAULT_JYOTISH, type JyotishSettings } from './jyotish/settings.ts';

export const PLANET_FILES = ['sepl_18.se1', 'semo_18.se1'] as const;
export const STAR_FILE = 'sefstars.txt';
export const EPHE_FILES = [...PLANET_FILES, STAR_FILE] as const;
export type EpheFile = (typeof EPHE_FILES)[number];

/** Default conventions (docs/CANON.md), all switchable. */
export interface Settings {
  ayanamsa: number;
  node: NodeKind;
  houseSystem: HouseSystem;
  riseConvention: RiseConvention;
}
export const DEFAULT_SETTINGS: Readonly<Settings> = {
  ayanamsa: DEFAULT_AYANAMSA,
  node: 'true',
  houseSystem: DEFAULT_HOUSE_SYSTEM,
  riseConvention: DEFAULT_RISE_CONVENTION,
};

/** An instant as Unix milliseconds (UTC), a Julian day in TT, or a Julian day in UT1. */
export type TimeInput = { unixMs: number } | { jdTT: number } | { jdUT: number };

export class Engine {
  private constructor(readonly swe: SwissEph) {}

  static async create(options: LoadOptions = {}): Promise<Engine> {
    return new Engine(await SwissEph.load(options));
  }

  get version(): string {
    return this.swe.version;
  }

  // ---------- files ----------

  addFile(name: EpheFile, bytes: Uint8Array): void {
    if (!EPHE_FILES.includes(name)) throw new RangeError(`unknown ephemeris file ${name}`);
    this.swe.addFile(name, bytes);
  }

  hasFile(name: EpheFile): boolean {
    return this.swe.hasFile(name);
  }

  /** Files a request will need that are not loaded yet. */
  missingFiles(need: { stars?: boolean }): EpheFile[] {
    const want: EpheFile[] = [...PLANET_FILES];
    if (need.stars) want.push(STAR_FILE);
    return want.filter((f) => !this.hasFile(f));
  }

  /** Data of the files last used (call after a computation): path, JD range, JPL number. */
  fileData(): FileData[] {
    return [0, 1].map((i) => this.swe.currentFileData(i)).filter((d): d is FileData => d !== null);
  }

  // ---------- time ----------

  instant(t: TimeInput): Instant {
    if ('unixMs' in t) return instantFromUnixMs(this.swe, t.unixMs);
    if ('jdTT' in t) return instantFromJdTT(this.swe, t.jdTT);
    return instantFromJdUT(this.swe, t.jdUT);
  }

  unixMs(instant: Instant): number {
    return unixMsFromInstant(this.swe, instant);
  }

  // ---------- sky ----------

  position(t: TimeInput, graha: Graha, s: Pick<Settings, 'ayanamsa' | 'node'> = DEFAULT_SETTINGS): GrahaPosition {
    const instant = this.prepare(t, s.ayanamsa);
    return grahaPosition(this.swe, instant, graha, s.node);
  }

  positions(t: TimeInput, s: Pick<Settings, 'ayanamsa' | 'node'> = DEFAULT_SETTINGS): GrahaPosition[] {
    const instant = this.prepare(t, s.ayanamsa);
    return GRAHAS.map((g) => grahaPosition(this.swe, instant, g, s.node));
  }

  ayanamsa(t: TimeInput, mode: number = DEFAULT_AYANAMSA): Ayanamsa {
    return ayanamsa(this.swe, this.prepare(t, mode), mode);
  }

  houses(t: TimeInput, place: Place, s: Pick<Settings, 'ayanamsa' | 'houseSystem'> = DEFAULT_SETTINGS): Houses {
    return houses(this.swe, this.prepare(t, s.ayanamsa), place, s.houseSystem);
  }

  riseSet(t: TimeInput, body: RisingBody, place: Place, convention: RiseConvention = DEFAULT_RISE_CONVENTION): RiseSet {
    return nextRiseSet(this.swe, this.prepare(t), body, place, convention);
  }

  solarEclipse(t: TimeInput, backward = false): SolarEclipse {
    return nextSolarEclipse(this.swe, this.prepare(t), backward);
  }

  lunarEclipse(t: TimeInput, backward = false): LunarEclipse {
    return nextLunarEclipse(this.swe, this.prepare(t), backward);
  }

  fixedStar(t: TimeInput, star: string, mode: number = DEFAULT_AYANAMSA): FixedStar {
    return fixedStar(this.swe, this.prepare(t, mode, true), star);
  }

  yogataras(t: TimeInput, mode: number = DEFAULT_AYANAMSA): Array<Yogatara & { position: FixedStar }> {
    const instant = this.prepare(t, mode, true);
    return YOGATARAS.map((y) => ({ ...y, position: fixedStar(this.swe, instant, y.star) }));
  }

  // ---------- events ----------

  events(q: { start: TimeInput; end: TimeInput; kinds?: readonly EventKind[]; grahas?: readonly Graha[] }, s: Pick<Settings, 'ayanamsa' | 'node'> = DEFAULT_SETTINGS): AstroEvent[] {
    const start = this.prepare(q.start, s.ayanamsa);
    const end = this.instant(q.end);
    this.requireFiles(end);
    const query = { startTT: start.jdTT, endTT: end.jdTT, node: s.node, ...(q.kinds && { kinds: q.kinds }), ...(q.grahas && { grahas: q.grahas }) };
    return findEvents(this.swe, query);
  }

  /** The next `count` events after t (searching up to `maxDays` ahead). */
  nextEvents(t: TimeInput, count: number, opts: { kinds?: readonly EventKind[]; grahas?: readonly Graha[]; maxDays?: number } = {}, s: Pick<Settings, 'ayanamsa' | 'node'> = DEFAULT_SETTINGS): AstroEvent[] {
    if (!Number.isInteger(count) || count < 1) throw new RangeError(`count must be a positive integer, got ${count}`);
    const start = this.prepare(t, s.ayanamsa);
    const maxDays = opts.maxDays ?? 400;
    for (let days = 1; ; days = Math.min(days * 4, maxDays)) {
      const found = this.events({ start: { jdTT: start.jdTT }, end: { jdTT: start.jdTT + days }, ...opts }, s);
      if (found.length >= count || days >= maxDays) return found.slice(0, count);
    }
  }

  verifyEvent(e: AstroEvent, s: Pick<Settings, 'ayanamsa' | 'node'> = DEFAULT_SETTINGS): EventCheck {
    this.prepare({ jdTT: e.instant.jdTT }, s.ayanamsa);
    return verifyEvent(this.swe, s.node, e);
  }

  // ---------- jyotish ----------

  /** The pañcāṅga of the vāra day (sunrise to next sunrise at the place) containing t. */
  panchang(t: TimeInput, place: Place, s: JyotishSettings = DEFAULT_JYOTISH): Panchang {
    return panchang(this.swe, this.prepare(t, s.ayanamsa), place, s);
  }

  /** The chart data the jyotish rules work from. */
  chart(t: TimeInput, place: Place, s: JyotishSettings = DEFAULT_JYOTISH): Chart {
    return buildChart(this.swe, this.prepare(t, s.ayanamsa), place, s);
  }

  /** The full analysis of a chart: vargas, states, Jaimini, aṣṭakavarga, ṣaḍbala, daśās. */
  kundali(t: TimeInput, place: Place, s: JyotishSettings = DEFAULT_JYOTISH): Kundali {
    return kundali(this.chart(t, place, s));
  }

  // ---------- internals ----------

  /** Resolve the instant, check the files it needs are present, and set the sidereal mode. */
  private prepare(t: TimeInput, mode: number = DEFAULT_AYANAMSA, stars = false): Instant {
    assertAyanamsaMode(mode);
    const instant = this.instant(t);
    this.requireFiles(instant, stars);
    this.swe.setSidMode(mode);
    return instant;
  }

  private requireFiles(instant: Instant, stars = false): void {
    if (instant.ephemeris === 'swiss') {
      for (const f of PLANET_FILES) {
        if (!this.hasFile(f)) throw new SwissEphError('engine', `ephemeris file ${f} is not loaded`);
      }
    }
    if (stars && !this.hasFile(STAR_FILE)) throw new SwissEphError('engine', `star catalogue ${STAR_FILE} is not loaded`);
  }
}
