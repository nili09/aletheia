/**
 * Daśās: Viṃśottarī (BPHS 46.12–16), Yoginī (46.195–200), with sub-periods in proportion
 * from the period's own lord (51.1–2), to any depth; and the cara daśā of the signs
 * (46.155–167).
 *
 * Times are Julian days in TT, the ephemeris's uniform scale; a daśā year is
 * settings.dashaYearDays days of it (default 365.25). Periods tile time exactly: each one
 * starts where the previous ends, and the last child ends where its parent ends.
 */
import type { Graha } from '../grahas.ts';
import { addSigns, signOf, type Sign } from './core.ts';
import { dignity } from './dignity.ts';
import { chooseLord, type LordChoice } from './jaimini.ts';
import type { RuleId } from './sources.ts';

export interface NakshatraDashaSystem {
  name: 'vimshottari' | 'yogini';
  /** Period names in order (Viṃśottarī: the lords; Yoginī: the yoginīs). */
  names: readonly string[];
  /** The graha ruling each period. */
  lords: readonly Graha[];
  years: readonly number[];
  total: number;
  /** Index of the period running at the start of nakṣatra n (0 = Aśvinī). */
  first: (nakshatra: number) => number;
}

export const VIMSHOTTARI: NakshatraDashaSystem = {
  name: 'vimshottari',
  names: ['sun', 'moon', 'mars', 'rahu', 'jupiter', 'saturn', 'mercury', 'ketu', 'venus'],
  lords: ['sun', 'moon', 'mars', 'rahu', 'jupiter', 'saturn', 'mercury', 'ketu', 'venus'],
  years: [6, 10, 7, 18, 16, 19, 17, 7, 20],
  total: 120,
  // From Kṛttikā (n = 2), thrice round (46.12–13).
  first: (n) => (n + 7) % 9,
};

export const YOGINI: NakshatraDashaSystem = {
  name: 'yogini',
  names: ['Maṅgalā', 'Piṅgalā', 'Dhanyā', 'Bhrāmarī', 'Bhadrikā', 'Ulkā', 'Siddhā', 'Saṅkaṭā'],
  lords: ['moon', 'sun', 'jupiter', 'mars', 'mercury', 'saturn', 'venus', 'rahu'],
  years: [1, 2, 3, 4, 5, 6, 7, 8],
  total: 36,
  // Birth nakṣatra number (1-based) + 3, remainder of 8, from Maṅgalā (46.199).
  first: (n) => (n + 3) % 8,
};

export interface Period {
  /** Index into the system's names and lords. */
  index: number;
  name: string;
  lord: Graha;
  /** 1 = mahā, 2 = antar, 3 = pratyantar, 4 = sūkṣma, 5 = prāṇa. */
  level: number;
  /** Start and end, Julian day TT. */
  start: number;
  end: number;
}

export interface DashaRun {
  system: NakshatraDashaSystem['name'];
  /** Birth, JD TT. */
  birth: number;
  yearDays: number;
  /** Nakṣatra of the Moon and the fraction of it crossed at birth (by arc: SS 2.64). */
  nakshatra: number;
  elapsedFraction: number;
  /** Years of the first period already gone at birth. */
  elapsedYears: number;
  /** Periods of level 1 from the one running at birth until at least 120 years after birth. */
  periods: Period[];
  provisional: RuleId[];
}

function period(sys: NakshatraDashaSystem, index: number, level: number, start: number, end: number): Period {
  return { index, name: sys.names[index]!, lord: sys.lords[index]!, level, start, end };
}

