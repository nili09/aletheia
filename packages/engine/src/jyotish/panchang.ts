/**
 * Pañcāṅga for a day and a place: the five limbs (tithi, nakṣatra, yoga, karaṇa, vāra)
 * with exact start and end instants, the lunar month, year, season and the divisions of
 * the day.
 *
 * The day is the vāra: sunrise to the next sunrise at the place (sunrise per the rise
 * convention). Each limb is a division of a steadily increasing angle (Sūrya Siddhānta
 * 2.64–69):
 *   tithi    Moon − Sun, in 12° parts (SS 2.66, 14.12)
 *   nakṣatra Moon, in 13°20′ = 800′ parts (SS 2.64), each in four padas
 *   yoga     Sun + Moon, in 800′ parts (SS 2.65)
 *   karaṇa   half a tithi, 6° of Moon − Sun (SS 2.67–69)
 * Start and end instants are found the way the event finder finds them: bracket by
 * sampling, refine with Brent's method to 1e-8 day.
 *
 * Lunar month (amānta): new moon to new moon, named after the saṅkrānti (sign the Sun
 * enters) within it — Caitra contains the Meṣa saṅkrānti. A month with no saṅkrānti is
 * adhika and takes the following month's name; one with two is kṣaya. Pūrṇimānta names
 * the dark half after the following month. Year: the 60-year cycle, counted from Śaka
 * years, changing at the start of Caitra. Season and ayana: from the Sun's sidereal sign
 * (SS 14.9–10).
 *
 * Day divisions: the eight portions of day and night and their lords (BPHS 3.66–69) give
 * Gulika (Saturn's portion) and Yamaghaṇṭaka (Jupiter's); Rāhu kāla by the weekday table
 * of modern pañcāṅgas; horā lords in the order of SS 12.78–79; fifteen muhūrtas of day and
 * of night, the eighth by day being abhijit.
 */
import { findCrossings } from '../events/roots.ts';
import { Sky } from '../events/events.ts';
import type { NodeKind } from '../grahas.ts';
import { assertPlace, type Place } from '../houses.ts';
import { nextRiseSet, type RiseConvention } from '../riseset.ts';
import type { SwissEph } from '../swe/swisseph.ts';
import { instantFromJdTT, instantFromJdUT, type Instant } from '../time.ts';
import type { Precision } from '../precision.ts';
import { norm360, SEVEN, signOf, type Planet } from './core.ts';
import type { RuleId } from './sources.ts';
import type { JyotishSettings } from './settings.ts';

export const TITHIS = [
  'Pratipadā', 'Dvitīyā', 'Tṛtīyā', 'Caturthī', 'Pañcamī', 'Ṣaṣṭhī', 'Saptamī', 'Aṣṭamī',
  'Navamī', 'Daśamī', 'Ekādaśī', 'Dvādaśī', 'Trayodaśī', 'Caturdaśī', 'Pūrṇimā',
] as const;
export const AMAVASYA = 'Amāvāsyā';

export const YOGAS = [
  'Viṣkambha', 'Prīti', 'Āyuṣmān', 'Saubhāgya', 'Śobhana', 'Atigaṇḍa', 'Sukarmā', 'Dhṛti', 'Śūla',
  'Gaṇḍa', 'Vṛddhi', 'Dhruva', 'Vyāghāta', 'Harṣaṇa', 'Vajra', 'Siddhi', 'Vyatīpāta', 'Varīyān',
  'Parigha', 'Śiva', 'Siddha', 'Sādhya', 'Śubha', 'Śukla', 'Brahma', 'Indra', 'Vaidhṛti',
] as const;

/** The seven movable karaṇas, eight times round from the second half of Śukla Pratipadā (SS 2.68). */
export const MOVABLE_KARANAS = ['Bava', 'Bālava', 'Kaulava', 'Taitila', 'Gara', 'Vaṇij', 'Viṣṭi'] as const;
/** The four fixed karaṇas, from the second half of Kṛṣṇa Caturdaśī, in SS 2.67's order and in the pañcāṅgas'. */
export const FIXED_KARANAS = {
  'surya-siddhanta': ['Śakuni', 'Nāga', 'Catuṣpada', 'Kiṃstughna'],
  pancanga: ['Śakuni', 'Catuṣpada', 'Nāga', 'Kiṃstughna'],
} as const;

