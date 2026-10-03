/**
 * Pañcāṅga.
 *
 * Outside reference: Drik Panchang (fixture drik-panchang.json, 12 past days 1990–2024 at
 * four Indian cities). Tolerance 90 s, set before measuring: Drik shows minutes (±60 s)
 * and may differ from us in the city's exact coordinates and elevation. Compared: sunrise,
 * sunset, the end of every tithi, nakṣatra, yoga and karaṇa of the day, Rāhu kāla,
 * Yamagaṇḍa, Gulika kāla, abhijit, the amānta and pūrṇimānta months and the Śaka year.
 *
 * Then rules and invariants the pañcāṅga must satisfy at any date: limbs tile the day
 * without gaps, each boundary is where the angle crosses its multiple, the karaṇa cycle,
 * the day portions of BPHS 3.66–69, horā lords, the month naming.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Engine, Instant } from '../src/index.ts';
import { DEFAULT_JYOTISH } from '../src/jyotish/settings.ts';
import { karanaName, lunarMonth, MONTHS, rituIndex, samvatsaraIndex, SAMVATSARAS, shakaYear, weekdayAt, type Panchang } from '../src/jyotish/panchang.ts';
import { fixture, loadEngine } from './helpers.ts';

interface DrikDay {
  place: string;
  date: string;
  sunrise: string;
  sunset: string;
  tithi: Array<{ name: string; upto: string | null }>;
  nakshatra: Array<{ name: string; upto: string | null }>;
  yoga: Array<{ name: string; upto: string | null }>;
  karana: Array<{ name: string; upto: string | null }>;
  amanta: string;
  purnimanta: string;
  shakaSamvat: string;
  rahuKalam: { start: string; end: string };
  yamaganda: { start: string; end: string };
  gulikai: { start: string; end: string };
  abhijit: { start: string; end: string } | null;
}
interface DrikFixture {
  places: Record<string, { latitude: number; longitude: number }>;
  days: DrikDay[];
}
const drik = fixture<DrikFixture>('drik-panchang.json');

// Drik Panchang's spellings, in our index order.
const D_TITHI = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima'];
const D_NAKSHATRA = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
const D_YOGA = ['Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyana', 'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti'];
const D_KARANA: Record<string, string> = { Bava: 'Bava', Balava: 'Bālava', Kaulava: 'Kaulava', Taitila: 'Taitila', Garaja: 'Gara', Vanija: 'Vaṇij', Vishti: 'Viṣṭi', Shakuni: 'Śakuni', Chatushpada: 'Catuṣpada', Nagava: 'Nāga', Kinstughna: 'Kiṃstughna' };
const D_MONTH = ['Chaitra', 'Vaishakha', 'Jyeshtha', 'Ashadha', 'Shravana', 'Bhadrapada', 'Ashwina', 'Kartika', 'Margashirsha', 'Pausha', 'Magha', 'Phalguna'];

const TOL_S = 90;

let engine: Engine;
beforeAll(async () => {
  engine = await loadEngine();
});

const secondsOff = (ours: Instant, iso: string) => (engine.unixMs(ours) - Date.parse(iso)) / 1000;

describe('against Drik Panchang (12 days, 1990–2024)', () => {
  // Signed residuals ours − Drik, seconds, collected over all days; each kind is one test below.
  const res: Record<string, number[]> = {};
  const note = (kind: string, s: number) => (res[kind] ??= []).push(s);

  beforeAll(() => {
    for (const day of drik.days) {
      const place = drik.places[day.place]!;
      // Local morning, after sunrise, so the vāra day is the calendar date's.
      const p: Panchang = engine.panchang({ unixMs: Date.parse(`${day.date}T06:30:00Z`) }, place, { ...DEFAULT_JYOTISH, karanaOrder: 'pancanga' });
      const where = `${day.place} ${day.date}`;
      note('sunrise', secondsOff(p.sunrise, day.sunrise));
      note('sunset', secondsOff(p.sunset, day.sunset));
      for (const d of day.tithi.filter((x) => x.upto)) {
        const ours = p.tithis.find((t) => (d.name === 'Amavasya' ? t.index === 30 : t.index !== 30 && D_TITHI[(t.index - 1) % 15] === d.name));
        if (!ours) throw new Error(`${where}: no tithi ${d.name}`);
        note('tithi', secondsOff(ours.end, d.upto!));
      }
      for (const d of day.nakshatra.filter((x) => x.upto)) {
        const ours = p.nakshatras.find((n) => D_NAKSHATRA[n.index] === d.name);
        if (!ours) throw new Error(`${where}: no nakshatra ${d.name}`);
        note('nakshatra', secondsOff(ours.end, d.upto!));
      }
      for (const d of day.yoga.filter((x) => x.upto)) {
        const ours = p.yogas.find((y) => D_YOGA[y.index] === d.name);
        if (!ours) throw new Error(`${where}: no yoga ${d.name}`);
        note('yoga', secondsOff(ours.end, d.upto!));
      }
      // Karaṇas in order, from the one current at sunrise.
      const names = p.karanas.map((k) => k.name).join(',');
      const theirs = day.karana.map((k) => D_KARANA[k.name]).join(',');
      if (names !== theirs) throw new Error(`${where}: karaṇas ${names} ≠ ${theirs}`);
      day.karana.forEach((d, i) => d.upto && note('karana', secondsOff(p.karanas[i]!.end, d.upto)));
      for (const [kind, ours, t] of [
        ['rahu kāla', p.rahuKala, day.rahuKalam],
        ['yamagaṇḍa', p.yamaganda.day, day.yamaganda],
        ['gulika kāla', p.gulikaKala.day, day.gulikai],
        ['abhijit', p.abhijit, day.abhijit],
      ] as const) {
        if (!t?.start) continue; // Drik shows no abhijit on Wednesdays
        note(kind, secondsOff(ours.start, t.start));
        note(kind, secondsOff(ours.end, t.end));
      }
      note('month', D_MONTH[p.month.amanta.index] === day.amanta && D_MONTH[p.month.purnimanta.index] === day.purnimanta ? 0 : Infinity);
      note('śaka year', p.samvatsara.shakaYear - Number(day.shakaSamvat.split(' ')[0]));
      note('precision', p.precision === 'full' ? 0 : Infinity);
    }
    const fmt = (a: number[]) => `worst ${Math.max(...a.map(Math.abs)).toFixed(0)} s, mean ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(0)} s, n ${a.length}`;
    console.log(Object.entries(res).map(([k, a]) => `${k}: ${fmt(a)}`).join('; '));
  });

  const within = (kind: string, tol = TOL_S) => {
    const a = res[kind]!;
    expect(a.length).toBeGreaterThan(0);
    expect(Math.max(...a.map(Math.abs)), kind).toBeLessThanOrEqual(tol);
  };

  it('sunrise and sunset within 90 s', () => {
    within('sunrise');
    within('sunset');
  });
  it('tithi ends within 90 s (no ayanāṃśa involved)', () => within('tithi'));
  it('karaṇa names in order, and their ends within 90 s', () => within('karana'));
  it('Rāhu kāla, Yamagaṇḍa, Gulika kāla and abhijit within 90 s', () => {
    for (const k of ['rahu kāla', 'yamagaṇḍa', 'gulika kāla', 'abhijit']) within(k);
  });
  it('nakṣatra ends within 90 s', () => within('nakshatra'));
  /**
   * KNOWN FAILURE, deliberately left (docs/TESTING.md): worst 135 s. Yoga is biased early
   * (mean −71 s) and nakṣatra half as much (mean −25 s), while tithi, which has no
   * ayanāṃśa, is not: Drik's Lahiri is some 15–20″ larger than SE_SIDM_LAHIRI (which
   * matches IAE 1989 to 0.008″). Pending Nilesh's decision.
   */
  it('yoga ends within 90 s', () => within('yoga'));
  it('amānta and pūrṇimānta month, Śaka year, full precision: all agree', () => {
    for (const k of ['month', 'śaka year', 'precision']) expect(res[k]!.every((x) => x === 0), k).toBe(true);
  });
});

