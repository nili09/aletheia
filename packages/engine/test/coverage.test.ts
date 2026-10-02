/**
 * Ephemeris files, their coverage, and loud failure (CLAUDE.md, "Priority zero"):
 * - the shipped files are the ones the build recorded, byte for byte;
 * - FULL_PRECISION_JD_TT equals what the files themselves report;
 * - inside the coverage every result comes from the Swiss Ephemeris files, outside it from
 *   Moshier, explicitly, and is labelled reduced precision;
 * - with a file missing, every kind of computation throws instead of falling back.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { Engine, FULL_PRECISION_JD_TT, precisionForJdTT, SwissEphError } from '../src/index.ts';
import { SE_MOON, SE_SUN, SEFLG_MOSEPH, SEFLG_SPEED, SEFLG_SWIEPH } from '../src/swe/constants.ts';
import { loadEngine, readEphe } from './helpers.ts';

const build = JSON.parse(readFileSync(new URL('../vendor/BUILD.json', import.meta.url), 'utf8')) as {
  swissEphemeris: { version: string; commit: string };
  dataFiles: Record<string, string>;
  outputs: Record<string, string>;
};

let engine: Engine;
beforeAll(async () => {
  engine = await loadEngine();
});

describe('build and data files', () => {
  it('runs the pinned Swiss Ephemeris version', () => {
    expect(engine.version).toBe(build.swissEphemeris.version);
    expect(build.swissEphemeris.commit).toBe('aacf962d19d79f8bc921dbcdaacf306d85be1917');
  });

  it('ships the WebAssembly and data files the build recorded, byte for byte', () => {
    const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
    for (const [name, hash] of Object.entries(build.dataFiles)) {
      expect(sha(readEphe(name as 'sepl_18.se1')), name).toBe(hash);
    }
    for (const [name, hash] of Object.entries(build.outputs)) {
      expect(sha(readFileSync(new URL(`../vendor/${name}`, import.meta.url))), name).toBe(hash);
    }
  });

  it('reports coverage that contains FULL_PRECISION_JD_TT, from JPL DE441', () => {
    engine.swe.calc(2451545, SE_SUN, SEFLG_SWIEPH);
    engine.swe.calc(2451545, SE_MOON, SEFLG_SWIEPH);
    const [planets, moon] = engine.fileData();
    expect(planets!.path).toMatch(/sepl_18\.se1$/);
    expect(moon!.path).toMatch(/semo_18\.se1$/);
    expect(planets!.jplNumber).toBe(441);
    expect(moon!.jplNumber).toBe(441);
    // Start: one day after the files begin (light-time look-back); end: the files' end.
    expect(Math.max(planets!.start, moon!.start)).toBe(FULL_PRECISION_JD_TT.first - 1);
    expect(Math.min(planets!.end, moon!.end)).toBe(FULL_PRECISION_JD_TT.last);
  });

  it('cannot give every graha in the first hours of the files: the reason for the one-day margin', () => {
    const fileStart = FULL_PRECISION_JD_TT.first - 1;
    // Saturn's light-time is over an hour: its apparent place needs the previous file.
    expect(() => engine.swe.calc(fileStart + 0.5 / 24, 6, SEFLG_SWIEPH | SEFLG_SPEED)).toThrow(/sepl_12\.se1/);
    expect(() => engine.swe.calc(fileStart + 2 / 24, 6, SEFLG_SWIEPH | SEFLG_SPEED)).not.toThrow();
  });
});

describe('precision labelling', () => {
  it('is full exactly inside the coverage and reduced outside', () => {
    expect(precisionForJdTT(FULL_PRECISION_JD_TT.first)).toBe('full');
    expect(precisionForJdTT(FULL_PRECISION_JD_TT.last)).toBe('full');
    expect(precisionForJdTT(2451545)).toBe('full');
    expect(precisionForJdTT(FULL_PRECISION_JD_TT.first - 1e-6)).toBe('reduced');
    expect(precisionForJdTT(FULL_PRECISION_JD_TT.last + 1e-6)).toBe('reduced');
    expect(() => precisionForJdTT(Number.NaN)).toThrow(RangeError);
  });

  it('marks 1800-01-01 and -02 and late 2400 reduced', () => {
    const jan1of1800 = engine.instant({ jdTT: 2378495.5 + 0.5 });
    const jan2of1800 = engine.instant({ jdTT: 2378496.5 + 0.5 });
    expect(jan2of1800.precision).toBe('reduced');
    const may2400 = engine.instant({ jdTT: 2597641.5 + 130 });
    expect(jan1of1800.precision).toBe('reduced');
    expect(may2400.precision).toBe('reduced');
  });

  it('uses the Swiss files inside the coverage, right up to both ends', () => {
    for (const jdTT of [FULL_PRECISION_JD_TT.first + 0.01, 2451545, FULL_PRECISION_JD_TT.last - 0.01]) {
      for (const p of engine.positions({ jdTT })) {
        expect(p.precision).toBe('full');
        expect(p.ephemeris).toBe('swiss');
        expect(p.flags.tropical & SEFLG_SWIEPH, `${p.graha} at ${jdTT}`).toBe(SEFLG_SWIEPH);
        expect(p.flags.sidereal & SEFLG_SWIEPH).toBe(SEFLG_SWIEPH);
      }
    }
  });

  it('uses Moshier, explicitly, and says so, outside the coverage', () => {
    for (const jdTT of [2341972.5 /* 1700 */, 2634167.5 /* 2500 */, 1721423.5 /* 1 CE */]) {
      for (const p of engine.positions({ jdTT })) {
        expect(p.precision).toBe('reduced');
        expect(p.ephemeris).toBe('moshier');
        expect(p.flags.tropical & SEFLG_MOSEPH).toBe(SEFLG_MOSEPH);
      }
    }
  });
});