/** Amānta month names, indexed by the sign whose saṅkrānti falls in the month (0 = Meṣa → Caitra). */
export const MONTHS = [
  'Caitra', 'Vaiśākha', 'Jyeṣṭha', 'Āṣāḍha', 'Śrāvaṇa', 'Bhādrapada',
  'Āśvina', 'Kārttika', 'Mārgaśīrṣa', 'Pauṣa', 'Māgha', 'Phālguna',
] as const;

export const SAMVATSARAS = [
  'Prabhava', 'Vibhava', 'Śukla', 'Pramoda', 'Prajāpati', 'Āṅgīrasa', 'Śrīmukha', 'Bhāva', 'Yuvan', 'Dhātṛ',
  'Īśvara', 'Bahudhānya', 'Pramāthin', 'Vikrama', 'Vṛṣa', 'Citrabhānu', 'Subhānu', 'Tāraṇa', 'Pārthiva', 'Vyaya',
  'Sarvajit', 'Sarvadhārin', 'Virodhin', 'Vikṛti', 'Khara', 'Nandana', 'Vijaya', 'Jaya', 'Manmatha', 'Durmukha',
  'Hemalamba', 'Vilamba', 'Vikārin', 'Śārvarī', 'Plava', 'Śubhakṛt', 'Śobhakṛt', 'Krodhin', 'Viśvāvasu', 'Parābhava',
  'Plavaṅga', 'Kīlaka', 'Saumya', 'Sādhāraṇa', 'Virodhakṛt', 'Paridhāvin', 'Pramādin', 'Ānanda', 'Rākṣasa', 'Anala',
  'Piṅgala', 'Kālayukta', 'Siddhārthin', 'Raudra', 'Durmati', 'Dundubhi', 'Rudhirodgārin', 'Raktākṣa', 'Krodhana', 'Akṣaya',
] as const;

/** Seasons from Śiśira, two signs each from Makara (SS 14.10). */
export const RITUS = ['Śiśira', 'Vasanta', 'Grīṣma', 'Varṣā', 'Śarad', 'Hemanta'] as const;

export const VARAS = ['Ravivāra', 'Somavāra', 'Maṅgalavāra', 'Budhavāra', 'Guruvāra', 'Śukravāra', 'Śanivāra'] as const;

/** Horā lords run down the order of the spheres from Saturn (SS 12.78–79). */
export const HORA_ORDER: readonly Planet[] = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'];

/** Rāhu kāla: which eighth of the daytime, by weekday (0 = Sunday). Modern pañcāṅga table. */
export const RAHU_KALA_PART = [7, 1, 6, 4, 5, 3, 2] as const;

export interface Span {
  start: Instant;
  end: Instant;
}
export interface TithiSpan extends Span {
  /** 1..30: 1–15 Śukla Pratipadā … Pūrṇimā, 16–30 Kṛṣṇa Pratipadā … Amāvāsyā. */
  index: number;
  name: string;
  paksha: 'shukla' | 'krishna';
}
export interface NakshatraSpan extends Span {
  /** 0..26 from Aśvinī. */
  index: number;
  padas: Array<Span & { pada: number }>;
}
export interface YogaSpan extends Span {
  index: number;
  name: string;
}
export interface KaranaSpan extends Span {
  /** 0..59, half-tithis from the first half of Śukla Pratipadā. */
  index: number;
  name: string;
}
export interface PortionSpan extends Span {
  /** 0-based portion of the day (or night). */
  part: number;
}
export interface LunarMonth {
  /** 0..11 into MONTHS. */
  index: number;
  name: string;
  adhika: boolean;
  /** Kṣaya: two saṅkrāntis fall in the month; it carries the next name too. */
  kshaya: boolean;
  kshayaWith?: string;
}

