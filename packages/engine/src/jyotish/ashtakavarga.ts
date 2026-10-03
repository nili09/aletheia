/**
 * Aṣṭakavarga (BPHS 66–68; Bṛhajjātaka 9).
 *
 * For each of the seven grahas, eight donors — the seven and the lagna — each give a bindu
 * (BPHS: sthāna, a line) to certain houses counted from where the donor stands. A graha's
 * own table (bhinnāṣṭakavarga) counts, per sign, the donors that mark it; the sarva table
 * adds the seven. The tables give 48, 49, 39, 54, 56, 52, 39 = 337 marks whatever the chart.
 *
 * Two recensions: BPHS 66 as transcribed (default) and Bṛhajjātaka 9 differ in four marks,
 * all in the Moon's and Venus's tables (MOON_VENUS_DIFFERENCES); totals are equal.
 *
 * Reductions: trikoṇa (BPHS 67) — subtract the least of each triangle of signs; then
 * ekādhipatya (BPHS 68) — for the two signs of one lord, by which of them hold grahas.
 */
import type { Graha } from '../grahas.ts';
import { addSigns, SEVEN, signOf, type Planet, type Sign } from './core.ts';
import type { RuleId } from './sources.ts';

export type Donor = Planet | 'lagna';
export const DONORS: readonly Donor[] = [...SEVEN, 'lagna'];
type Table = Readonly<Record<Planet, Readonly<Record<Donor, readonly number[]>>>>;

/** Bṛhajjātaka 9.1–7: houses from each donor where it gives a bindu, per graha. */
export const AV_BJ: Table = {
  sun: { sun: [1, 2, 4, 7, 8, 9, 10, 11], moon: [3, 6, 10, 11], mars: [1, 2, 4, 7, 8, 9, 10, 11], mercury: [3, 5, 6, 9, 10, 11, 12], jupiter: [5, 6, 9, 11], venus: [6, 7, 12], saturn: [1, 2, 4, 7, 8, 9, 10, 11], lagna: [3, 4, 6, 10, 11, 12] },
  moon: { sun: [3, 6, 7, 8, 10, 11], moon: [1, 3, 6, 7, 10, 11], mars: [2, 3, 5, 6, 9, 10, 11], mercury: [1, 3, 4, 5, 7, 8, 10, 11], jupiter: [1, 4, 7, 8, 10, 11, 12], venus: [3, 4, 5, 7, 9, 10, 11], saturn: [3, 5, 6, 11], lagna: [3, 6, 10, 11] },
  mars: { sun: [3, 5, 6, 10, 11], moon: [3, 6, 11], mars: [1, 2, 4, 7, 8, 10, 11], mercury: [3, 5, 6, 11], jupiter: [6, 10, 11, 12], venus: [6, 8, 11, 12], saturn: [1, 4, 7, 8, 9, 10, 11], lagna: [1, 3, 6, 10, 11] },
  mercury: { sun: [5, 6, 9, 11, 12], moon: [2, 4, 6, 8, 10, 11], mars: [1, 2, 4, 7, 8, 9, 10, 11], mercury: [1, 3, 5, 6, 9, 10, 11, 12], jupiter: [6, 8, 11, 12], venus: [1, 2, 3, 4, 5, 8, 9, 11], saturn: [1, 2, 4, 7, 8, 9, 10, 11], lagna: [1, 2, 4, 6, 8, 10, 11] },
  jupiter: { sun: [1, 2, 3, 4, 7, 8, 9, 10, 11], moon: [2, 5, 7, 9, 11], mars: [1, 2, 4, 7, 8, 10, 11], mercury: [1, 2, 4, 5, 6, 9, 10, 11], jupiter: [1, 2, 3, 4, 7, 8, 10, 11], venus: [2, 5, 6, 9, 10, 11], saturn: [3, 5, 6, 12], lagna: [1, 2, 4, 5, 6, 7, 9, 10, 11] },
  venus: { sun: [8, 11, 12], moon: [1, 2, 3, 4, 5, 8, 9, 11, 12], mars: [3, 5, 6, 9, 11, 12], mercury: [3, 5, 6, 9, 11], jupiter: [5, 8, 9, 10, 11], venus: [1, 2, 3, 4, 5, 8, 9, 10, 11], saturn: [3, 4, 5, 8, 9, 10, 11], lagna: [1, 2, 3, 4, 5, 8, 9, 11] },
  saturn: { sun: [1, 2, 4, 7, 8, 10, 11], moon: [3, 6, 11], mars: [3, 5, 6, 10, 11, 12], mercury: [6, 8, 9, 10, 11, 12], jupiter: [5, 6, 11, 12], venus: [6, 11, 12], saturn: [3, 5, 6, 11], lagna: [1, 3, 4, 6, 10, 11] },
};

