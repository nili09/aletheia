/**
 * Aṣṭakavarga (BPHS 66–68; BJ 9).
 *
 * Outside references are the two texts, transcribed here independently of the tables in
 * src/jyotish/ashtakavarga.ts, in the form each text gives them:
 * - BPHS 66.44–60 lists, house by house from the donor, which donors give a sthāna (bindu).
 * - BPHS 66.16 etc. give the number of karaṇas (non-bindus) in each house for each graha.
 * - BJ 9.1–7 lists, donor by donor, the houses — often as "those of the previous donor,
 *   plus …"; the transcription keeps that structure.
 * Then: totals 48 49 39 54 56 52 39 = 337; the reductions of BPHS 67–68, case by case.
 */
import { describe, expect, it } from 'vitest';
import { SEVEN, type Planet } from '../src/jyotish/core.ts';
import { AV_BJ, AV_BPHS, ashtakavarga, DONORS, ekadhipatyaPair, ekadhipatyaShodhana, MOON_VENUS_DIFFERENCES, trikonaShodhana, type Donor } from '../src/jyotish/ashtakavarga.ts';

const L: Donor = 'lagna';
const [Su, Mo, Ma, Me, Ju, Ve, Sa] = SEVEN;
const ALL: Donor[] = [...DONORS];
const but = (...x: Donor[]) => ALL.filter((d) => !x.includes(d));

/** BPHS 66.44–60: for houses 1..12 from the donor, the donors that give a sthāna. */
const BPHS_STHANA: Record<Planet, Donor[][]> = {
  // 66.44–46: 2, 8, 1: Sa Ma Su; 5: Ju Me; 3: Me Mo L; 4: L Su Sa Ma; 10: those + Me Mo; 11: all but Ve; 12: L Ve Me; 6: those + Ju Mo; 7: Su Ma Sa Ve; 9: Su Ma Sa Me Ju.
  sun: [[Sa, Ma, Su], [Sa, Ma, Su], [Me, Mo, L], [L, Su, Sa, Ma], [Ju, Me], [L, Ve, Me, Ju, Mo], [Su, Ma, Sa, Ve], [Sa, Ma, Su], [Su, Ma, Sa, Me, Ju], [L, Su, Sa, Ma, Me, Mo], but(Ve), [L, Ve, Me]],
  // 66.46–48, houses in order.
  moon: [[Me, Mo, Ju], [Ma, Ju], [Me, Su, Mo, Ma, Sa, L, Ve], [Ju, Ve, Me], [Ma, Me, Ve, Sa], [Su, Mo, Ma, Sa, L], [Su, Mo, Ju, Me, Ve], [Su, Me, Ju], [Ve, Mo], [Su, Me, Ju, Ve, Mo, L, Ma], ALL, []],
  // 66.49–50.
  mars: [[L, Sa, Ma], [Ma], [L, Me, Mo, Su], [Sa, Ma], [Me, Su], [Me, Mo, Ju, Su, L, Ve], [Sa, Ma], [Sa, Ma, Ve], [Sa], [Ma, Su, Ju, Sa, L], ALL, [Ju, Ve]],
  // 66.51–53 ("Śakra" read as Śukra).
  mercury: [[L, Sa, Ma, Ve, Me], [L, Ma, Mo, Ve, Sa], [Ve, Me], [L, Mo, Sa, Ve, Ma], [Me, Su, Ve], [Ju, Me, Su, Mo, L], [Ma, Sa], [Ma, Sa, L, Mo, Ve, Ju], [Sa, Ma, Su, Me, Ve], [L, Sa, Ma, Me, Mo], ALL, [Ju, Me, Su]],
  // 66.53–56, named houses ("akra" read as arka).
  jupiter: [[Ju, L, Ma, Su, Me], [Ju, L, Ma, Su, Me, Mo, Ve], [Sa, Ju, Su], [Ju, L, Ma, Su, Me], [Ve, Mo, L, Me, Sa], [Ve, L, Me, Sa], [L, Ma, Ju, Su, Mo], [Ju, Su, Ma], [Ve, Su, L, Mo, Me], [Ju, Me, Ma, Su, Ve, L], but(Sa), [Sa]],
  // 66.56–58.
  venus: [[L, Ve, Mo], [L, Ve, Mo], [L, Ve, Mo, Me, Sa, Ma], [L, Ve, Mo, Sa, Ma], [L, Me, Mo, Ju, Sa, Ve], [Me, Ma], [], [Ve, Su, Mo, Ju, L, Sa], but(Su), [Ve, Ju, Sa], ALL, [Ma, Mo, Su]],
  // 66.59–60.
  saturn: [[Su, L], [Su], [L, Mo, Ma, Sa], [L, Su], [Ju, Sa, Ma], but(Su), [Su], [Su, Me], [Me], [Su, Ma, L, Me], ALL, [Ma, Me, Ju, Ve]],
};

