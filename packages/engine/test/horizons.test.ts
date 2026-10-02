/**
 * Positions against NASA JPL Horizons: 60 random instants 1900–2100, Sun, Moon and
 * Mercury to Saturn. Target: apparent geocentric ecliptic longitude within 1″.
 * How the frames are matched: src/verify/horizons.ts and docs/TESTING.md.
 *
 * The report (worst residual per body) is written to test/reports/horizons.json and
 * printed, so the numbers behind "pass" are always visible.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { compareWithHorizons, HORIZONS_BODIES, LONGITUDE_TOLERANCE_ARCSEC, type Engine, type HorizonsFixture } from '../src/index.ts';
import { icrfResiduals } from '../src/verify/horizons.ts';
import { fixture, loadEngine } from './helpers.ts';

const horizons = fixture<HorizonsFixture>('horizons-positions.json');
let engine: Engine;

beforeAll(async () => {
  engine = await loadEngine();
});

const fmt = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(4)}″`;

describe('positions against JPL Horizons', () => {
  it('uses the fixture as documented: 60 instants, 1900–2100, 7 bodies', () => {
    for (const body of HORIZONS_BODIES) {
      const rows = horizons.bodies[body]!.rows;
      expect(rows).toHaveLength(60);
      for (const r of rows) {
        expect(Number(r.jdTT)).toBeGreaterThanOrEqual(2415020.5);
        expect(Number(r.jdTT)).toBeLessThan(2488434.5);
      }
    }
  });

  it(`matches apparent ecliptic longitude within ${LONGITUDE_TOLERANCE_ARCSEC}″ for every body`, () => {
    const report = compareWithHorizons(engine, horizons);
    // Diagnostic: astrometric ICRF residuals carry no precession-nutation model, so they show
    // how much of the ecliptic residual is the ephemeris itself (plus barycentre offsets).
    const icrfWorst = HORIZONS_BODIES.map((b) => Math.max(...icrfResiduals(engine, horizons, b)));

    const table = report.bodies.map((b, i) => ({
      body: b.body,
      n: b.count,
      worstLongitude: fmt(b.worst.longitude),
      atJdTT: b.worst.jdTT,
      rmsLongitude: b.rmsLongitude.toFixed(4) + '″',
      maxLatitude: b.maxAbsLatitude.toFixed(4) + '″',
      worstIcrfSeparation: icrfWorst[i]!.toFixed(4) + '″',
      horizonsSource: b.horizonsSource,
      pass: b.pass,
    }));
    console.table(table);
    mkdirSync(new URL('./reports/', import.meta.url), { recursive: true });
    writeFileSync(
      new URL('./reports/horizons.json', import.meta.url),
      `${JSON.stringify({ generated: 'npm test -w @aletheia/engine', fixtureRetrieved: report.retrieved, toleranceArcsec: report.toleranceArcsec, rows: table }, null, 2)}\n`,
    );

    for (const b of report.bodies) {
      expect(Math.abs(b.worst.longitude), `${b.body} worst longitude residual (arcsec)`).toBeLessThanOrEqual(LONGITUDE_TOLERANCE_ARCSEC);
    }
    expect(report.pass).toBe(true);
  });
});
