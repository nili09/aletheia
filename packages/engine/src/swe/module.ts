/**
 * The raw Emscripten module: exported C functions of the Swiss Ephemeris (all pointers are
 * byte offsets into the WebAssembly heap) and the runtime helpers we asked Emscripten for.
 * Only src/swe/swisseph.ts touches this.
 */
export interface SwissEphModule {
  FS: {
    mkdir(path: string): void;
    writeFile(path: string, data: Uint8Array): void;
    unlink(path: string): void;
    analyzePath(path: string): { exists: boolean };
  };
  /** Views are replaced when memory grows; always read them from the module, never cache. */
  HEAPF64: Float64Array;
  HEAP32: Int32Array;
  HEAPU8: Uint8Array;
  UTF8ToString(ptr: number, maxBytesToRead?: number): string;
  stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number): void;
  lengthBytesUTF8(str: string): number;
  _malloc(size: number): number;
  _free(ptr: number): void;

  _swe_version(s: number): number;
  _swe_set_ephe_path(path: number): void;
  _swe_close(): void;
  _swe_calc(tjd: number, ipl: number, iflag: number, xx: number, serr: number): number;
  _swe_calc_ut(tjd: number, ipl: number, iflag: number, xx: number, serr: number): number;
  _swe_get_planet_name(ipl: number, s: number): number;
  _swe_set_sid_mode(mode: number, t0: number, ayanT0: number): void;
  _swe_get_ayanamsa_ex(tjdEt: number, iflag: number, daya: number, serr: number): number;
  _swe_get_ayanamsa_ex_ut(tjdUt: number, iflag: number, daya: number, serr: number): number;
  _swe_get_ayanamsa_name(mode: number): number;
  _swe_get_current_file_data(ifno: number, tfstart: number, tfend: number, denum: number): number;
  _swe_julday(y: number, m: number, d: number, hour: number, greg: number): number;
  _swe_revjul(jd: number, greg: number, y: number, m: number, d: number, ut: number): void;
  _swe_utc_to_jd(y: number, m: number, d: number, h: number, mi: number, sec: number, greg: number, dret: number, serr: number): number;
  _swe_jdet_to_utc(jd: number, greg: number, y: number, m: number, d: number, h: number, mi: number, sec: number): void;
  _swe_jdut1_to_utc(jd: number, greg: number, y: number, m: number, d: number, h: number, mi: number, sec: number): void;
  _swe_deltat_ex(tjd: number, iflag: number, serr: number): number;
  _swe_sidtime(tjdUt: number): number;
  _swe_houses_ex2(tjdUt: number, iflag: number, lat: number, lon: number, hsys: number, cusps: number, ascmc: number, cuspSpeed: number, ascmcSpeed: number, serr: number): number;
  _swe_houses_armc_ex2(armc: number, lat: number, eps: number, hsys: number, cusps: number, ascmc: number, cuspSpeed: number, ascmcSpeed: number, serr: number): number;
  _swe_house_name(hsys: number): number;
  _swe_set_topo(lon: number, lat: number, alt: number): void;
  _swe_rise_trans(tjdUt: number, ipl: number, starname: number, epheflag: number, rsmi: number, geopos: number, atpress: number, attemp: number, tret: number, serr: number): number;
  _swe_azalt(tjdUt: number, calcFlag: number, geopos: number, atpress: number, attemp: number, xin: number, xaz: number): void;
  _swe_sol_eclipse_when_glob(tjdStart: number, ifl: number, ifltype: number, tret: number, backward: number, serr: number): number;
  _swe_sol_eclipse_where(tjdUt: number, ifl: number, geopos: number, attr: number, serr: number): number;
  _swe_sol_eclipse_how(tjdUt: number, ifl: number, geopos: number, attr: number, serr: number): number;
  _swe_lun_eclipse_when(tjdStart: number, ifl: number, ifltype: number, tret: number, backward: number, serr: number): number;
  _swe_lun_eclipse_how(tjdUt: number, ifl: number, geopos: number, attr: number, serr: number): number;
  _swe_fixstar2(star: number, tjd: number, iflag: number, xx: number, serr: number): number;
  _swe_fixstar2_ut(star: number, tjdUt: number, iflag: number, xx: number, serr: number): number;
  _swe_fixstar2_mag(star: number, mag: number, serr: number): number;
  _swe_degnorm(x: number): number;
  _swe_difdeg2n(a: number, b: number): number;
}