export function nakshatraDasha(sys: NakshatraDashaSystem, moonLongitude: number, birthTT: number, yearDays: number, spanYears = 120): DashaRun {
  if (!(moonLongitude >= 0 && moonLongitude < 360)) throw new RangeError(`Moon longitude must be in [0, 360), got ${moonLongitude}`);
  if (!(yearDays > 0)) throw new RangeError(`year length must be positive, got ${yearDays}`);
  const u = (moonLongitude * 27) / 360;
  const n = Math.min(Math.floor(u), 26);
  const f = u - n;
  let i = sys.first(n);
  const elapsedYears = f * sys.years[i]!;
  let start = birthTT - elapsedYears * yearDays;
  const until = birthTT + spanYears * yearDays;
  const periods: Period[] = [];
  while (start < until) {
    const end = start + sys.years[i]! * yearDays;
    periods.push(period(sys, i, 1, start, end));
    start = end;
    i = (i + 1) % sys.names.length;
  }
  return { system: sys.name, birth: birthTT, yearDays, nakshatra: n, elapsedFraction: f, elapsedYears, periods, provisional: ['dasha-year'] };
}

/** The sub-periods of a period (BPHS 51.1–2): from its own lord, in order, in proportion to the years. */
export function subPeriods(sys: NakshatraDashaSystem, p: Period): Period[] {
  const out: Period[] = [];
  const len = p.end - p.start;
  let acc = 0;
  const k = sys.names.length;
  for (let j = 0; j < k; j++) {
    const idx = (p.index + j) % k;
    const s = p.start + (len * acc) / sys.total;
    acc += sys.years[idx]!;
    const e = j === k - 1 ? p.end : p.start + (len * acc) / sys.total;
    out.push(period(sys, idx, p.level + 1, s, e));
  }
  return out;
}

/** The chain of periods (mahā … down to `depth` levels) running at jdTT. */
export function dashaAt(sys: NakshatraDashaSystem, run: DashaRun, jdTT: number, depth = 5): Period[] {
  const chain: Period[] = [];
  let list = run.periods;
  for (let level = 1; level <= depth; level++) {
    const p = list.find((x) => jdTT >= x.start && jdTT < x.end);
    if (!p) break;
    chain.push(p);
    list = subPeriods(sys, p);
  }
  return chain;
}

export const vimshottari = (moonLongitude: number, birthTT: number, yearDays: number) => nakshatraDasha(VIMSHOTTARI, moonLongitude, birthTT, yearDays);
export const yogini = (moonLongitude: number, birthTT: number, yearDays: number) => nakshatraDasha(YOGINI, moonLongitude, birthTT, yearDays);

// ---------- cara daśā ----------

/** Odd padas (BPHS 46.156): Meṣa–Mithuna and Tulā–Dhanus count forward; the others backward. */
export function isOddPada(s: Sign): boolean {
  return Math.floor(s / 3) % 2 === 0;
}

export interface CharaPeriod {
  sign: Sign;
  lord: LordChoice;
  /** Signs counted to the lord (0 → 12 years), before ±1 for the lord's dignity. */
  count: number;
  adjustment: -1 | 0 | 1;
  years: number;
  start: number;
  end: number;
}

export interface CharaDasha {
  direction: 'forward' | 'backward';
  periods: CharaPeriod[];
  provisional: RuleId[];
}

export function charaDasha(lagna: Sign, lon: Readonly<Record<Graha, number>>, birthTT: number, yearDays: number): CharaDasha {
  const forward = isOddPada(addSigns(lagna, 8));
  const periods: CharaPeriod[] = [];
  let start = birthTT;
  let twoLords = false;
  for (let i = 0; i < 12; i++) {
    const sign = addSigns(lagna, forward ? i : -i);
    const countTo = (ls: Sign) => (isOddPada(sign) ? addSigns(ls, -sign) : addSigns(sign, -ls));
    const lord = chooseLord(sign, lon, countTo);
    if (lord.by !== 'single') twoLords = true;
    const count = countTo(signOf(lon[lord.lord]));
    const kind = dignity(lord.lord, lon[lord.lord]).kind;
    const adjustment = kind === 'exalted' ? 1 : kind === 'debilitated' ? -1 : 0;
    const years = (count === 0 ? 12 : count) + adjustment;
    const end = start + years * yearDays;
    periods.push({ sign, lord, count, adjustment, years, start, end });
    start = end;
  }
  return { direction: forward ? 'forward' : 'backward', periods, provisional: ['chara-dasha', 'dasha-year', ...(twoLords ? (['two-lords'] as const) : [])] };
}
