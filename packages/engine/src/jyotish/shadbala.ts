/**
 * Ṣaḍbala (BPHS 27), with the precise aspects of BPHS 26. All values in virūpas
 * (60 virūpas = 1 rūpa).
 *
 * Sthāna: uccha (27.1–2), saptavargaja (27.2–4), ojayugma, kendrādi (27.5), drekkāṇa (27.6).
 * Dik (27.7–8). Kāla: natonnata (27.8–9), pakṣa (27.10–11), tribhāga (27.12), abda, māsa,
 * vāra, horā (27.13), ayana (27.15–17), yuddha (27.20). Ceṣṭā (27.18, 27.24–25).
 * Naisargika (27.14). Dṛk (27.19). Required minimums (27.32–33). Lords of the year and month
 * (decided 2026-10-03, after the Rath-school Shri Jyoti Star): the weekday lords of the Sun's
 * entry into Meṣa and of its latest saṅkrānti; alternative, the Sūrya Siddhānta day-count.
 *
 * Readings that await Nilesh's decision are listed in `provisional` and docs/CANON.md.
 */
import type { Graha } from '../grahas.ts';
import { arc, degreesInSign, houseFrom, isOddSign, norm360, SEVEN, SIGN_LORD, type Planet } from './core.ts';
import type { Chart } from './chart.ts';
import { planetSigns } from './chart.ts';
import { compoundRelation, dignity, naturalRelation, OWN_SIGNS, temporalRelation, type Compound } from './dignity.ts';
import type { RuleId } from './sources.ts';
import { crueltyOf, elongation, mercuryTie, wars } from './states.ts';
import { vargaSign, type Varga } from './vargas.ts';

/** BPHS 26.6–12: aspect of `aspecting` on a point `a` degrees ahead of it, virūpas 0–60. */
export function sphutaDrishti(aspecting: Planet, a: number): number {
  const x = norm360(a);
  const r = Math.floor(x / 30);
  const d = x - 30 * r;
  if (aspecting === 'saturn') {
    if (r === 1) return 2 * d;
    if (r === 9) return 2 * (30 - d);
    if (r === 2) return 60 - d / 2;
    if (r === 8) return d + 30;
  } else if (aspecting === 'mars') {
    if (r === 3 || r === 7) return 60 - d;
    if (r === 2) return 1.5 * d + 15;
    if (r === 6) return 60;
  } else if (aspecting === 'jupiter') {
    if (r === 3 || r === 7) return d / 2 + 45;
    if (r === 4 || r === 8) return 60 - 2 * d;
  }
  if (r >= 6) return Math.max(0, (300 - x) / 2);
  if (r === 5) return 2 * d;
  if (r === 4) return 30 - d;
  if (r === 3) return (30 - d) / 2 + 30;
  if (r === 2) return d + 15;
  if (r === 1) return d / 2;
  return 0;
}

/** BPHS 27.14: 60/7 × 7, 6, … 1 for the Sun, Moon, Venus, Jupiter, Mercury, Mars, Saturn. */
export const NAISARGIKA: Readonly<Record<Planet, number>> = {
  sun: 60, moon: 360 / 7, venus: 300 / 7, jupiter: 240 / 7, mercury: 180 / 7, mars: 120 / 7, saturn: 60 / 7,
};

/** BPHS 27.32: 39, 36, 30, 42, 39, 33, 30 × 10 virūpas. */
export const REQUIRED: Readonly<Record<Planet, number>> = {
  sun: 390, moon: 360, mars: 300, mercury: 420, jupiter: 390, venus: 330, saturn: 300,
};

const SAPTAVARGA: readonly Varga[] = [1, 2, 3, 7, 9, 12, 30];
const RELATION_POINTS: Readonly<Record<Compound, number>> = { 'great-friend': 20, friend: 15, neutral: 10, enemy: 4, 'great-enemy': 2 };
const GENDER: Readonly<Record<Planet, 0 | 1 | 2>> = { sun: 0, mars: 0, jupiter: 0, mercury: 1, saturn: 1, moon: 2, venus: 2 };

/**
 * Mean longitudes, tropical, mean equinox of date (J. Meeus, Astronomical Algorithms,
 * 2nd ed., Table 31.A: L = a0 + a1 T + a2 T² + a3 T³, T in Julian centuries from J2000 TT).
 */
const MEAN_L: Readonly<Record<'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn', readonly [number, number, number, number]>> = {
  mercury: [252.250906, 149474.0722491, 0.0003035, 0.000000018],
  venus: [181.979801, 58519.2130302, 0.00031014, 0.000000015],
  earth: [100.466457, 36000.7698278, 0.00030322, 0.00000002],
  mars: [355.433, 19141.6964471, 0.00031052, 0.000000016],
  jupiter: [34.351519, 3036.3027748, 0.0002233, 0.000000037],
  saturn: [50.077444, 1223.5110686, 0.00051908, -0.00000003],
};
export function meanLongitude(body: keyof typeof MEAN_L, jdTT: number): number {
  const T = (jdTT - 2451545) / 36525;
  const [a0, a1, a2, a3] = MEAN_L[body];
  return norm360(a0 + T * (a1 + T * (a2 + T * a3)));
}

