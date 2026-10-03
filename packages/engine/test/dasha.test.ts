/**
 * Daśās (BPHS 46.12–16, 46.155–167, 46.195–200, 51.1–2).
 *
 * The texts give rules, not worked charts, so the outside checks are those rules worked by
 * hand: the lord of each nakṣatra from "Kṛttikā, thrice round"; the balance of 46.16 for a
 * chosen Moon; the antardaśā formula of 51.1 for one period; the yoginī count of 46.199;
 * the cara daśā counts of 46.155–165 on constructed charts. Then structure: periods tile
 * time exactly, at every level, for the 1000 charts of consistency.test.ts too.
 */
import { describe, expect, it } from 'vitest';
import type { Graha } from '../src/grahas.ts';
import { charaDasha, dashaAt, isOddPada, nakshatraDasha, subPeriods, VIMSHOTTARI, vimshottari, YOGINI, yogini, type Period } from '../src/jyotish/dasha.ts';

const Y = 365.25;
const BIRTH = 2451545; // J2000 TT
const nak = (n: number, f: number) => ((n + f) * 360) / 27;

describe('Viṃśottarī (BPHS 46.12–16)', () => {
  it('lord of the birth nakṣatra: from Kṛttikā, Sun Moon Mars Rahu Jupiter Saturn Mercury Ketu Venus, thrice', () => {
    const order = ['sun', 'moon', 'mars', 'rahu', 'jupiter', 'saturn', 'mercury', 'ketu', 'venus'];
    for (let n = 0; n < 27; n++) {
      const want = order[(((n - 2) % 9) + 9) % 9];
      expect(vimshottari(nak(n, 0.5), BIRTH, Y).periods[0]!.lord, `nakṣatra ${n}`).toBe(want);
    }
    expect(vimshottari(nak(0, 0), BIRTH, Y).periods[0]!.lord).toBe('ketu'); // Aśvinī
    expect(vimshottari(nak(1, 0), BIRTH, Y).periods[0]!.lord).toBe('venus'); // Bharaṇī
    expect(vimshottari(nak(26, 0.99), BIRTH, Y).periods[0]!.lord).toBe('mercury'); // Revatī
  });

  it('years 6, 10, 7, 18, 16, 19, 17, 7, 20 = 120', () => {
    expect(VIMSHOTTARI.years.reduce((a, b) => a + b)).toBe(120);
  });

  it('balance (46.16), worked by hand: Moon a quarter into Rohiṇī', () => {
    // Rohiṇī (n = 3) is the Moon's nakṣatra; a quarter gone: 10 × 1/4 = 2.5 years elapsed, 7.5 to run.
    const r = vimshottari(nak(3, 0.25), BIRTH, Y);
    expect(r.periods[0]!.lord).toBe('moon');
    expect(r.elapsedYears).toBeCloseTo(2.5, 12);
    expect((r.periods[0]!.end - BIRTH) / Y).toBeCloseTo(7.5, 9);
    expect(r.periods[1]!.lord).toBe('mars');
    expect(r.periods[1]!.end - r.periods[1]!.start).toBeCloseTo(7 * Y, 9);
  });

  it('antardaśās (51.1–2), worked by hand: Saturn mahādaśā, from Saturn, 19 × years / 120', () => {
    const maha: Period = { index: 5, name: 'saturn', lord: 'saturn', level: 1, start: 0, end: 19 * Y };
    const antar = subPeriods(VIMSHOTTARI, maha);
    expect(antar.map((p) => p.lord)).toEqual(['saturn', 'mercury', 'ketu', 'venus', 'sun', 'moon', 'mars', 'rahu', 'jupiter']);
    // Saturn–Saturn: 19 × 19 / 120 years = 3 y 0 m 3 d (to the day).
    expect((antar[0]!.end - antar[0]!.start) / Y).toBeCloseTo((19 * 19) / 120, 12);
    expect((antar[3]!.end - antar[3]!.start) / Y).toBeCloseTo((19 * 20) / 120, 12);
    expect(antar[8]!.end).toBe(maha.end);
  });

  it('five levels tile every parent exactly and run from its own lord', () => {
    const r = vimshottari(123.456789, BIRTH, Y);
    let level: Period[] = [r.periods[0]!];
    for (let depth = 2; depth <= 5; depth++) {
      const next: Period[] = [];
      for (const p of level.slice(0, 3)) {
        const kids = subPeriods(VIMSHOTTARI, p);
        expect(kids[0]!.start).toBe(p.start);
        expect(kids[8]!.end).toBe(p.end);
        expect(kids[0]!.lord).toBe(p.lord);
        expect(kids.every((k) => k.level === depth)).toBe(true);
        for (let i = 1; i < 9; i++) expect(kids[i]!.start).toBe(kids[i - 1]!.end);
        next.push(...kids);
      }
      level = next;
    }
  });

  it('dashaAt gives the nested chain at an instant, five deep', () => {
    const r = vimshottari(200.5, BIRTH, Y);
    const t = BIRTH + 4000.123;
    const chain = dashaAt(VIMSHOTTARI, r, t, 5);
    expect(chain.map((p) => p.level)).toEqual([1, 2, 3, 4, 5]);
    for (const p of chain) expect(t >= p.start && t < p.end).toBe(true);
  });

  it('covers 120 years after birth; mahādaśās contiguous', () => {
    const r = vimshottari(0.0001, BIRTH, Y);
    expect(r.periods[r.periods.length - 1]!.end).toBeGreaterThanOrEqual(BIRTH + 120 * Y);
    for (let i = 1; i < r.periods.length; i++) expect(r.periods[i]!.start).toBe(r.periods[i - 1]!.end);
  });

  it('year length is a setting: 360-day years shorten every period in proportion', () => {
    const a = vimshottari(77.7, BIRTH, 365.25);
    const b = vimshottari(77.7, BIRTH, 360);
    expect((b.periods[2]!.end - b.periods[2]!.start) / (a.periods[2]!.end - a.periods[2]!.start)).toBeCloseTo(360 / 365.25, 12);
  });

  it('rejects bad input', () => {
    expect(() => vimshottari(360, BIRTH, Y)).toThrow(RangeError);
    expect(() => vimshottari(10, BIRTH, 0)).toThrow(RangeError);
  });
});

