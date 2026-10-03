/**
 * Words for birth inputs. Display only: durations are truncated toward zero (a lagna that
 * holds 22 min 50 s "holds 22 min"), never rounded up.
 */
import { NAKSHATRAS, RASHIS, vargaSign, DEFAULT_JYOTISH, type Hold, type Sensitivity } from '@aletheia/engine';
import type { LocalTime } from '@aletheia/birth';

const pad2 = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "40 s", "22 min", "5 h 12 min": a duration, truncated. */
export function span(seconds: number): string {
  const s = Math.floor(Math.abs(seconds));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  const m = Math.floor((s % 3600) / 60);
  return `${Math.floor(s / 3600)} h${m ? ` ${m} min` : ''}`;
}

/** "−22 / +47 min", "±1 min", "−40 s / +3 min", "beyond 1.5 days" for a side not found. */
export function holdText(h: Hold): string {
  if (!h.earlier || !h.later) return `${h.earlier ? `−${span(h.earlier.seconds)}` : '—'} / ${h.later ? `+${span(h.later.seconds)}` : '—'}`;
  const a = span(h.earlier.seconds);
  const b = span(h.later.seconds);
  if (a === b) return `±${a}`;
  const unit = (x: string) => /^\d+ (min|s)$/.exec(x)?.[1];
  if (unit(a) && unit(a) === unit(b)) return `−${a.split(' ')[0]} / +${b}`;
  return `−${a} / +${b}`;
}

export const QUANTITY_NAMES: Record<Hold['quantity'], string> = {
  lagna: 'Lagna',
  'navamsa-lagna': 'Navāṃśa lagna',
  'd60-lagna': 'D60',
  'moon-nakshatra': 'Moon’s nakṣatra',
};

/** "Lagna holds −22 / +47 min · Navāṃśa lagna −3 / +6 min · D60 ±1 min · Moon’s nakṣatra −5 h / +14 h 3 min". */
export function sensitivityLine(s: Sensitivity): string {
  return s.holds.map((h, i) => `${QUANTITY_NAMES[h.quantity]}${i === 0 ? ' holds' : ''} ${holdText(h)}`).join(' · ');
}

/** The name of a hold's value: a sign for the lagnas, a nakṣatra for the Moon. */
export function valueName(h: Pick<Hold, 'quantity'>, value: number): string {
  return h.quantity === 'moon-nakshatra' ? NAKSHATRAS[value]! : RASHIS[value]!;
}

export interface BirthPoint {
  ascendant: number;
  moon: number;
}

/** What a birth time decides first, by name. */
export function pointNames(p: BirthPoint): { lagna: string; navamsa: string; nakshatra: string } {
  return {
    lagna: RASHIS[vargaSign(p.ascendant, 1, DEFAULT_JYOTISH.vargas).sign]!,
    navamsa: RASHIS[vargaSign(p.ascendant, 9, DEFAULT_JYOTISH.vargas).sign]!,
    nakshatra: NAKSHATRAS[Math.floor(p.moon / (40 / 3))]!,
  };
}

/** "39 minutes", "23 min 20 s", "1 hour", "1 h 39 min": an exact difference in time. */
export function apart(seconds: number): string {
  const s = Math.abs(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round((s % 60) * 10) / 10;
  if (!h && !sec) return `${m} minute${m === 1 ? '' : 's'}`;
  if (!m && !sec) return `${h} hour${h === 1 ? '' : 's'}`;
  return [h && `${h} h`, m && `${m} min`, sec && `${sec} s`].filter(Boolean).join(' ');
}

/** "39 minutes apart; lagna moves from Siṃha to Karka" (what changes between two readings). */
export function compareText(a: BirthPoint & { unixMs: number }, b: BirthPoint & { unixMs: number }): string {
  const x = pointNames(a);
  const y = pointNames(b);
  const changes: string[] = [];
  if (x.lagna !== y.lagna) changes.push(`lagna moves from ${x.lagna} to ${y.lagna}`);
  if (x.navamsa !== y.navamsa) changes.push(`navāṃśa lagna from ${x.navamsa} to ${y.navamsa}`);
  if (x.nakshatra !== y.nakshatra) changes.push(`the Moon’s nakṣatra from ${x.nakshatra} to ${y.nakshatra}`);
  const head = `${apart((b.unixMs - a.unixMs) / 1000)} apart`;
  return changes.length ? `${head}; ${changes.join('; ')}` : `${head}; lagna, navāṃśa lagna and the Moon’s nakṣatra stay the same`;
}

/** "12 May 1934, 10:15" (seconds when given). */
export function localText(l: LocalTime): string {
  return `${l.day} ${MONTHS[l.month - 1]} ${l.year}, ${pad2(l.hour)}:${pad2(l.minute)}${l.second ? `:${pad2(Math.floor(l.second))}` : ''}`;
}

/** "1934-05-12 04:45:00 UTC" (truncated to the second). */
export function utcText(unixMs: number): string {
  return new Date(Math.floor(unixMs / 1000) * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}