/** SS 1.51–52 day-count: days from the creation epoch to the Kali epoch (Friday, JDN 588466). */
export const SS_KALI_AHARGANA = 714402296627;
export const KALI_JDN = 588466;

/** Lords of the 360-day year and 30-day month of the Sūrya Siddhānta day-count (SS 1.51–52). */
export function ssYearMonthLords(jdn: number): { year: Planet; month: Planet } {
  const A = SS_KALI_AHARGANA + (jdn - KALI_JDN);
  const lord = (k: number) => SEVEN[(((k % 7) + 7) % 7 + 6) % 7]!; // remainder 1 = Sun … 0 = Saturn
  return { year: lord(3 * Math.floor(A / 360) + 1), month: lord(2 * Math.floor(A / 30) + 1) };
}

/** Sum of khaṇḍas 45, 33, 12 over the bhuja (BPHS 27.15–16): 90 sin λ by linear interpolation. */
export function khandaSum(tropical: number): number {
  const l = norm360(tropical);
  const b = l <= 90 ? l : l <= 180 ? 180 - l : l <= 270 ? l - 180 : 360 - l;
  if (b <= 30) return (45 * b) / 30;
  if (b <= 60) return 45 + (33 * (b - 30)) / 30;
  return 78 + (12 * (b - 60)) / 30;
}

export function ayanaBala(g: Planet, tropical: number): number {
  const s = khandaSum(tropical);
  const north = norm360(tropical) < 180;
  let sign: 1 | -1;
  if (g === 'mercury') sign = 1;
  else if (g === 'moon' || g === 'saturn') sign = north ? -1 : 1;
  else sign = north ? 1 : -1;
  return (90 + sign * s) / 3;
}

export interface ShadbalaRow {
  graha: Planet;
  sthana: { uccha: number; saptavargaja: number; ojayugma: number; kendradi: number; drekkana: number; total: number };
  dig: number;
  kala: { natonnata: number; paksha: number; tribhaga: number; abda: number; masa: number; vara: number; hora: number; ayana: number; yuddha: number; total: number };
  cheshta: number;
  naisargika: number;
  drik: number;
  /** Virūpas, rūpas, the minimum of BPHS 27.32, and total ÷ minimum. */
  total: number;
  rupas: number;
  required: number;
  ratio: number;
}

export interface Shadbala {
  rows: Record<Planet, ShadbalaRow>;
  lords: { year: Planet; month: Planet; day: Planet; hora: Planet };
  provisional: RuleId[];
}