/** BPHS karaṇa counts per house (1..12), e.g. 66.16 for the Sun; Venus per its donor list (see below). */
const BPHS_KARANA_COUNTS: Record<Planet, number[]> = {
  sun: [5, 5, 5, 4, 6, 3, 4, 5, 3, 2, 1, 5], // 66.16
  moon: [5, 6, 1, 5, 4, 3, 3, 5, 6, 1, 0, 8], // 66.20–21
  mars: [5, 7, 4, 6, 6, 2, 6, 5, 7, 3, 0, 6], // 66.23–24
  mercury: [3, 3, 6, 3, 5, 3, 6, 2, 3, 3, 0, 5], // 66.28
  jupiter: [3, 1, 5, 3, 3, 4, 3, 5, 3, 2, 1, 7], // 66.31–32
  venus: [5, 5, 2, 2, 2, 6, 8, 2, 1, 5, 0, 5], // 66.35–36, as written (its 4th conflicts with 66.37 — see the test)
  saturn: [6, 7, 4, 6, 5, 1, 7, 6, 7, 4, 0, 4], // 66.39–40
};

/** BJ 9.1–7 in the text's own form: each donor's houses, "those" referring to the donor before. */
function bj(): Record<Planet, Record<Donor, number[]>> {
  const upacaya = [3, 6, 10, 11];
  const kendra = [1, 4, 7, 10];
  const sun = { sun: [1, 11, 4, 8, 2, 10, 9, 7] } as Record<Donor, number[]>;
  sun.mars = sun.sun;
  sun.saturn = sun.sun;
  sun.venus = [7, 12, 6];
  sun.jupiter = [9, 5, 11, 6];
  sun.moon = [10, 3, 11, 6];
  sun.mercury = [...sun.moon, 12, 9, 5];
  sun.lagna = [...sun.moon, 4, 12];
  const moon = { lagna: [6, 3, 10, 11] } as Record<Donor, number[]>;
  moon.mars = [...moon.lagna, 2, 5, 9];
  moon.moon = [...moon.lagna, 7, 1];
  moon.sun = [...moon.lagna, 8, 7];
  moon.saturn = [6, 3, 11, 5];
  moon.mercury = [5, 3, 11, 8, ...kendra];
  moon.jupiter = [12, 11, 8, ...kendra];
  moon.venus = [9, 4, 5, 3, 11, 10, 7];
  const mars = { sun: [...upacaya, 5] } as Record<Donor, number[]>;
  mars.lagna = [...upacaya, 1];
  mars.moon = upacaya.filter((h) => h !== 10);
  mars.mars = [...kendra, 8, 11, 2];
  mars.saturn = [9, 11, 8, ...kendra];
  mars.mercury = [6, 3, 5, 11];
  mars.venus = [6, 12, 11, 8];
  mars.jupiter = [10, 12, 11, 6];
  const mercury = { venus: [2, 1, 11, 8, 9, 4, 3, 5] } as Record<Donor, number[]>;
  mercury.saturn = [2, 1, 11, 8, 9, 4, 10, 7];
  mercury.mars = mercury.saturn;
  mercury.jupiter = [12, 6, 11, 8];
  mercury.sun = [9, 11, 6, 5, 12];
  mercury.mercury = [...mercury.sun, 1, 10, 3];
  mercury.moon = [6, 2, 11, 8, 4, 10];
  mercury.lagna = [...mercury.moon, 1];
  const jupiter = { mars: [10, 2, 1, 8, 7, 11, 4] } as Record<Donor, number[]>;
  jupiter.jupiter = [...jupiter.mars, 3];
  jupiter.sun = [...jupiter.mars, 3, 9];
  jupiter.venus = [5, 2, 9, 10, 11, 6];
  jupiter.moon = [7, 11, 2, 9, 5];
  jupiter.saturn = [3, 6, 5, 12];
  jupiter.mercury = [10, 5, 6, 2, 4, 11, 1, 9];
  jupiter.lagna = [...jupiter.mercury, 7];
  const venus = { lagna: [1, 2, 3, 4, 5, 11, 8, 9] } as Record<Donor, number[]>;
  venus.moon = [...venus.lagna, 12];
  venus.venus = [...venus.lagna, 10];
  venus.saturn = [4, 3, 5, 9, 10, 8, 11];
  venus.sun = [8, 11, 12];
  venus.jupiter = [9, 10, 11, 8, 5];
  venus.mercury = [5, 3, 11, 9, 6];
  venus.mars = [3, 9, 6, 5, 11, 12];
  const saturn = { saturn: [3, 5, 11, 6] } as Record<Donor, number[]>;
  saturn.mars = [...saturn.saturn, 10, 12];
  saturn.sun = [...kendra, 11, 8, 2];
  saturn.lagna = [...upacaya, 1, 4];
  saturn.mercury = [9, 11, 6, 10, 12, 8];
  saturn.moon = [3, 6, 11];
  saturn.venus = [6, 11, 12];
  saturn.jupiter = [11, 12, 5, 6];
  return { sun, moon, mars, mercury, jupiter, venus, saturn };
}

const sorted = (a: readonly number[]) => [...a].sort((x, y) => x - y);