/** Where BPHS 66 (this recension) differs from BJ 9: [graha's table, donor, BPHS houses]. */
export const MOON_VENUS_DIFFERENCES: ReadonlyArray<readonly [Planet, Donor, readonly number[]]> = [
  ['moon', 'moon', [1, 3, 6, 7, 9, 10, 11]], // BPHS 66.46–48: the Moon gives the 9th
  ['moon', 'mars', [2, 3, 5, 6, 10, 11]], // … Mars does not give the 9th
  ['moon', 'jupiter', [1, 2, 4, 7, 8, 10, 11]], // … Jupiter gives the 2nd, not the 12th
  ['venus', 'mars', [3, 4, 6, 9, 11, 12]], // BPHS 66.56–58: Mars gives the 4th, not the 5th
];

export const AV_BPHS: Table = (() => {
  const t = structuredClone(AV_BJ) as Record<Planet, Record<Donor, number[]>>;
  for (const [g, d, houses] of MOON_VENUS_DIFFERENCES) t[g][d] = [...houses];
  return t;
})();

export interface Ashtakavarga {
  table: 'bphs' | 'bj';
  /** Bindus per sign (index 0 = Meṣa) for each graha. */
  bhinna: Record<Planet, number[]>;
  sarva: number[];
  /** After trikoṇa and then ekādhipatya śodhana. */
  trikona: Record<Planet, number[]>;
  ekadhipatya: Record<Planet, number[]>;
  provisional: RuleId[];
}

export function bhinna(table: Table, g: Planet, donorSigns: Readonly<Record<Donor, Sign>>): number[] {
  const out = new Array<number>(12).fill(0);
  for (const d of DONORS) for (const h of table[g][d]) out[addSigns(donorSigns[d], h - 1)]!++;
  return out;
}

/** BPHS 67.4–5: subtract the least of each triangle from all three. */
export function trikonaShodhana(b: readonly number[]): number[] {
  const out = [...b];
  for (let k = 0; k < 4; k++) {
    const t = [k, k + 4, k + 8];
    const m = Math.min(...t.map((s) => out[s]!));
    for (const s of t) out[s]! -= m;
  }
  return out;
}

/** Sign pairs with one lord (BPHS 68.6: Karka and Siṃha excluded). */
export const ONE_LORD_PAIRS: ReadonlyArray<readonly [Sign, Sign]> = [[0, 7], [1, 6], [2, 5], [8, 11], [9, 10]];

/** BPHS 68.2–5, for one pair: values and whether each sign holds a graha. */
export function ekadhipatyaPair(a: number, b: number, occA: boolean, occB: boolean): [number, number] {
  if (a === 0 || b === 0) return [a, b]; // 68.2: only when both signs hold figures
  if (occA && occB) return [a, b]; // 68.3
  if (!occA && !occB) return a === b ? [0, 0] : [Math.min(a, b), Math.min(a, b)]; // 68.5, 68.2
  // One occupied (68.3–5): the other is made equal to it if it is smaller, else emptied.
  if (occA) return [a, a < b ? a : 0];
  return [b < a ? b : 0, b];
}

export function ekadhipatyaShodhana(b: readonly number[], occupied: ReadonlySet<Sign>): number[] {
  const out = [...b];
  for (const [x, y] of ONE_LORD_PAIRS) {
    const [nx, ny] = ekadhipatyaPair(out[x]!, out[y]!, occupied.has(x), occupied.has(y));
    out[x] = nx;
    out[y] = ny;
  }
  return out;
}

export function ashtakavarga(lon: Readonly<Record<Graha, number>>, lagna: Sign, which: 'bphs' | 'bj'): Ashtakavarga {
  const table = which === 'bphs' ? AV_BPHS : AV_BJ;
  const donorSigns = { lagna } as Record<Donor, Sign>;
  for (const g of SEVEN) donorSigns[g] = signOf(lon[g]);
  // Occupied by the seven grahas (docs/CANON.md: Rahu and Ketu not counted, pending).
  const occupied = new Set(SEVEN.map((g) => donorSigns[g]));
  const b = {} as Record<Planet, number[]>;
  const tr = {} as Record<Planet, number[]>;
  const ek = {} as Record<Planet, number[]>;
  for (const g of SEVEN) {
    b[g] = bhinna(table, g, donorSigns);
    tr[g] = trikonaShodhana(b[g]);
    ek[g] = ekadhipatyaShodhana(tr[g], occupied);
  }
  const sarva = Array.from({ length: 12 }, (_, s) => SEVEN.reduce((sum, g) => sum + b[g][s]!, 0));
  return { table: which, bhinna: b, sarva, trikona: tr, ekadhipatya: ek, provisional: ['ashtakavarga', 'ekadhipatya-shodhana'] };
}