export function shadbala(c: Chart): Shadbala {
  const signs = planetSigns(c);
  const lon = (g: Planet) => c.grahas[g].longitude;
  const cruel = crueltyOf(c);
  const e = elongation(c);
  const pakshaBase = (e > 180 ? 360 - e : e) / 3;

  // Time of day: the Sun's distance from local apparent midnight, in ghaṭīs (6° = 1 ghaṭī).
  const hourAngle = norm360(c.armc - c.grahas.sun.ra);
  const fromMidnight = (180 - Math.abs(hourAngle > 180 ? hourAngle - 360 : hourAngle)) / 6; // 0..30
  const nata = 30 - fromMidnight;

  const t = c.instant.jdUT;
  const third = c.day
    ? Math.min(2, Math.floor(((t - c.sunrise.jdUT) / (c.sunset.jdUT - c.sunrise.jdUT)) * 3))
    : Math.min(2, Math.floor(((t - c.sunset.jdUT) / (c.nextSunrise.jdUT - c.sunset.jdUT)) * 3));
  const tribhagaLord: Planet = c.day ? (['mercury', 'sun', 'saturn'] as const)[third]! : (['moon', 'venus', 'mars'] as const)[third]!;

  // Year and month lords: weekday lords of the Meṣa and the latest saṅkrānti (default), or the SS day-count.
  const { year, month } =
    c.settings.yearMonthLords === 'sankranti'
      ? { year: SEVEN[c.sankranti.mesha.vara]!, month: SEVEN[c.sankranti.latest.vara]! }
      : ssYearMonthLords(Math.floor(c.sunrise.jdUT + 0.5 + c.place.longitude / 360));
  const day = SEVEN[c.vara]!;
  const hora = c.horaLord;

  const meanSun = norm360(meanLongitude('earth', c.instant.jdTT) + 180);

  const rows = {} as Record<Planet, ShadbalaRow>;
  for (const g of SEVEN) {
    const l = lon(g);
    // ---- sthāna ----
    const uccha = dignity(g, l).fromDebilitation! / 3;
    let saptavargaja = 0;
    for (const v of SAPTAVARGA) {
      const s = vargaSign(l, v, c.settings.vargas).sign;
      if (v === 1 && dignity(g, l).kind === 'moolatrikona') saptavargaja += 45;
      else if (OWN_SIGNS[g].includes(s)) saptavargaja += 30;
      else {
        const lord = SIGN_LORD[s]!;
        saptavargaja += RELATION_POINTS[compoundRelation(naturalRelation(g, lord), temporalRelation(signs[g], signs[lord]))];
      }
    }
    const wantOdd = !(g === 'moon' || g === 'venus');
    const ojayugma = (isOddSign(signs[g]) === wantOdd ? 15 : 0) + (isOddSign(vargaSign(l, 9).sign) === wantOdd ? 15 : 0);
    const h = houseFrom(c.lagna, signs[g]);
    const kendradi = [1, 4, 7, 10].includes(h) ? 60 : [2, 5, 8, 11].includes(h) ? 30 : 15;
    const drekkana = Math.floor(degreesInSign(l) / 10) === GENDER[g] ? 15 : 0;
    const sthanaTotal = uccha + saptavargaja + ojayugma + kendradi + drekkana;

    // ---- dik ----
    const point = { sun: c.mc + 180, mars: c.mc + 180, jupiter: c.ascendant + 180, mercury: c.ascendant + 180, saturn: c.ascendant, venus: c.mc, moon: c.mc }[g];
    const dd = arc(point, l);
    const dig = (dd > 180 ? 360 - dd : dd) / 3;

    // ---- kāla ----
    const natonnata = g === 'mercury' ? 60 : g === 'moon' || g === 'mars' || g === 'saturn' ? 2 * nata : 60 - 2 * nata;
    const paksha = g === 'moon' || g === 'mercury' || g === 'venus' || g === 'jupiter' ? pakshaBase : 60 - pakshaBase;
    const tribhaga = g === 'jupiter' || g === tribhagaLord ? 60 : 0;
    const ayana = ayanaBala(g, c.grahas[g].tropical);

    // ---- ceṣṭā ----
    let cheshta: number;
    if (g === 'sun') cheshta = ayana;
    else if (g === 'moon') cheshta = paksha;
    else {
      const L = meanLongitude(g, c.instant.jdTT);
      const superior = g === 'mars' || g === 'jupiter' || g === 'saturn';
      const mean = superior ? L : meanSun;
      const sighrocca = superior ? meanSun : L;
      const tr = c.grahas[g].tropical;
      const avg = mean + ((((tr - mean + 540) % 360) - 180) / 2);
      const k = arc(avg, sighrocca);
      cheshta = (k > 180 ? 360 - k : k) / 3;
    }

    // ---- dṛk ----
    let drik = 0;
    for (const q of SEVEN) {
      if (q === g) continue;
      const v = sphutaDrishti(q, arc(lon(q), l));
      if (q === 'mercury' || q === 'jupiter') drik += v;
      else drik += cruel[q as Graha] ? -v / 4 : v / 4;
    }

    rows[g] = {
      graha: g,
      sthana: { uccha, saptavargaja, ojayugma, kendradi, drekkana, total: sthanaTotal },
      dig,
      kala: {
        natonnata,
        paksha,
        tribhaga,
        abda: g === year ? 15 : 0,
        masa: g === month ? 30 : 0,
        vara: g === day ? 45 : 0,
        hora: g === hora ? 60 : 0,
        ayana,
        yuddha: 0,
        total: 0,
      },
      cheshta,
      naisargika: NAISARGIKA[g],
      drik,
      total: 0,
      rupas: 0,
      required: REQUIRED[g],
      ratio: 0,
    };
  }

  const sum = (r: ShadbalaRow) => {
    const k = r.kala;
    k.total = k.natonnata + k.paksha + k.tribhaga + k.abda + k.masa + k.vara + k.hora + k.ayana + k.yuddha;
    r.total = r.sthana.total + r.dig + k.total + r.cheshta + r.naisargika + r.drik;
  };
  for (const g of SEVEN) sum(rows[g]);

  // Yuddha bala (27.20): the difference of the two totals moves from the vanquished to the victor.
  const ws = wars(c);
  for (const w of ws) {
    const [a, b] = w.grahas;
    const diff = Math.abs(rows[a].total - rows[b].total);
    const loser = w.victor === a ? b : a;
    rows[w.victor].kala.yuddha += diff;
    rows[loser].kala.yuddha -= diff;
  }
  for (const g of SEVEN) {
    sum(rows[g]);
    rows[g].rupas = rows[g].total / 60;
    rows[g].ratio = rows[g].total / rows[g].required;
  }

  const provisional: RuleId[] = ['shadbala-saptavarga-mt', 'dig-bala-points', 'natonnata-bala', 'ayana-bala', 'cheshta-bala', 'drik-bala', 'hora-length'];
  if (mercuryTie(c)) provisional.push('mercury-tie');
  if (ws.length) provisional.push('yuddha-bala', 'graha-yuddha');
  return { rows, lords: { year, month, day, hora }, provisional };
}
