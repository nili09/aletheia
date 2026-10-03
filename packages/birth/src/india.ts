/**
 * India's clocks, 1800 onwards: which clocks a birth time written in India could have been
 * read from. The IANA tzdb has one zone for all India (Asia/Kolkata) and says itself that it
 * follows railway time and that its 1941–45 data rest on one "dubious" source; it has no
 * Bombay Time or Calcutta Time. So for India this module replaces the tzdb.
 *
 * Every period, offset and end date below is recorded with its sources in docs/CANON.md
 * ("Birth time: India's clocks"). Where the sources disagree, both readings are offered and
 * the person entering the birth chooses; nothing is decided silently.
 *
 * Boundaries are compared with the wall-clock reading itself. Near a boundary the clocks of
 * both sides are offered (within a day), since the reading's own clock decides the instant.
 */
import { haversineKm } from './places.ts';
import { localSeconds, type LocalTime } from './zones.ts';

export type ClockId = 'lmt' | 'madras' | 'ist' | 'ist-war' | 'tzdb-1941' | 'calcutta' | 'bengal-war' | 'bombay';

export interface Clock {
  id: ClockId;
  name: string;
  /** Seconds east of UTC; for local mean time, longitude × 240 s (not rounded). */
  offsetSeconds: number;
  /** One line: what the clock was and who kept it. */
  note: string;
  /** Source ids (SOURCES). */
  sources: readonly SourceId[];
}

export const SOURCES = {
  iyb1947: 'The Indian Year Book, vol. XXXIII (1947), ed. Sir Stanley Reed, Bennett Coleman, “Standard Time”, pp. 24–25 (archive.org in.ernet.dli.2015.61534, scan n65)',
  iyb1942: 'The Indian Year Book 1942–43, vol. XXIX, “Standard Time” (archive.org in.ernet.dli.2015.109405)',
  tzdb: 'IANA tzdb, file “asia”, zone Asia/Kolkata and its India notes (Eggert; Shanks & Pottenger; Prasad, Tracks of Change, CUP 2016, p. 145; Indian Year Book 1936–37 pp. 27–28)',
  das: 'Debashish Das, “Introduction of the Indian Standard Time: a historical survey”, as reported in ThePrint (“The IST story”): Calcutta and West Bengal on IST from midnight 31 Aug/1 Sep 1947; Bombay municipal clocks advanced 39½ minutes on Tuesday evening, 14 March 1950 (The Times of India)',
  wikipedia: 'Wikipedia, “Calcutta Time” (until 1948) and “Bombay Time” (until 1955), unsourced end years',
  lmt: 'Definition: mean solar time at the place, 4 minutes of time per degree of longitude east of Greenwich',
} as const;
export type SourceId = keyof typeof SOURCES;

const H = 3600;
const IST = 5.5 * H;
const WAR = 6.5 * H;

/** Bombay Time: 39 minutes behind Indian Standard Time (Indian Year Book 1947). */
export const BOMBAY_OFFSET = IST - 39 * 60;
/** Calcutta Time: 5 h 53 min 20 s (tzdb, after Shanks; the Calcutta observatory's 88°20′ E). */
export const CALCUTTA_OFFSET = 5 * H + 53 * 60 + 20;
/** Madras railway time: 5 h 21 min 10 s (tzdb, from the Indian Year Book 1936–37). */
export const MADRAS_OFFSET = 5 * H + 21 * 60 + 10;

/** Wall-clock instants of the boundaries (the reading's own scale). */
const at = (y: number, m: number, d: number, h = 0) => localSeconds({ year: y, month: m, day: d, hour: h, minute: 0, second: 0 });
export const BOUNDARIES = {
  railwayMadras: at(1870, 1, 1),
  cityTimes: at(1884, 1, 1),
  ist: at(1906, 1, 1),
  bengalWar: at(1941, 10, 1),
  tzdbBreak: at(1942, 5, 15),
  istWar: at(1942, 9, 1),
  warEnd: at(1945, 10, 15, 2),
  calcuttaEnd: at(1947, 9, 1),
  calcuttaLatest: at(1949, 1, 1),
  bombayEnd: at(1950, 3, 15),
  bombayLatest: at(1956, 1, 1),
} as const;

export type IndianRegion = 'bombay' | 'calcutta' | 'other';

/** Mumbai's GeoNames point (id 1275339). */
const MUMBAI = { latitude: 19.07283, longitude: 72.88261 };
const BOMBAY_RADIUS_KM = 25;

/**
 * Where Bombay Time and Calcutta Time are offered (awaiting Nilesh, docs/CANON.md): Bombay
 * Time in the Mumbai and Mumbai Suburban districts, or within 25 km of Mumbai where the
 * district is not recorded (GeoNames gives the city itself none); Calcutta and Bengal time
 * in West Bengal. Codes are GeoNames admin codes.
 */
export function indianRegion(admin1: string | undefined, admin2: string | undefined, latitude: number, longitude: number): IndianRegion {
  if (admin1 === '28') return 'calcutta';
  if (admin1 === '16' && (admin2 === '519' || admin2 === '518')) return 'bombay';
  if (admin1 === '16' && !admin2 && haversineKm(latitude, longitude, MUMBAI.latitude, MUMBAI.longitude) <= BOMBAY_RADIUS_KM) return 'bombay';
  return 'other';
}