export interface Panchang {
  place: Place;
  sunrise: Instant;
  sunset: Instant;
  nextSunrise: Instant;
  vara: { index: number; name: string; lord: Planet };
  /** Every tithi, nakṣatra, yoga and karaṇa that overlaps the day, in order. */
  tithis: TithiSpan[];
  nakshatras: NakshatraSpan[];
  yogas: YogaSpan[];
  karanas: KaranaSpan[];
  paksha: 'shukla' | 'krishna';
  month: { amanta: LunarMonth; purnimanta: LunarMonth; newMoon: Instant; nextNewMoon: Instant };
  samvatsara: { index: number; name: string; shakaYear: number };
  ritu: { index: number; name: string };
  ayana: 'uttarayana' | 'dakshinayana';
  /** Eighths of the day and of the night with their lords (null: the lordless eighth), BPHS 3.66–67. */
  dayEighths: Array<PortionSpan & { lord: Planet | null }>;
  nightEighths: Array<PortionSpan & { lord: Planet | null }>;
  gulikaKala: { day: PortionSpan; night: PortionSpan };
  yamaganda: { day: PortionSpan; night: PortionSpan };
  rahuKala: PortionSpan;
  horas: Array<PortionSpan & { lord: Planet }>;
  muhurtas: { day: PortionSpan[]; night: PortionSpan[] };
  abhijit: PortionSpan;
  precision: Precision;
  /** Rules used here whose reading awaits Nilesh's decision (docs/CANON.md). */
  provisional: RuleId[];
}

const STEP = 0.25; // days: every angle here moves < 20° per step
const SEARCH = 3; // days: no limb lasts longer

/** Last time ≤ t at which the increasing angle f passes target. */
function lastCrossing(f: (t: number) => number, target: number, t: number, days = SEARCH): number {
  const r = findCrossings(f, target, t - days, t + 1e-9, { step: STEP, angular: true });
  if (!r.length) throw new Error(`pañcāṅga: no crossing of ${target}° in the ${days} days before JD ${t}`);
  return r[r.length - 1]!;
}

/** First time > t at which the increasing angle f passes target. */
function nextCrossing(f: (t: number) => number, target: number, t: number, days = SEARCH): number {
  const r = findCrossings(f, target, t, t + days, { step: STEP, angular: true }).filter((x) => x > t);
  if (!r.length) throw new Error(`pañcāṅga: no crossing of ${target}° in the ${days} days after JD ${t}`);
  return r[0]!;
}

/** The divisions of an increasing angle (units equal parts of 360°) that overlap [a, b), in TT. */
function divisions(f: (t: number) => number, units: number, a: number, b: number): Array<{ index: number; start: number; end: number }> {
  const span = 360 / units;
  let k = Math.min(Math.floor(norm360(f(a)) / span), units - 1);
  let start = lastCrossing(f, k * span, a);
  const out = [];
  for (;;) {
    const end = nextCrossing(f, ((k + 1) % units) * span, Math.max(start, a));
    out.push({ index: k, start, end });
    if (end >= b) return out;
    k = (k + 1) % units;
    start = end;
  }
}

/** The latest sunrise at or before jdUT. */
export function sunriseAtOrBefore(swe: SwissEph, jdUT: number, place: Place, conv: RiseConvention): Instant {
  for (let back = 1.5; back <= 6; back += 1.5) {
    const first = nextRiseSet(swe, instantFromJdUT(swe, jdUT - back), 'sun', place, conv).rise;
    if (!first || first.jdUT > jdUT) continue;
    let rise: Instant = first;
    for (;;) {
      const next: Instant | null = nextRiseSet(swe, instantFromJdUT(swe, rise.jdUT + 1e-5), 'sun', place, conv).rise;
      if (!next || next.jdUT > jdUT) return rise;
      rise = next;
    }
  }
  throw new RangeError('pañcāṅga: the Sun does not rise at this place on this date');
}

