/**
 * Display formatting for the Truth screen. Rounding happens here and only here
 * (CLAUDE.md: never round intermediate values; round only for display).
 *
 * Angles are truncated, not rounded, to the arcsecond, like the clock's seconds: a graha
 * at 29°59′59.7″ shows 29°59′59″ in its sign, never 30°00′00″ in a sign it has not reached.
 */
import { NAKSHATRAS, RASHIS, type AstroEvent, type Graha } from '@aletheia/engine';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Whole arcseconds of an angle, truncated toward zero, with a tiny guard against binary noise. */
function arcsec(deg: number): number {
  return Math.floor(Math.abs(deg) * 3600 + 1e-9);
}

/** "15°32′07″" for |deg|, degrees unpadded. */
export function dms(deg: number): string {
  const s = arcsec(deg);
  return `${Math.floor(s / 3600)}°${pad2(Math.floor((s % 3600) / 60))}′${pad2(s % 60)}″`;
}

/** "+5°10′02″" / "−0°00′41″" for a signed angle such as a latitude. */
export function signedDms(deg: number): string {
  return `${deg < 0 ? '−' : '+'}${dms(deg)}`;
}

/** "195°32′07″": a longitude in [0, 360), degrees padded to three digits. */
export function longitude360(deg: number): string {
  const s = arcsec(deg);
  return `${String(Math.floor(s / 3600)).padStart(3, '0')}°${pad2(Math.floor((s % 3600) / 60))}′${pad2(s % 60)}″`;
}

/** Sign and position within it, from the same truncated arcseconds so they never disagree. */
export function inSign(deg: number): { sign: string; index: number; dms: string } {
  const s = arcsec(deg) % (360 * 3600);
  const index = Math.floor(s / (30 * 3600));
  return { sign: RASHIS[index]!, index, dms: dms((s - index * 30 * 3600) / 3600) };
}

/** Nakshatra name and pada 1..4 of a sidereal longitude (truncated to the arcsecond). */
export function nakshatraOf(deg: number): { name: string; pada: number } {
  const s = arcsec(deg) % (360 * 3600);
  const p = Math.floor(s / (200 * 60)); // a pada is 3°20′ = 12 000″
  return { name: NAKSHATRAS[Math.floor(p / 4)]!, pada: (p % 4) + 1 };
}

export const GRAHA_NAMES: Record<Graha, { sa: string; en: string }> = {
  sun: { sa: 'Sūrya', en: 'Sun' },
  moon: { sa: 'Candra', en: 'Moon' },
  mars: { sa: 'Maṅgala', en: 'Mars' },
  mercury: { sa: 'Budha', en: 'Mercury' },
  jupiter: { sa: 'Guru', en: 'Jupiter' },
  venus: { sa: 'Śukra', en: 'Venus' },
  saturn: { sa: 'Śani', en: 'Saturn' },
  rahu: { sa: 'Rāhu', en: 'Rahu' },
  ketu: { sa: 'Ketu', en: 'Ketu' },
};

/** Traditional order: the weekday lords, then the nodes. */
export const GRAHA_ORDER: readonly Graha[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];

const TITHI_NAMES = [
  'Pratipadā', 'Dvitīyā', 'Tṛtīyā', 'Caturthī', 'Pañcamī', 'Ṣaṣṭhī', 'Saptamī', 'Aṣṭamī',
  'Navamī', 'Daśamī', 'Ekādaśī', 'Dvādaśī', 'Trayodaśī', 'Caturdaśī',
];

/** Tithi 1..30: "Śukla Pañcamī", "Pūrṇimā", "Kṛṣṇa Aṣṭamī", "Amāvāsyā". */
export function tithiName(t: number): string {
  if (t === 15) return 'Pūrṇimā';
  if (t === 30) return 'Amāvāsyā';
  return `${t <= 15 ? 'Śukla' : 'Kṛṣṇa'} ${TITHI_NAMES[(t - 1) % 15]}`;
}

/**
 * One line for the events that share an instant. Events computed from the same boundary
 * crossing have identical times, so a Moon entering Siṃha also enters Maghā pada 1 then;
 * that reads "Candra enters Siṃha · Maghā 1".
 */
export function describeEvents(group: readonly AstroEvent[]): string {
  const parts: string[] = [];
  const ingress = new Map<Graha, { sign?: number; pada?: number; retro: boolean }>();
  let newOrFull = '';
  for (const e of group) {
    switch (e.kind) {
      case 'sign-ingress':
      case 'pada-ingress': {
        const g = ingress.get(e.graha) ?? { retro: e.motion === 'retrograde' };
        if (e.kind === 'sign-ingress') g.sign = e.entered;
        else g.pada = e.entered;
        ingress.set(e.graha, g);
        break;
      }
      case 'sankranti':
        parts.push(`${RASHIS[e.entered]} saṅkrānti`);
        break;
      case 'station':
        parts.push(`${GRAHA_NAMES[e.graha].sa} stations ${e.turns}`);
        break;
      case 'conjunction':
        parts.push(`${GRAHA_NAMES[e.grahas[0]].sa} conjunct ${GRAHA_NAMES[e.grahas[1]].sa}`);
        break;
      case 'new-moon':
        newOrFull = 'New moon';
        break;
      case 'full-moon':
        newOrFull = 'Full moon';
        break;
      case 'tithi':
        parts.push(`${tithiName(e.tithi)} begins`);
        break;
      case 'nakshatra-ingress':
        break; // implied by pada 1 of the new nakṣatra
    }
  }
  const sankranti = group.some((e) => e.kind === 'sankranti');
  for (const [graha, g] of ingress) {
    const what: string[] = [];
    if (g.sign !== undefined && !(graha === 'sun' && sankranti)) what.push(RASHIS[g.sign]!);
    if (g.pada !== undefined) what.push(`${NAKSHATRAS[Math.floor(g.pada / 4)]} ${(g.pada % 4) + 1}`);
    if (what.length) parts.unshift(`${GRAHA_NAMES[graha].sa}${g.retro ? ' ℞' : ''} enters ${what.join(' · ')}`);
  }
  if (newOrFull) parts.unshift(newOrFull);
  return parts.join(' · ');
}

/** Group events that fall on exactly the same instant (same boundary crossing). */
export function groupByInstant<E extends AstroEvent>(events: readonly E[]): E[][] {
  const groups: E[][] = [];
  for (const e of events) {
    const last = groups.at(-1);
    if (last && last[0]!.instant.jdTT === e.instant.jdTT) last.push(e);
    else groups.push([e]);
  }
  return groups;
}

/** Local civil time to the second (truncated): "21:44:05". */
export function clock(unixMs: number): string {
  const d = new Date(Math.floor(unixMs / 1000) * 1000);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** "Sat 3 Oct" in the reader's locale. */
export function shortDate(unixMs: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(unixMs));
}

/** A number with fixed decimals for traces (display only). */
export function fixed(x: number, digits: number): string {
  return x.toFixed(digits);
}