describe('structure of a pañcāṅga day', () => {
  const delhi = { latitude: 28.6139, longitude: 77.209 };
  let days: Panchang[];
  beforeAll(() => {
    days = Array.from({ length: 60 }, (_, i) => engine.panchang({ unixMs: Date.parse('2025-01-01T06:30:00Z') + i * 6.1 * 86400e3 }, delhi));
  });

  it('every limb tiles the day: contiguous spans covering sunrise to next sunrise', () => {
    for (const p of days) {
      for (const list of [p.tithis, p.nakshatras, p.yogas, p.karanas] as Array<Array<{ start: Instant; end: Instant }>>) {
        expect(list[0]!.start.jdTT).toBeLessThanOrEqual(p.sunrise.jdTT);
        expect(list[list.length - 1]!.end.jdTT).toBeGreaterThanOrEqual(p.nextSunrise.jdTT);
        for (let i = 1; i < list.length; i++) expect(list[i]!.start.jdTT).toBe(list[i - 1]!.end.jdTT);
      }
      for (const n of p.nakshatras) {
        expect(n.padas[0]!.start.jdTT).toBeCloseTo(n.start.jdTT, 6);
        expect(n.padas[n.padas.length - 1]!.end.jdTT).toBeCloseTo(n.end.jdTT, 6);
      }
    }
  });

  it('each boundary is where its angle crosses the multiple, within ±0.5 s', () => {
    const half = 0.5 / 86400;
    const lon = (g: 'sun' | 'moon', jdTT: number) => engine.position({ jdTT }, g).sidereal.longitude;
    const elong = (t: number) => (lon('moon', t) - lon('sun', t) + 720) % 360;
    const sum = (t: number) => (lon('moon', t) + lon('sun', t)) % 360;
    const check = (f: (t: number) => number, units: number, k: number, t: number) => {
      const b = (k * 360) / units;
      const d = (x: number) => ((f(x) - b + 540) % 360) - 180;
      expect(d(t - half)).toBeLessThan(0);
      expect(d(t + half)).toBeGreaterThan(0);
    };
    for (const p of days.slice(0, 12)) {
      for (const t of p.tithis) check(elong, 30, t.index % 30, t.end.jdTT);
      for (const n of p.nakshatras) check((x) => lon('moon', x), 27, (n.index + 1) % 27, n.end.jdTT);
      for (const y of p.yogas) check(sum, 27, (y.index + 1) % 27, y.end.jdTT);
      for (const k of p.karanas) check(elong, 60, (k.index + 1) % 60, k.end.jdTT);
    }
  });

  it('the vāra is the weekday of sunrise, and its lord rules the first horā and the first eighth', () => {
    for (const p of days) {
      expect(p.vara.index).toBe(new Date(engine.unixMs(p.sunrise) + 5.5 * 3600e3).getUTCDay());
      expect(p.horas[0]!.lord).toBe(p.vara.lord);
      expect(p.dayEighths[0]!.lord).toBe(p.vara.lord);
      expect(p.dayEighths[7]!.lord).toBeNull();
    }
  });

  it('day portions follow BPHS 3.66–69: night from the 5th weekday lord; Gulika = Saturn’s, Yamaghaṇṭaka = Jupiter’s', () => {
    const order = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];
    for (const p of days) {
      expect(p.nightEighths[0]!.lord).toBe(order[(p.vara.index + 4) % 7]);
      expect(p.dayEighths.find((e) => e.lord === 'saturn')!.start.jdUT).toBe(p.gulikaKala.day.start.jdUT);
      expect(p.dayEighths.find((e) => e.lord === 'jupiter')!.start.jdUT).toBe(p.yamaganda.day.start.jdUT);
      expect(p.nightEighths.find((e) => e.lord === 'saturn')!.start.jdUT).toBe(p.gulikaKala.night.start.jdUT);
    }
  });

  it('horā lords descend Saturn → Jupiter → Mars → Sun → Venus → Mercury → Moon (SS 12.78–79), and the next day begins 4th down', () => {
    const order = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'];
    for (const p of days) {
      expect(p.horas).toHaveLength(24);
      for (let i = 1; i < 24; i++) expect(order.indexOf(p.horas[i]!.lord)).toBe((order.indexOf(p.horas[i - 1]!.lord) + 1) % 7);
      // The 25th horā would be the next day's lord: 24 ≡ 3 (mod 7), i.e. the 4th counting inclusively.
      const nextDayLord = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'][(p.vara.index + 1) % 7]!;
      expect(order[(order.indexOf(p.horas[0]!.lord) + 24) % 7]).toBe(nextDayLord);
    }
  });

  it('equal horās span sunrise to sunrise; unequal ones split day and night in twelve', () => {
    const p = days[0]!;
    const u = engine.panchang({ unixMs: Date.parse('2025-01-01T06:30:00Z') }, delhi, { ...DEFAULT_JYOTISH, hora: 'unequal' });
    expect(u.horas[12]!.start.jdUT).toBe(u.sunset.jdUT);
    expect(p.horas[23]!.end.jdUT).toBeCloseTo(p.nextSunrise.jdUT, 10);
  });

  it('muhūrtas are fifteenths of day and night; abhijit, the 8th by day, contains apparent noon', () => {
    for (const p of days) {
      expect(p.muhurtas.day).toHaveLength(15);
      expect(p.muhurtas.night[14]!.end.jdUT).toBeCloseTo(p.nextSunrise.jdUT, 10);
      const mid = (p.sunrise.jdUT + p.sunset.jdUT) / 2;
      expect(p.abhijit.start.jdUT).toBeLessThan(mid);
      expect(p.abhijit.end.jdUT).toBeGreaterThan(mid);
    }
  });
});

