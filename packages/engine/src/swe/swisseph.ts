/**
 * Thin, typed binding to the Swiss Ephemeris WebAssembly build.
 *
 * Every call checks what the library reports back (CLAUDE.md, "Priority zero"):
 *   - a negative return value is an error and throws;
 *   - for calls that report the ephemeris actually used, it must be the one requested,
 *     so a silent fallback from the Swiss Ephemeris files to the Moshier ephemeris throws;
 *   - any text the library leaves in its error buffer throws, because the library uses that
 *     buffer to announce substitutions (for example "using Moshier eph.").
 *
 * Nothing here rounds anything. Scratch memory is allocated once and reused; the class is
 * not re-entrant, which is fine because it runs on one thread (a Web Worker in the app).
 */
import createSwissEph from '../../vendor/swisseph.mjs';
import type { SwissEphModule } from './module.ts';
import {
  AS_MAXCH,
  ERR,
  SE_GREG_CAL,
  SE_MAX_STNAME,
  SEFLG_EPHMASK,
  SEFLG_MOSEPH,
  SEFLG_SWIEPH,
} from './constants.ts';

export type Ephemeris = 'swiss' | 'moshier';

export function ephemerisFlag(e: Ephemeris): number {
  return e === 'swiss' ? SEFLG_SWIEPH : SEFLG_MOSEPH;
}

export class SwissEphError extends Error {
  override readonly name = 'SwissEphError';
  constructor(
    readonly fn: string,
    message: string,
  ) {
    super(`${fn}: ${message}`);
  }
}

/** Six doubles as the library returns them (longitude, latitude, distance and their speeds). */
export type Six = [number, number, number, number, number, number];

export interface Flagged<T> {
  /** The flags the library reports it actually used. */
  flags: number;
  value: T;
}

export interface FileData {
  path: string;
  /** First and last Julian day (TT) the file covers. */
  start: number;
  end: number;
  /** JPL ephemeris number the file was generated from, e.g. 441. */
  jplNumber: number;
}

export interface LoadOptions {
  wasmBinary?: ArrayBuffer | Uint8Array;
  locateFile?: (path: string, scriptDirectory: string) => string;
}

const EPHE_DIR = '/ephe';

export class SwissEph {
  private readonly m: SwissEphModule;
  private readonly serr: number;
  private readonly d: number; // 64 doubles of scratch
  private readonly i: number; // 8 int32 of scratch
  private readonly s: number; // string scratch
  private readonly cusps: number;
  private readonly ascmc: number;
  private readonly cuspSpeed: number;
  private readonly ascmcSpeed: number;
  private sidMode = Number.NaN;

  /** "2.10.03" */
  readonly version: string;

  private constructor(m: SwissEphModule) {
    this.m = m;
    this.serr = m._malloc(AS_MAXCH);
    this.d = m._malloc(64 * 8);
    this.i = m._malloc(8 * 4);
    this.s = m._malloc(2 * SE_MAX_STNAME + 1);
    this.cusps = m._malloc(37 * 8);
    this.ascmc = m._malloc(10 * 8);
    this.cuspSpeed = m._malloc(37 * 8);
    this.ascmcSpeed = m._malloc(10 * 8);
    m._swe_version(this.s);
    this.version = m.UTF8ToString(this.s);
    m.FS.mkdir(EPHE_DIR);
    this.withString(EPHE_DIR, (p) => m._swe_set_ephe_path(p));
  }

  static async load(options: LoadOptions = {}): Promise<SwissEph> {
    return new SwissEph(await createSwissEph(options));
  }

  // ---------- data files ----------

  addFile(name: string, bytes: Uint8Array): void {
    this.m.FS.writeFile(`${EPHE_DIR}/${name}`, bytes);
    // Make the library reopen files: it caches "file not found" decisions.
    this.reset();
  }

  /**
   * Close all files and forget cached state. Called after every error: after a failed file
   * switch at the edge of the coverage the library can otherwise ask for the wrong file on
   * the next, valid, call (test/coverage.test.ts reproduces this).
   */
  private reset(): void {
    this.m._swe_close();
    this.withString(EPHE_DIR, (p) => this.m._swe_set_ephe_path(p));
    this.sidMode = Number.NaN;
  }

  private fail(fn: string, message: string): never {
    this.reset();
    throw new SwissEphError(fn, message);
  }