describe('Yoginī (BPHS 46.195–200)', () => {
  it('birth nakṣatra + 3, remainder of 8, from Maṅgalā (46.199), worked by hand', () => {
    // Aśvinī = 1: 1 + 3 = 4 → Bhrāmarī. Rohiṇī = 4: 7 → Siddhā. Puṣya = 8: 11 → 3 → Dhanyā. Śravaṇa = 22: 25 → 1 → Maṅgalā. Revatī = 27: 30 → 6 → Ulkā.
    expect(yogini(nak(0, 0.1), BIRTH, Y).periods[0]!.name).toBe('Bhrāmarī');
    expect(yogini(nak(3, 0.1), BIRTH, Y).periods[0]!.name).toBe('Siddhā');
    expect(yogini(nak(7, 0.1), BIRTH, Y).periods[0]!.name).toBe('Dhanyā');
    expect(yogini(nak(21, 0.1), BIRTH, Y).periods[0]!.name).toBe('Maṅgalā');
    expect(yogini(nak(26, 0.1), BIRTH, Y).periods[0]!.name).toBe('Ulkā');
    // Remainder 0 is the eighth, Saṅkaṭā: Mṛgaśīrṣa = 5: 5 + 3 = 8 → 0.
    expect(yogini(nak(4, 0.1), BIRTH, Y).periods[0]!.name).toBe('Saṅkaṭā');
  });

  it('lords and years (46.196–198, 46.200): 1 … 8 = 36', () => {
    expect(YOGINI.lords).toEqual(['moon', 'sun', 'jupiter', 'mars', 'mercury', 'saturn', 'venus', 'rahu']);
    expect(YOGINI.years.reduce((a, b) => a + b)).toBe(36);
  });

  it('balance and sub-periods as for Viṃśottarī', () => {
    const r = yogini(nak(0, 0.4), BIRTH, Y); // Bhrāmarī, 4 years, 0.4 gone
    expect(r.elapsedYears).toBeCloseTo(1.6, 12);
    const kids = subPeriods(YOGINI, r.periods[0]!);
    expect(kids.map((k) => k.name)[0]).toBe('Bhrāmarī');
    expect((kids[0]!.end - kids[0]!.start) / Y).toBeCloseTo((4 * 4) / 36, 12);
    expect(kids[7]!.end).toBe(r.periods[0]!.end);
    expect(nakshatraDasha(YOGINI, 10, BIRTH, Y, 120).periods.length).toBeGreaterThan(3);
  });
});