describe('failing loudly', () => {
  it('throws when the library substitutes Moshier for a requested Swiss file', () => {
    // Year 1700 is not in sepl_18.se1: asking for the Swiss files there must not quietly
    // return Moshier numbers.
    expect(() => engine.swe.calc(2341972.5, SE_SUN, SEFLG_SWIEPH | SEFLG_SPEED)).toThrow(/sepl_12\.se1|used 4/);
  });

  it('refuses every computation when the planet files are not loaded', async () => {
    const bare = await Engine.create();
    const t = { jdTT: 2461000.5 };
    const place = { latitude: 23.1765, longitude: 75.7885 };
    expect(() => bare.positions(t)).toThrow(SwissEphError);
    expect(() => bare.ayanamsa(t)).toThrow(SwissEphError);
    expect(() => bare.houses(t, place)).toThrow(SwissEphError);
    expect(() => bare.riseSet(t, 'sun', place)).toThrow(SwissEphError);
    expect(() => bare.solarEclipse(t)).toThrow(SwissEphError);
    expect(() => bare.lunarEclipse(t)).toThrow(SwissEphError);
    expect(() => bare.nextEvents(t, 1)).toThrow(SwissEphError);
    expect(() => bare.fixedStar(t, 'Spica')).toThrow(SwissEphError);
  });

  it('recovers after an error: a failure at the edge does not poison the next valid call', () => {
    // Without the reset in SwissEph.fail(), the call at the end of the range asks for
    // sepl_24.se1 after failed calls at the start, and throws.
    const fileStart = FULL_PRECISION_JD_TT.first - 1;
    for (let k = 0; k < 5; k++) expect(() => engine.swe.calc(fileStart + 0.001 * k, 0, SEFLG_SWIEPH | SEFLG_SPEED)).toThrow();
    expect(() => engine.swe.calc(FULL_PRECISION_JD_TT.last - 1, 0, SEFLG_SWIEPH | SEFLG_SPEED)).not.toThrow();
  });

  it('throws from the library itself, not only from our pre-check, when a file is missing', async () => {
    const bare = await Engine.create();
    // Bypass the engine and call the binding directly, as a future bug might.
    expect(() => bare.swe.calc(2461000.5, SE_SUN, SEFLG_SWIEPH)).toThrow(/sepl_18\.se1/);
    expect(() => bare.swe.solEclipseWhenGlob(2461000.5, SEFLG_SWIEPH, 0, false)).toThrow(SwissEphError);
    expect(() => bare.swe.lunEclipseWhen(2461000.5, SEFLG_SWIEPH, 0, false)).toThrow(SwissEphError);
    expect(() => bare.swe.riseTrans(2461000.5, SE_SUN, SEFLG_SWIEPH, 1, 75.7885, 23.1765, 0, 0, 10)).toThrow(SwissEphError);
  });

  it('refuses fixed stars without the star catalogue', async () => {
    const noStars = await loadEngine(['sepl_18.se1', 'semo_18.se1']);
    expect(noStars.missingFiles({ stars: true })).toEqual(['sefstars.txt']);
    expect(() => noStars.fixedStar({ jdTT: 2451545 }, 'Spica')).toThrow(/sefstars\.txt/);
  });

  it('rejects bad inputs', () => {
    expect(() => engine.ayanamsa({ jdTT: 2451545 }, 47)).toThrow(RangeError);
    expect(() => engine.houses({ jdTT: 2451545 }, { latitude: 91, longitude: 0 })).toThrow(RangeError);
    expect(() => engine.instant({ unixMs: Number.NaN })).toThrow(RangeError);
    expect(() => engine.fixedStar({ jdTT: 2451545 }, 'NoSuchStarXyz')).toThrow(SwissEphError);
  });
});
