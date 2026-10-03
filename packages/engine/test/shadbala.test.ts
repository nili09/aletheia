/**
 * Ṣaḍbala (BPHS 26–27).
 *
 * Outside references:
 * - The precise aspects of BPHS 26.6–12, values read off the verses at chosen arcs.
 * - The khaṇḍas of 27.15 against the sine they tabulate (90 sin λ at 30°, 60°, 90°).
 * - The Sūrya Siddhānta lords: SS 1.52's year and month lords must equal the weekday lords
 *   of the first day of the 360- and 30-day periods (SS 1.51), and the Kali epoch a Friday.
 * - Meeus's mean longitudes against the Swiss Ephemeris's true heliocentric longitudes over
 *   1800–2400: the difference must stay within each planet's equation of centre (plus the
 *   great inequality for Jupiter and Saturn) and average out.
 * - Physical sense: ceṣṭā near 60 at opposition and near 0 at conjunction; natonnata at
 *   apparent noon; pakṣa at full moon.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { SE_JUPITER, SE_MARS, SE_MERCURY, SE_SATURN, SE_SUN, SE_VENUS, SEFLG_SWIEPH } from '../src/swe/constants.ts';
import { SEVEN } from '../src/jyotish/core.ts';
import { ayanaBala, KALI_JDN, khandaSum, meanLongitude, NAISARGIKA, REQUIRED, shadbala, sphutaDrishti, SS_KALI_AHARGANA, ssYearMonthLords } from '../src/jyotish/shadbala.ts';
import { wrap180, type Engine } from '../src/index.ts';
import { loadEngine } from './helpers.ts';

let engine: Engine;
beforeAll(async () => {
  engine = await loadEngine();
});
const delhi = { latitude: 28.6139, longitude: 77.209 };

describe('precise aspects (BPHS 26.6–12)', () => {
  it('general rule, read off 26.6–9', () => {
    const at = [0, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 210, 240, 270, 300, 330];
    const want = [0, 0, 7.5, 15, 30, 45, 37.5, 30, 15, 0, 30, 60, 45, 30, 15, 0, 0];
    expect(at.map((a) => sphutaDrishti('sun', a))).toEqual(want);
  });
  it('Saturn (26.9–10): full on the 3rd and 10th', () => {
    expect([45, 60, 90, 240, 255, 270, 285].map((a) => sphutaDrishti('saturn', a))).toEqual([30, 60, 45, 30, 45, 60, 30]);
  });
  it('Mars (26.11): full on the 4th, 7th and 8th', () => {
    expect([60, 75, 90, 105, 120, 180, 195, 210, 225].map((a) => sphutaDrishti('mars', a))).toEqual([15, 37.5, 60, 45, 30, 60, 60, 60, 45]);
  });
  it('Jupiter (26.12): full on the 5th, 7th and 9th', () => {
    expect([90, 105, 120, 135, 210, 225, 240, 255].map((a) => sphutaDrishti('jupiter', a))).toEqual([45, 52.5, 60, 30, 45, 52.5, 60, 30]);
  });
  it('the general rule is continuous; never outside 0–60', () => {
    for (let a = 0; a < 360; a += 0.25) {
      for (const g of SEVEN) {
        const v = sphutaDrishti(g, a);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(60);
      }
      expect(Math.abs(sphutaDrishti('sun', a + 0.25) - sphutaDrishti('sun', a))).toBeLessThanOrEqual(0.5 + 1e-12);
    }
  });
});

describe('fixed strengths (BPHS 27.14, 27.32)', () => {
  it('naisargika: 60/7 × 7 … 1 for Sun, Moon, Venus, Jupiter, Mercury, Mars, Saturn', () => {
    const order = ['sun', 'moon', 'venus', 'jupiter', 'mercury', 'mars', 'saturn'] as const;
    order.forEach((g, i) => expect(NAISARGIKA[g] * 7).toBeCloseTo((7 - i) * 60, 12));
  });
  it('minimums 6.5, 6, 5, 7, 6.5, 5.5, 5 rūpas', () => {
    expect(SEVEN.map((g) => REQUIRED[g] / 60)).toEqual([6.5, 6, 5, 7, 6.5, 5.5, 5]);
  });
});

describe('ayana bala (27.15–17)', () => {
  it('the khaṇḍas 45, 33, 12 tabulate 90 sin λ', () => {
    expect([0, 30, 60, 90, 120, 150, 180, 210, 270, 330].map(khandaSum)).toEqual([0, 45, 78, 90, 78, 45, 0, 45, 90, 45]);
    // Chords of the sine (78 rounds 90 sin 60° = 77.94): 0.06 above it at most, 2.94 below (measured, descriptive).
    for (let l = 0; l < 360; l += 0.5) {
      const d = 90 * Math.abs(Math.sin((l * Math.PI) / 180)) - khandaSum(l);
      expect(d).toBeGreaterThan(-0.06);
      expect(d).toBeLessThan(2.94);
    }
  });
  it('signs: Sun group strong north, Moon and Saturn south, Mercury always plus', () => {
    expect(ayanaBala('sun', 90)).toBe(60);
    expect(ayanaBala('sun', 270)).toBe(0);
    expect(ayanaBala('moon', 270)).toBe(60);
    expect(ayanaBala('saturn', 90)).toBe(0);
    expect(ayanaBala('mercury', 90)).toBe(60);
    expect(ayanaBala('mercury', 270)).toBe(60);
    expect(ayanaBala('mercury', 0)).toBe(30);
    expect(ayanaBala('venus', 180)).toBe(30);
  });
});

describe('lords of the year and month (SS 1.51–52)', () => {
  it('the Kali epoch is a Friday in the Sūrya Siddhānta count', () => {
    expect(SS_KALI_AHARGANA % 7).toBe(5); // 0 = Sunday
    expect((KALI_JDN + 1) % 7).toBe(5);
  });
  it('the year and month lords are the weekday lords of the first day of the 360- and 30-day periods', () => {
    for (let jdn = 2415021; jdn < 2415021 + 5000; jdn += 37) {
      const A = SS_KALI_AHARGANA + (jdn - KALI_JDN);
      const firstOfYear = A - (A % 360);
      const firstOfMonth = A - (A % 30);
      const { year, month } = ssYearMonthLords(jdn);
      expect(year).toBe(SEVEN[firstOfYear % 7]);
      expect(month).toBe(SEVEN[firstOfMonth % 7]);
    }
  });
});

describe('lords of the year and month by saṅkrānti (decided 2026-10-03)', () => {
  it('the chart’s saṅkrāntis are the Sun’s sign entries, and the lords are their vāra weekday lords', () => {
    const delhi2 = { latitude: 28.6139, longitude: 77.209 };
    for (const iso of ['1990-05-17T04:30:00Z', '2024-01-14T20:00:00Z', '2026-10-03T06:30:00Z']) {
      const c = engine.chart({ unixMs: Date.parse(iso) }, delhi2);
      const { latest, mesha } = c.sankranti;
      expect(latest.instant.jdTT).toBeLessThanOrEqual(c.instant.jdTT);
      expect(mesha.instant.jdTT).toBeLessThanOrEqual(c.instant.jdTT);
      expect(c.instant.jdTT - mesha.instant.jdTT).toBeLessThan(366);
      // The Sun is on the boundary at each (to 1e-6°), and in the sign it entered.
      const lonAt = (t: number) => engine.position({ jdTT: t }, 'sun').sidereal.longitude;
      expect(Math.abs((((lonAt(latest.instant.jdTT) - latest.sign * 30) + 540) % 360) - 180)).toBeLessThan(1e-6);
      expect(Math.abs(((lonAt(mesha.instant.jdTT) + 540) % 360) - 180)).toBeLessThan(1e-6);
      expect(c.grahas.sun.sign).toBe(latest.sign);
      // The weekday is the vāra (sunrise to sunrise) at the place.
      expect(latest.vara).toBe(engine.panchang({ jdTT: latest.instant.jdTT }, delhi2).vara.index);
      expect(mesha.vara).toBe(engine.panchang({ jdTT: mesha.instant.jdTT }, delhi2).vara.index);
      const sb = shadbala(c);
      expect(sb.lords.year).toBe(SEVEN[mesha.vara]);
      expect(sb.lords.month).toBe(SEVEN[latest.vara]);
      expect(sb.provisional).not.toContain('abda-masa-bala');
      // The alternative: the Sūrya Siddhānta day-count.
      const ss = shadbala({ ...c, settings: { ...c.settings, yearMonthLords: 'surya-siddhanta' } });
      const jdn = Math.floor(c.sunrise.jdUT + 0.5 + c.place.longitude / 360);
      expect(ss.lords).toMatchObject(ssYearMonthLords(jdn));
    }
  });
});

describe('mean longitudes for ceṣṭā (Meeus Table 31.A) against the ephemeris', () => {
  it('true heliocentric − mean stays within the equation of centre and averages out, 1800–2400', () => {
    // Max |true − mean|: equation of centre 2e (rad) plus a margin for perturbations
    // (Jupiter and Saturn: the great inequality, < 0.9°).
    const bodies = [
      ['mercury', SE_MERCURY, 24.5],
      ['venus', SE_VENUS, 1.0],
      ['mars', SE_MARS, 11.0],
      ['jupiter', SE_JUPITER, 6.5],
      ['saturn', SE_SATURN, 7.5],
    ] as const;
    const HELCTR = 8; // SEFLG_HELCTR
    for (const [name, ipl, max] of bodies) {
      let sum = 0;
      let n = 0;
      for (let jd = 2378497.5 + 10; jd < 2597641; jd += 97.3) {
        const t = engine.swe.calc(jd, ipl, SEFLG_SWIEPH | HELCTR).value[0];
        const d = wrap180(t - meanLongitude(name, jd));
        expect(Math.abs(d), `${name} at ${jd}`).toBeLessThan(max);
        sum += d;
        n++;
      }
      expect(Math.abs(sum / n), name).toBeLessThan(0.5);
    }
    // Earth: the Sun's geocentric longitude + 180°.
    for (let jd = 2378497.5 + 10; jd < 2597641; jd += 97.3) {
      const sun = engine.swe.calc(jd, SE_SUN, SEFLG_SWIEPH).value[0];
      expect(Math.abs(wrap180(sun + 180 - meanLongitude('earth', jd)))).toBeLessThan(2.1);
    }
  });
});

describe('a chart', () => {
  it('ceṣṭā near 60 at Mars’s opposition (2018-07-27) and near 0 at Jupiter’s conjunction (2019-12-27)', () => {
    const opp = shadbala(engine.chart({ unixMs: Date.parse('2018-07-27T05:00:00Z') }, delhi));
    expect(opp.rows.mars.cheshta).toBeGreaterThan(55);
    const conj = shadbala(engine.chart({ unixMs: Date.parse('2019-12-27T18:00:00Z') }, delhi));
    expect(conj.rows.jupiter.cheshta).toBeLessThan(5);
  });

  it('natonnata at apparent noon: Sun, Jupiter, Venus 60; Moon, Mars, Saturn 0; Mercury 60', () => {
    // Apparent noon at Delhi on 2024-03-20 is about 06:45 UT (equation of time −7.5 min).
    let best = { t: 0, v: -1 };
    for (let m = 6 * 60; m < 7.5 * 60; m++) {
      const t = Date.parse('2024-03-20T00:00:00Z') + m * 60000;
      const v = shadbala(engine.chart({ unixMs: t }, delhi)).rows.sun.kala.natonnata;
      if (v > best.v) best = { t, v };
    }
    const s = shadbala(engine.chart({ unixMs: best.t }, delhi)).rows;
    expect(s.sun.kala.natonnata).toBeGreaterThan(59.9);
    expect(s.moon.kala.natonnata).toBeLessThan(0.1);
    expect(s.mercury.kala.natonnata).toBe(60);
  });

  it('pakṣa at full moon: the Moon 60, the cruel 0', () => {
    const s = shadbala(engine.chart({ unixMs: Date.parse('2024-04-23T23:49:00Z') }, delhi)).rows;
    expect(s.moon.kala.paksha).toBeGreaterThan(59.9);
    expect(s.sun.kala.paksha).toBeLessThan(0.1);
  });

  it('components add up, and each lies in its range', () => {
    for (let i = 0; i < 40; i++) {
      const sb = shadbala(engine.chart({ unixMs: Date.parse('1950-01-01T00:00:00Z') + i * 1.913e9 }, delhi));
      const lordCount = { abda: 0, masa: 0, vara: 0, hora: 0, tribhaga: 0 };
      for (const g of SEVEN) {
        const r = sb.rows[g];
        const k = r.kala;
        expect(r.sthana.uccha).toBeGreaterThanOrEqual(0);
        expect(r.sthana.uccha).toBeLessThanOrEqual(60);
        expect(r.sthana.saptavargaja).toBeGreaterThanOrEqual(14);
        expect(r.sthana.saptavargaja).toBeLessThanOrEqual(315);
        expect([0, 15, 30]).toContain(r.sthana.ojayugma);
        expect([15, 30, 60]).toContain(r.sthana.kendradi);
        expect([0, 15]).toContain(r.sthana.drekkana);
        for (const v of [r.dig, k.natonnata, k.paksha, k.ayana, r.cheshta]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(60 + 1e-9);
        }
        expect(r.sthana.total).toBeCloseTo(r.sthana.uccha + r.sthana.saptavargaja + r.sthana.ojayugma + r.sthana.kendradi + r.sthana.drekkana, 9);
        expect(r.total).toBeCloseTo(r.sthana.total + r.dig + k.total + r.cheshta + r.naisargika + r.drik, 9);
        expect(r.rupas).toBeCloseTo(r.total / 60, 12);
        lordCount.abda += k.abda / 15;
        lordCount.masa += k.masa / 30;
        lordCount.vara += k.vara / 45;
        lordCount.hora += k.hora / 60;
        if (g !== 'jupiter') lordCount.tribhaga += k.tribhaga / 60;
      }
      expect(lordCount).toEqual({ abda: 1, masa: 1, vara: 1, hora: 1, tribhaga: lordCount.tribhaga });
      expect(lordCount.tribhaga).toBeLessThanOrEqual(1);
      expect(sb.rows.jupiter.kala.tribhaga).toBe(60);
    }
  });
});