describe('the tables against the texts', () => {
  it('BJ table = Bṛhajjātaka 9.1–7 as worded', () => {
    const t = bj();
    for (const g of SEVEN) for (const d of DONORS) expect(sorted(AV_BJ[g][d]), `${g} from ${d}`).toEqual(sorted(t[g][d]));
  });

  it('BPHS table = BPHS 66.44–60, house by house', () => {
    for (const g of SEVEN) {
      for (let h = 1; h <= 12; h++) {
        const givers = DONORS.filter((d) => AV_BPHS[g][d].includes(h));
        expect(sorted(givers.map((d) => DONORS.indexOf(d))), `${g}, house ${h}`).toEqual(sorted(BPHS_STHANA[g][h - 1]!.map((d) => DONORS.indexOf(d))));
      }
    }
  });

  it('BPHS karaṇa counts (66.16 …) are 8 minus the bindus in each house — Venus’s 4th excepted', () => {
    for (const g of SEVEN) {
      for (let h = 1; h <= 12; h++) {
        const bindus = DONORS.filter((d) => AV_BPHS[g][d].includes(h)).length;
        if (g === 'venus' && h === 4) {
          // 66.35–36 ("mitre 'kṣi") gives 2 karaṇas, but 66.37 names three givers of karaṇa in the 4th
          // (Sun, Mercury, Jupiter) and 66.56 five of sthāna: an inconsistency in the e-text. 5 bindus.
          expect(bindus).toBe(5);
          continue;
        }
        expect(8 - bindus, `${g}, house ${h}`).toBe(BPHS_KARANA_COUNTS[g][h - 1]);
      }
    }
  });

  it('BPHS and BJ differ in exactly the four documented marks', () => {
    const diffs: string[] = [];
    for (const g of SEVEN) for (const d of DONORS) if (sorted(AV_BJ[g][d]).join() !== sorted(AV_BPHS[g][d]).join()) diffs.push(`${g}/${d}`);
    expect(diffs).toEqual(MOON_VENUS_DIFFERENCES.map(([g, d]) => `${g}/${d}`));
  });

  it('marks per graha: 48 49 39 54 56 52 39, 337 in all, in both tables', () => {
    for (const table of [AV_BJ, AV_BPHS]) {
      const n = SEVEN.map((g) => DONORS.reduce((s, d) => s + table[g][d].length, 0));
      expect(n).toEqual([48, 49, 39, 54, 56, 52, 39]);
    }
  });
});

describe('a chart', () => {
  // Every graha in Meṣa, lagna Meṣa: bindus fall on the houses themselves.
  const lon = { sun: 1, moon: 2, mars: 3, mercury: 4, jupiter: 5, venus: 6, saturn: 7, rahu: 8, ketu: 188 };
  const av = ashtakavarga(lon, 0, 'bj');

  it('with all donors in one sign, each sign’s bindus are the donors marking that house', () => {
    expect(av.bhinna.sun).toEqual(Array.from({ length: 12 }, (_, s) => DONORS.filter((d) => AV_BJ.sun[d].includes(s + 1)).length));
    expect(av.sarva.reduce((a, b) => a + b)).toBe(337);
  });

  it('sarva is the sum of the seven', () => {
    for (let s = 0; s < 12; s++) expect(av.sarva[s]).toBe(SEVEN.reduce((t, g) => t + av.bhinna[g][s]!, 0));
  });
});

describe('reductions', () => {
  it('trikoṇa (67.4–5): least of each triangle off all three; all equal → all removed', () => {
    //            Ar Ta Ge Cn Le Vi Li Sc Sg Cp Aq Pi
    const b = [5, 3, 4, 2, 6, 3, 4, 0, 4, 1, 4, 6];
    expect(trikonaShodhana(b)).toEqual([1, 2, 0, 2, 2, 2, 0, 0, 0, 0, 0, 6]);
  });

  it('ekādhipatya (68.2–5), every case', () => {
    expect(ekadhipatyaPair(0, 5, false, false)).toEqual([0, 5]); // one empty: nothing (68.2)
    expect(ekadhipatyaPair(3, 5, true, true)).toEqual([3, 5]); // both occupied: nothing (68.3)
    expect(ekadhipatyaPair(4, 4, false, false)).toEqual([0, 0]); // neither, equal: all removed (68.5)
    expect(ekadhipatyaPair(2, 5, false, false)).toEqual([2, 2]); // neither, unequal: larger to smaller (68.2)
    expect(ekadhipatyaPair(2, 5, true, false)).toEqual([2, 2]); // occupied smaller: other to it (68.3–4)
    expect(ekadhipatyaPair(5, 2, true, false)).toEqual([5, 0]); // occupied larger: other emptied (68.4)
    expect(ekadhipatyaPair(3, 3, true, false)).toEqual([3, 0]); // equal: the empty one emptied (68.5)
    expect(ekadhipatyaPair(2, 5, false, true)).toEqual([0, 5]);
  });

  it('Karka and Siṃha are left alone (68.6)', () => {
    const b = [1, 1, 1, 7, 7, 1, 1, 1, 1, 1, 1, 1];
    const r = ekadhipatyaShodhana(b, new Set());
    expect(r[3]).toBe(7);
    expect(r[4]).toBe(7);
  });
});