describe('Cara daśā (BPHS 46.155–167)', () => {
  /** A chart from signs (and degrees 15° within them unless given). */
  const at = (signs: Partial<Record<Graha, number>>, deg: Partial<Record<Graha, number>> = {}) => {
    const all: Record<Graha, number> = { sun: 0, moon: 0, mars: 0, mercury: 0, jupiter: 0, venus: 0, saturn: 0, rahu: 0, ketu: 0 };
    for (const g of Object.keys(all) as Graha[]) all[g] = (signs[g] ?? 11) * 30 + (deg[g] ?? 15);
    return all;
  };

  it('odd padas are Meṣa–Mithuna and Tulā–Dhanus (46.156)', () => {
    expect(Array.from({ length: 12 }, (_, s) => isOddPada(s))).toEqual([true, true, true, false, false, false, true, true, true, false, false, false]);
  });

  it('direction from the 9th house’s pada, starting at the lagna (46.167)', () => {
    // Lagna Meṣa: 9th Dhanus, odd pada → forward. Lagna Karka: 9th Mīna, even → backward.
    expect(charaDasha(0, at({}), BIRTH, Y).periods.map((p) => p.sign)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(charaDasha(3, at({}), BIRTH, Y).periods.map((p) => p.sign)).toEqual([3, 2, 1, 0, 11, 10, 9, 8, 7, 6, 5, 4]);
  });

  it('years: signs from the sign to its lord, forward in odd padas, backward in even; own sign 12 (46.155–159)', () => {
    // Meṣa (odd pada), Mars in Siṃha: Meṣa → Siṃha forward is 4 signs → 4 years.
    // Karka (even pada), Moon in Siṃha: Karka → Siṃha backward is 11 → 11 years.
    // Vṛṣabha, Venus in Vṛṣabha: own sign → 12.
    const lon = at({ mars: 4, moon: 4, venus: 1, saturn: 11, rahu: 11, ketu: 5, mercury: 11, jupiter: 2, sun: 11 });
    const d = charaDasha(0, lon, BIRTH, Y).periods;
    expect(d[0]).toMatchObject({ sign: 0, count: 4, years: 4 });
    expect(d[3]).toMatchObject({ sign: 3, count: 11, years: 11 });
    expect(d[1]).toMatchObject({ sign: 1, count: 0, years: 12 });
  });

  it('a year more for an exalted lord, a year less for a debilitated one (46.165)', () => {
    // Meṣa: Mars exalted in Makara (28° deep, any degree of the sign): Meṣa → Makara forward 9 → 10.
    // Siṃha (even pada): Sun debilitated in Tulā: Siṃha → Tulā backward 10 → 9.
    const lon = at({ mars: 9, sun: 6 });
    const d = charaDasha(0, lon, BIRTH, Y).periods;
    expect(d[0]).toMatchObject({ count: 9, adjustment: 1, years: 10 });
    expect(d[4]).toMatchObject({ count: 10, adjustment: -1, years: 9 });
  });

  describe('two lords (46.157–164)', () => {
    it('both in the sign: twelve years', () => {
      const d = charaDasha(0, at({ mars: 7, ketu: 7, rahu: 1 }), BIRTH, Y).periods[7]!;
      expect(d.lord.by).toBe('both-in-sign');
      expect(d.years).toBe(12);
    });
    it('one in the sign: count to the other', () => {
      const d = charaDasha(0, at({ mars: 7, ketu: 2, rahu: 8 }), BIRTH, Y).periods[7]!;
      expect(d.lord).toEqual({ lord: 'ketu', by: 'other-in-sign' });
    });
    it('an exalted lord is taken', () => {
      // Ketu exalted in Vṛścika? It would be in the sign itself; use Kumbha: Saturn exalted in Tulā, Rahu in Mīna.
      const d = charaDasha(0, at({ saturn: 6, rahu: 11, ketu: 5 }), BIRTH, Y).periods[10]!;
      expect(d.lord).toEqual({ lord: 'saturn', by: 'exalted' });
    });
    it('then the one with more grahas', () => {
      const d = charaDasha(0, at({ saturn: 2, rahu: 4, ketu: 10, sun: 4, moon: 4, mars: 0, mercury: 0, jupiter: 0, venus: 0 }), BIRTH, Y).periods[10]!;
      expect(d.lord).toEqual({ lord: 'rahu', by: 'more-grahas' });
    });
    it('then the sign: dual over fixed over movable', () => {
      const d = charaDasha(0, at({ saturn: 3, rahu: 5, ketu: 11, sun: 0, moon: 0, mars: 0, mercury: 0, jupiter: 0, venus: 0 }), BIRTH, Y).periods[10]!;
      expect(d.lord).toEqual({ lord: 'rahu', by: 'sign-nature' });
    });
    it('then the one giving more years', () => {
      // Kumbha (even pada, count backward): Saturn in Mithuna (dual) → 8; Rahu in Dhanus (dual) → 2.
      const d = charaDasha(0, at({ saturn: 2, rahu: 8, ketu: 2, sun: 0, moon: 0, mars: 0, mercury: 0, jupiter: 0, venus: 0 }), BIRTH, Y).periods[10]!;
      expect(d.lord.by).toBe('more-grahas'); // Ketu sits with Saturn: one graha more
      const e = charaDasha(0, at({ saturn: 2, rahu: 8, ketu: 5, sun: 0, moon: 0, mars: 0, mercury: 0, jupiter: 0, venus: 0 }), BIRTH, Y).periods[10]!;
      expect(e.lord).toEqual({ lord: 'saturn', by: 'more-years' });
      expect(e.years).toBe(8);
    });
  });

  it('periods follow one another from birth (no balance in BPHS)', () => {
    const d = charaDasha(5, at({ sun: 3, moon: 8, mars: 1 }), BIRTH, Y).periods;
    expect(d[0]!.start).toBe(BIRTH);
    for (let i = 1; i < 12; i++) expect(d[i]!.start).toBe(d[i - 1]!.end);
    expect(new Set(d.map((p) => p.sign)).size).toBe(12);
  });
});