/** Day of the week of the local civil date of a UT instant at a longitude (0 = Sunday). */
export function weekdayAt(jdUT: number, longitude: number): number {
  const jdn = Math.floor(jdUT + 0.5 + longitude / 360);
  return (((jdn + 1) % 7) + 7) % 7;
}

export function karanaName(index: number, order: JyotishSettings['karanaOrder']): string {
  const fixed = FIXED_KARANAS[order];
  if (index === 0) return fixed[3];
  if (index >= 57) return fixed[index - 57]!;
  return MOVABLE_KARANAS[(index - 1) % 7]!;
}

export function tithiName(index: number): string {
  return index === 30 ? AMAVASYA : TITHIS[(index - 1) % 15]!;
}

/** Amānta month from the Sun's sign at its two new moons (s1 at the start, s2 at the end). */
export function lunarMonth(s1: number, s2: number): LunarMonth {
  const n = (s2 - s1 + 12) % 12;
  const index = (s1 + 1) % 12;
  if (n === 0) return { index, name: MONTHS[index]!, adhika: true, kshaya: false };
  if (n === 1) return { index, name: MONTHS[index]!, adhika: false, kshaya: false };
  if (n === 2) return { index, name: MONTHS[index]!, adhika: false, kshaya: true, kshayaWith: MONTHS[(index + 1) % 12]! };
  throw new Error(`lunar month: the Sun moved ${n} signs in one lunation`);
}

/** Śaka year of an amānta month, from the Gregorian year and month of its first new moon. */
export function shakaYear(monthIndex: number, startYear: number, startMonth: number): number {
  return monthIndex >= 9 && startMonth <= 3 ? startYear - 79 : startYear - 78;
}

export function samvatsaraIndex(shaka: number): number {
  return (((shaka + 11) % 60) + 60) % 60;
}

export function rituIndex(sunSign: number): number {
  return Math.floor((((sunSign - 9) % 12) + 12) % 12 / 2);
}