  /**
   * For functions that do not report which ephemeris they used (rising and setting,
   * eclipse searches): recompute the Sun and the Moon, with flags checked, at the given
   * Julian days (UT). If the requested Swiss files did not cover any of them, the library
   * fell back to Moshier inside the search, and this throws.
   */
  private probe(fn: string, epheflag: number, jdUTs: readonly number[]): void {
    if (!(epheflag & SEFLG_SWIEPH)) return;
    for (const jd of jdUTs) {
      if (!jd) continue;
      for (const ipl of [0, 1]) {
        this.clearErr();
        const ret = this.m._swe_calc_ut(jd, ipl, SEFLG_SWIEPH, this.d + 48 * 8, this.serr);
        const e = this.err();
        if (ret < 0 || (ret & SEFLG_EPHMASK) !== SEFLG_SWIEPH || e) {
          this.fail(fn, `the Swiss Ephemeris files do not cover JD UT ${jd}${e ? `: ${e}` : ''}`);
        }
      }
    }
  }

  hasFile(name: string): boolean {
    return this.m.FS.analyzePath(`${EPHE_DIR}/${name}`).exists;
  }

  /** Data of the ephemeris file last used for slot ifno (0 planets, 1 Moon). */
  currentFileData(ifno: number): FileData | null {
    const { m } = this;
    const p = m._swe_get_current_file_data(ifno, this.d, this.d + 8, this.i);
    if (!p) return null;
    const path = m.UTF8ToString(p);
    if (!path) return null;
    return { path, start: this.f64(0), end: this.f64(1), jplNumber: m.HEAP32[this.i >> 2]! };
  }

  // ---------- positions ----------

  /** swe_calc: position at a Julian day in TT. */
  calc(jdTT: number, ipl: number, iflag: number): Flagged<Six> {
    this.clearErr();
    const ret = this.m._swe_calc(jdTT, ipl, iflag, this.d, this.serr);
    this.checkEphemeris('swe_calc', iflag, ret);
    return { flags: ret, value: this.six(0) };
  }

  setSidMode(mode: number): void {
    if (mode === this.sidMode) return;
    this.m._swe_set_sid_mode(mode, 0, 0);
    this.sidMode = mode;
  }

  /** True ayanamsa (with nutation) unless SEFLG_NONUT is in iflag. Uses the current sidereal mode. */
  ayanamsa(jdTT: number, iflag: number): Flagged<number> {
    this.clearErr();
    const ret = this.m._swe_get_ayanamsa_ex(jdTT, iflag, this.d, this.serr);
    this.checkEphemeris('swe_get_ayanamsa_ex', iflag, ret);
    return { flags: ret, value: this.f64(0) };
  }

  ayanamsaName(mode: number): string {
    const p = this.m._swe_get_ayanamsa_name(mode);
    return p ? this.m.UTF8ToString(p) : '';
  }

  // ---------- time ----------

  julday(year: number, month: number, day: number, hour: number): number {
    return this.m._swe_julday(year, month, day, hour, SE_GREG_CAL);
  }

  revjul(jd: number): { year: number; month: number; day: number; hour: number } {
    const { m } = this;
    m._swe_revjul(jd, SE_GREG_CAL, this.i, this.i + 4, this.i + 8, this.d);
    const i32 = m.HEAP32;
    const b = this.i >> 2;
    return { year: i32[b]!, month: i32[b + 1]!, day: i32[b + 2]!, hour: this.f64(0) };
  }

  /** UTC calendar time to [JD TT, JD UT1], with leap seconds (swe_utc_to_jd). */
  utcToJd(year: number, month: number, day: number, hour: number, minute: number, second: number): { jdTT: number; jdUT: number } {
    this.clearErr();
    const ret = this.m._swe_utc_to_jd(year, month, day, hour, minute, second, SE_GREG_CAL, this.d, this.serr);
    if (ret === ERR) this.fail('swe_utc_to_jd', this.err() || 'invalid date');
    return { jdTT: this.f64(0), jdUT: this.f64(1) };
  }