function clock(id: ClockId, longitude: number): Clock {
  switch (id) {
    case 'lmt':
      return { id, name: 'Local mean time', offsetSeconds: longitude * 240, note: 'The mean solar time of the birthplace, the usual civil time before standard time.', sources: ['lmt', 'tzdb'] };
    case 'madras':
      return { id, name: 'Madras time (railway)', offsetSeconds: MADRAS_OFFSET, note: 'Railway and telegraph time across India from 1870 until 1906.', sources: ['tzdb'] };
    case 'ist':
      return { id, name: 'Indian Standard Time', offsetSeconds: IST, note: 'UTC+5:30, railways and telegraphs from 1 January 1906.', sources: ['iyb1947'] };
    case 'ist-war':
      return { id, name: 'War time (IST + 1 h)', offsetSeconds: WAR, note: 'Indian Standard Time advanced one hour, 1 September 1942 to 2 a.m. 15 October 1945.', sources: ['iyb1947'] };
    case 'tzdb-1941':
      return { id, name: 'UTC+6:30 (tzdb)', offsetSeconds: WAR, note: 'The tzdb puts all India an hour ahead from October 1941 to 15 May 1942, on Shanks’s authority, which it calls dubious; the Indian Year Book names only Bengal.', sources: ['tzdb'] };
    case 'calcutta':
      return { id, name: 'Calcutta Time', offsetSeconds: CALCUTTA_OFFSET, note: 'Calcutta kept its own time after 1906 (about 24 minutes ahead of IST).', sources: ['iyb1942', 'tzdb', 'das', 'wikipedia'] };
    case 'bengal-war':
      return { id, name: 'Bengal war time', offsetSeconds: WAR, note: 'Bengal moved its clocks forward 36 minutes on 1 October 1941, an hour ahead of IST.', sources: ['iyb1947'] };
    case 'bombay':
      return { id, name: 'Bombay Time', offsetSeconds: BOMBAY_OFFSET, note: 'Kept by Bombay’s municipal clocks, 39 minutes behind IST.', sources: ['iyb1947', 'das', 'wikipedia'] };
  }
}

export interface IndianClocks {
  /** More than one clock is possible: the person entering the birth must choose. */
  ambiguous: boolean;
  /** In the order the sources make likely; the first is the commonest clock of the place and time. */
  clocks: Clock[];
  /** Why these clocks, in a sentence. */
  why: string;
}

/** The clocks a birth time read at this place and wall-clock time could have come from. */
export function indianClocks(local: LocalTime, longitude: number, region: IndianRegion): IndianClocks {
  const L = localSeconds(local);
  const B = BOUNDARIES;
  const ids: ClockId[] = [];
  const why: string[] = [];
  const add = (...c: ClockId[]) => c.forEach((x) => ids.includes(x) || ids.push(x));
  // Within a day of a boundary, offer both sides (the clocks differ by at most 1 h 39 min).
  const DAY = 86400;
  const during = (from: number, to: number) => L >= from - DAY && L < to + DAY;

  if (during(-Infinity, B.ist)) {
    add('lmt');
    if (during(B.railwayMadras, B.ist)) {
      add('madras');
      why.push('Before 1906 civil time was local, while railways and telegraphs kept Madras time.');
    } else why.push('Before 1870 India kept local mean time.');
    if (during(B.cityTimes, B.ist) && region === 'bombay') add('bombay');
    if (during(B.cityTimes, B.ist) && region === 'calcutta') add('calcutta');
  }
  if (during(B.ist, B.bengalWar)) {
    if (region === 'calcutta') {
      add('calcutta', 'ist');
      why.push('Calcutta kept Calcutta Time after 1906; railways kept IST.');
    } else if (region === 'bombay') {
      add('ist', 'bombay');
      why.push('Bombay’s municipal clocks kept Bombay Time; elsewhere IST was universal.');
    } else add('ist');
  }
  if (during(B.bengalWar, B.istWar)) {
    if (region === 'calcutta') {
      add('bengal-war', 'ist');
      why.push('Bengal’s clocks were an hour ahead of IST from 1 October 1941.');
    } else {
      add('ist');
      if (region === 'bombay') add('bombay');
      if (during(B.bengalWar, B.tzdbBreak)) {
        add('tzdb-1941');
        why.push('The tzdb has all India an hour ahead until 15 May 1942; the Indian Year Book names only Bengal.');
      }
    }
  }
  if (during(B.istWar, B.warEnd)) {
    add('ist-war', 'ist');
    if (region === 'bombay') add('bombay');
    why.push('War time ran an hour ahead of IST until 2 a.m. on 15 October 1945; a time may have been written in standard time.');
  }
  if (during(B.warEnd, B.calcuttaLatest) && region === 'calcutta') {
    if (L < B.calcuttaEnd + DAY) add('calcutta', 'ist');
    else add('ist', 'calcutta');
    why.push('Calcutta Time ended on 1 September 1947 (Das); some accounts say 1948.');
  }
  if (during(B.warEnd, B.bombayLatest) && region === 'bombay') {
    add('ist', 'bombay');
    why.push('Bombay’s municipal clocks kept Bombay Time until the evening of 14 March 1950 (Das); some accounts say 1955.');
  }
  if (!ids.length) add('ist');
  return { ambiguous: ids.length > 1, clocks: ids.map((id) => clock(id, longitude)), why: why.join(' ') };
}