export function panchang(swe: SwissEph, at: Instant, place: Place, s: JyotishSettings, node: NodeKind = s.node): Panchang {
  assertPlace(place);
  const conv = s.riseConvention;
  const sunrise = sunriseAtOrBefore(swe, at.jdUT, place, conv);
  const sunset = nextRiseSet(swe, sunrise, 'sun', place, conv).set;
  if (!sunset) throw new RangeError('pañcāṅga: the Sun does not set at this place on this date');
  const nextSunrise = nextRiseSet(swe, sunset, 'sun', place, conv).rise;
  if (!nextSunrise) throw new RangeError('pañcāṅga: the Sun does not rise again at this place on this date');

  const sky = new Sky(swe, node);
  const moon = (t: number) => sky.lon('moon', t);
  const elong = (t: number) => sky.lon('moon', t) - sky.lon('sun', t);
  const sum = (t: number) => sky.lon('moon', t) + sky.lon('sun', t);
  const A = sunrise.jdTT;
  const B = nextSunrise.jdTT;
  const I = (jdTT: number) => instantFromJdTT(swe, jdTT);
  const U = (jdUT: number) => instantFromJdUT(swe, jdUT);

  const tithis = divisions(elong, 30, A, B).map(({ index, start, end }) => {
    const n = index + 1;
    return { index: n, name: tithiName(n), paksha: n <= 15 ? 'shukla' : 'krishna', start: I(start), end: I(end) } as TithiSpan;
  });
  const nakshatras = divisions(moon, 27, A, B).map(({ index, start, end }) => {
    const padas = divisions(moon, 108, start + 1e-7, end - 1e-7).map((p) => ({ pada: (p.index % 4) + 1, start: I(p.start), end: I(p.end) }));
    return { index, start: I(start), end: I(end), padas };
  });
  const yogas = divisions(sum, 27, A, B).map(({ index, start, end }) => ({ index, name: YOGAS[index]!, start: I(start), end: I(end) }));
  const karanas = divisions(elong, 60, A, B).map(({ index, start, end }) => ({ index, name: karanaName(index, s.karanaOrder), start: I(start), end: I(end) }));

  // Lunar month: the lunation containing sunrise.
  const nm1 = lastCrossing(elong, 0, A, 31);
  const nm2 = nextCrossing(elong, 0, A, 31);
  const sunSign = (t: number) => signOf(sky.lon('sun', t));
  const amanta = lunarMonth(sunSign(nm1), sunSign(nm2));
  const paksha = tithis[0]!.paksha;
  let purnimanta: LunarMonth = amanta;
  if (paksha === 'krishna' && !amanta.adhika) {
    const nm3 = nextCrossing(elong, 0, nm2 + 1, 31);
    const next = lunarMonth(sunSign(nm2), sunSign(nm3));
    purnimanta = { ...next, adhika: false };
  }
  const start = swe.revjul(I(nm1).jdUT);
  const shaka = shakaYear(amanta.index, start.year, start.month);
  const sv = samvatsaraIndex(shaka);

  const sunNow = sunSign(A);
  const ri = rituIndex(sunNow);

  // Day divisions (UT days).
  const w = weekdayAt(sunrise.jdUT, place.longitude);
  const day = sunset.jdUT - sunrise.jdUT;
  const night = nextSunrise.jdUT - sunset.jdUT;
  const portions = (from: number, len: number, n: number) => Array.from({ length: n }, (_, i) => ({ part: i, start: U(from + (i * len) / n), end: U(from + ((i + 1) * len) / n) }));
  const dayEighths = portions(sunrise.jdUT, day, 8).map((p) => ({ ...p, lord: p.part < 7 ? SEVEN[(w + p.part) % 7]! : null }));
  const nightEighths = portions(sunset.jdUT, night, 8).map((p) => ({ ...p, lord: p.part < 7 ? SEVEN[(w + 4 + p.part) % 7]! : null }));
  const of = (list: typeof dayEighths, g: Planet) => {
    const { lord: _, ...p } = list.find((x) => x.lord === g)!;
    return p;
  };
  const dayMuhurtas = portions(sunrise.jdUT, day, 15);
  const nightMuhurtas = portions(sunset.jdUT, night, 15);
  const horaSpans = s.hora === 'equal' ? portions(sunrise.jdUT, day + night, 24) : [...portions(sunrise.jdUT, day, 12), ...portions(sunset.jdUT, night, 12).map((p) => ({ ...p, part: p.part + 12 }))];
  const first = HORA_ORDER.indexOf(SEVEN[w]!);
  const horas = horaSpans.map((p) => ({ ...p, lord: HORA_ORDER[(first + p.part) % 7]! }));

  const precision: Precision = [sunrise, nextSunrise, I(nm1), I(nm2)].some((x) => x.precision === 'reduced') ? 'reduced' : 'full';
  return {
    place,
    sunrise,
    sunset,
    nextSunrise,
    vara: { index: w, name: VARAS[w]!, lord: SEVEN[w]! },
    tithis,
    nakshatras,
    yogas,
    karanas,
    paksha,
    month: { amanta, purnimanta, newMoon: I(nm1), nextNewMoon: I(nm2) },
    samvatsara: { index: sv, name: SAMVATSARAS[sv]!, shakaYear: shaka },
    ritu: { index: ri, name: RITUS[ri]! },
    ayana: [9, 10, 11, 0, 1, 2].includes(sunNow) ? 'uttarayana' : 'dakshinayana',
    dayEighths,
    nightEighths,
    gulikaKala: { day: of(dayEighths, 'saturn'), night: of(nightEighths, 'saturn') },
    yamaganda: { day: of(dayEighths, 'jupiter'), night: of(nightEighths, 'jupiter') },
    rahuKala: dayEighths[RAHU_KALA_PART[w]!]!,
    horas,
    muhurtas: { day: dayMuhurtas, night: nightMuhurtas },
    abhijit: dayMuhurtas[7]!,
    precision,
    provisional: ['hora-length', 'karana-fixed-order', 'lunar-month', 'samvatsara', 'ritu', 'ayana', 'rahu-kala', 'muhurta'],
  };
}