  /** JD UT1 to UTC calendar time. */
  jdUTToUtc(jdUT: number): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
    const { m, i } = this;
    m._swe_jdut1_to_utc(jdUT, SE_GREG_CAL, i, i + 4, i + 8, i + 12, i + 16, this.d);
    const b = i >> 2;
    const i32 = m.HEAP32;
    return { year: i32[b]!, month: i32[b + 1]!, day: i32[b + 2]!, hour: i32[b + 3]!, minute: i32[b + 4]!, second: this.f64(0) };
  }

  /** Delta T = TT - UT1 in days, consistent with the given ephemeris. */
  deltaT(jdUT: number, ephemeris: Ephemeris): number {
    this.clearErr();
    const dt = this.m._swe_deltat_ex(jdUT, ephemerisFlag(ephemeris), this.serr);
    const e = this.err();
    if (e) this.fail('swe_deltat_ex', e);
    return dt;
  }

  /** Greenwich apparent sidereal time in hours. */
  sidtime(jdUT: number): number {
    return this.m._swe_sidtime(jdUT);
  }

  // ---------- houses ----------

  houses(jdUT: number, iflag: number, lat: number, lon: number, hsys: string): { cusps: number[]; ascmc: number[]; cuspSpeed: number[]; ascmcSpeed: number[] } {
    const { m } = this;
    this.clearErr();
    const ret = m._swe_houses_ex2(jdUT, iflag, lat, lon, hsys.charCodeAt(0), this.cusps, this.ascmc, this.cuspSpeed, this.ascmcSpeed, this.serr);
    const e = this.err();
    // On failure (e.g. Placidus inside the polar circles) the library silently returns
    // Porphyry cusps; we refuse instead.
    if (ret === ERR || e) this.fail('swe_houses_ex2', e || `house system ${hsys} failed at latitude ${lat}`);
    const n = hsys === 'G' ? 37 : 13;
    return {
      cusps: this.doubles(this.cusps, n),
      ascmc: this.doubles(this.ascmc, 10),
      cuspSpeed: this.doubles(this.cuspSpeed, n),
      ascmcSpeed: this.doubles(this.ascmcSpeed, 10),
    };
  }

  houseName(hsys: string): string {
    return this.m.UTF8ToString(this.m._swe_house_name(hsys.charCodeAt(0)));
  }

  // ---------- rise, set, horizon ----------

  /**
   * swe_rise_trans. Returns the event time (JD UT), or null when the body does not cross the
   * horizon in the search window (circumpolar).
   */
  riseTrans(jdUT: number, ipl: number, epheflag: number, rsmi: number, lon: number, lat: number, alt: number, atpress: number, attemp: number): number | null {
    const { m, d } = this;
    const geo = d + 16 * 8;
    m.HEAPF64.set([lon, lat, alt], geo >> 3);
    this.clearErr();
    const ret = m._swe_rise_trans(jdUT, ipl, 0, epheflag, rsmi, geo, atpress, attemp, d, this.serr);
    const e = this.err();
    const t = this.f64(0);
    if (ret === -2) {
      this.probe('swe_rise_trans', epheflag, [jdUT]);
      return null;
    }
    if (ret === ERR || e) this.fail('swe_rise_trans', e || 'failed');
    // This function reports no flags and, with a file missing, falls back to Moshier
    // without a word (test/coverage.test.ts); check the files covered the search.
    this.probe('swe_rise_trans', epheflag, [jdUT, t]);
    return t;
  }

  /** Ecliptic (of date) to horizon: [azimuth from south, true altitude, apparent altitude]. */
  azalt(jdUT: number, lon: number, lat: number, alt: number, atpress: number, attemp: number, eclLon: number, eclLat: number): [number, number, number] {
    const { m, d } = this;
    const geo = d + 16 * 8;
    const xin = d + 20 * 8;
    const xaz = d + 24 * 8;
    m.HEAPF64.set([lon, lat, alt], geo >> 3);
    m.HEAPF64.set([eclLon, eclLat, 1], xin >> 3);
    m._swe_azalt(jdUT, 0, geo, atpress, attemp, xin, xaz);
    const [a, b, c] = this.doubles(xaz, 3);
    return [a!, b!, c!];
  }

  // ---------- eclipses ----------

  solEclipseWhenGlob(jdUT: number, epheflag: number, type: number, backward: boolean): { type: number; tret: number[] } {
    this.clearErr();
    const ret = this.m._swe_sol_eclipse_when_glob(jdUT, epheflag, type, this.d, backward ? 1 : 0, this.serr);
    const e = this.err();
    if (ret === ERR || e) this.fail('swe_sol_eclipse_when_glob', e || 'failed');
    const tret = this.doubles(this.d, 10);
    this.probe('swe_sol_eclipse_when_glob', epheflag, [jdUT, ...tret]);
    return { type: ret, tret };
  }

  solEclipseWhere(jdUT: number, epheflag: number): { type: number; geopos: number[]; attr: number[] } {
    const geo = this.d + 16 * 8;
    const attr = this.d + 32 * 8;
    this.clearErr();
    const ret = this.m._swe_sol_eclipse_where(jdUT, epheflag, geo, attr, this.serr);
    const e = this.err();
    if (ret === ERR || e) this.fail('swe_sol_eclipse_where', e || 'failed');
    return { type: ret, geopos: this.doubles(geo, 10), attr: this.doubles(attr, 20) };
  }

  lunEclipseWhen(jdUT: number, epheflag: number, type: number, backward: boolean): { type: number; tret: number[] } {
    this.clearErr();
    const ret = this.m._swe_lun_eclipse_when(jdUT, epheflag, type, this.d, backward ? 1 : 0, this.serr);
    let e = this.err();
    // The search tries candidate full moons; when one is not an eclipse, an inner call
    // writes "no lunar eclipse at tjd = …" and the search moves on to the next, leaving the
    // message behind (swecl.c, swe_lun_eclipse_when, goto next_try). With a valid result
    // that message is stale; ephemeris fallbacks are still caught by probe() below.
    if (ret > 0 && /^no lunar eclipse at tjd = [\d.]+$/.test(e)) e = '';
    if (ret === ERR || e) this.fail('swe_lun_eclipse_when', e || 'failed');
    const tret = this.doubles(this.d, 10);
    this.probe('swe_lun_eclipse_when', epheflag, [jdUT, ...tret]);
    return { type: ret, tret };
  }

  lunEclipseHow(jdUT: number, epheflag: number): { type: number; attr: number[] } {
    const geo = this.d + 16 * 8;
    const attr = this.d + 32 * 8;
    this.m.HEAPF64.set([0, 0, 0], geo >> 3);
    this.clearErr();
    const ret = this.m._swe_lun_eclipse_how(jdUT, epheflag, geo, attr, this.serr);
    const e = this.err();
    if (ret === ERR || e) this.fail('swe_lun_eclipse_how', e || 'failed');
    return { type: ret, attr: this.doubles(attr, 20) };
  }

  // ---------- fixed stars ----------

  /** swe_fixstar2 at a JD in TT. Returns the catalogue's full name, e.g. "Spica,alVir". */
  fixstar(star: string, jdTT: number, iflag: number): Flagged<{ name: string; xx: Six }> {
    const { m } = this;
    const max = 2 * SE_MAX_STNAME + 1;
    if (m.lengthBytesUTF8(star) >= SE_MAX_STNAME) this.fail('swe_fixstar2', 'star name too long');
    m.stringToUTF8(star, this.s, max);
    this.clearErr();
    const ret = m._swe_fixstar2(this.s, jdTT, iflag, this.d, this.serr);
    this.checkEphemeris('swe_fixstar2', iflag, ret);
    return { flags: ret, value: { name: m.UTF8ToString(this.s), xx: this.six(0) } };
  }

  fixstarMag(star: string): number {
    const { m } = this;
    m.stringToUTF8(star, this.s, 2 * SE_MAX_STNAME + 1);
    this.clearErr();
    const ret = m._swe_fixstar2_mag(this.s, this.d, this.serr);
    const e = this.err();
    if (ret === ERR || e) this.fail('swe_fixstar2_mag', e || 'failed');
    return this.f64(0);
  }

  // ---------- internals ----------

  private checkEphemeris(fn: string, requested: number, returned: number): void {
    const e = this.err();
    if (returned < 0) this.fail(fn, e || 'failed');
    const want = requested & SEFLG_EPHMASK;
    const got = returned & SEFLG_EPHMASK;
    if (want && got !== want) {
      this.fail(fn, `requested ephemeris flag ${want} but the library used ${got}${e ? `: ${e}` : ''}`);
    }
    if (e) this.fail(fn, e);
  }

  private clearErr(): void {
    this.m.HEAPU8[this.serr] = 0;
  }

  private err(): string {
    return this.m.UTF8ToString(this.serr).trim();
  }

  private f64(index: number): number {
    return this.m.HEAPF64[(this.d >> 3) + index]!;
  }

  private six(index: number): Six {
    const h = this.m.HEAPF64;
    const b = (this.d >> 3) + index;
    return [h[b]!, h[b + 1]!, h[b + 2]!, h[b + 3]!, h[b + 4]!, h[b + 5]!];
  }

  private doubles(ptr: number, n: number): number[] {
    return Array.from(this.m.HEAPF64.subarray(ptr >> 3, (ptr >> 3) + n));
  }

  private withString<T>(str: string, fn: (ptr: number) => T): T {
    const n = this.m.lengthBytesUTF8(str) + 1;
    const p = this.m._malloc(n);
    try {
      this.m.stringToUTF8(str, p, n);
      return fn(p);
    } finally {
      this.m._free(p);
    }
  }
}