describe('calendar rules', () => {
  it('karaṇa names over a month: Kiṃstughna, eight cycles of seven, then the three fixed ones', () => {
    const names = Array.from({ length: 60 }, (_, i) => karanaName(i, 'surya-siddhanta'));
    expect(names[0]).toBe('Kiṃstughna');
    expect(names.slice(1, 8)).toEqual(['Bava', 'Bālava', 'Kaulava', 'Taitila', 'Gara', 'Vaṇij', 'Viṣṭi']);
    expect(names.slice(50, 57)).toEqual(names.slice(1, 8));
    expect(names.slice(57)).toEqual(['Śakuni', 'Nāga', 'Catuṣpada']); // SS 2.67's order
    expect(Array.from({ length: 3 }, (_, i) => karanaName(57 + i, 'pancanga'))).toEqual(['Śakuni', 'Catuṣpada', 'Nāga']);
  });

  it('the default fixed-karaṇa order is the pañcāṅgas’ (decided 2026-10-03)', () => {
    expect(DEFAULT_JYOTISH.karanaOrder).toBe('pancanga');
  });

  it('names amānta months by the saṅkrānti within them; none → adhika, two → kṣaya', () => {
    expect(lunarMonth(11, 0)).toEqual({ index: 0, name: 'Caitra', adhika: false, kshaya: false });
    expect(lunarMonth(11, 11)).toEqual({ index: 0, name: 'Caitra', adhika: true, kshaya: false });
    expect(lunarMonth(7, 9)).toEqual({ index: 8, name: 'Mārgaśīrṣa', adhika: false, kshaya: true, kshayaWith: 'Pauṣa' });
    expect(MONTHS).toHaveLength(12);
  });

  it('finds the adhika Jyeṣṭha of 2026 and the nija month after it', () => {
    const delhi = { latitude: 28.6139, longitude: 77.209 };
    const a = engine.panchang({ unixMs: Date.parse('2026-06-01T06:30:00Z') }, delhi).month.amanta;
    const b = engine.panchang({ unixMs: Date.parse('2026-07-01T06:30:00Z') }, delhi).month.amanta;
    expect(a).toMatchObject({ name: 'Jyeṣṭha', adhika: true });
    expect(b).toMatchObject({ name: 'Jyeṣṭha', adhika: false });
  });

  it('counts the 60-year cycle from Śaka years (2026–27, Śaka 1948, is Parābhava)', () => {
    expect(SAMVATSARAS[samvatsaraIndex(1948)]).toBe('Parābhava');
    expect(SAMVATSARAS[samvatsaraIndex(1909)]).toBe('Prabhava'); // 1987–88
    expect(shakaYear(10, 2027, 2)).toBe(1948); // Māgha 2027 belongs to Śaka 1948
    expect(shakaYear(0, 2026, 3)).toBe(1948);
  });

  it('seasons are two sidereal signs each from Makara (SS 14.10)', () => {
    expect([9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8].map(rituIndex)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('weekday of the local date', () => {
    // 2000-01-01 12:00 UT was a Saturday.
    expect(weekdayAt(2451545.0, 0)).toBe(6);
    // 23:00 UT on Friday 2000-01-07 is already Saturday in India (+82.5°).
    expect(weekdayAt(2451551.4583, 82.5)).toBe(6);
  });
});
