/**
 * Jaimini topics as BPHS gives them.
 *
 * - Chara kārakas (BPHS 32.1–17): rank by degrees within the sign; Rahu's degrees are
 *   30 − degrees (32.5). Eight with Rahu (default) or seven (32.16: mātṛ = putra).
 * - Ārūḍha padas (BPHS 29.2–5): as far beyond the lord as the lord is from the house; if
 *   that is the house itself, the 10th from it; if its 7th, the 4th from it.
 * - Signs with two lords (Vṛścika: Mars, Ketu; Kumbha: Saturn, Rahu, BPHS 46.157): the
 *   stronger, by the tests of BPHS 46.158–164 (also used for padas, 29.7).
 * - Upapada (BPHS 30.2–3): the pada of the 12th.
 * - Kārakāṃśa (BPHS 33.1): the navāṃśa sign of the ātmakāraka.
 * - Argalā (BPHS 31.3–8): grahas in the 2nd, 4th, 11th and 5th from a sign, obstructed by
 *   those in the 12th, 10th, 3rd and 9th; Rahu and Ketu counted backwards.
 */
import { GRAHAS, type Graha } from '../grahas.ts';
import { addSigns, CO_LORD, degreesInSign, houseFrom, modality, SEVEN, SIGN_LORD, signOf, type Sign } from './core.ts';
import { dignity } from './dignity.ts';
import { vargaSign } from './vargas.ts';
import type { RuleId } from './sources.ts';

// ---------- kārakas ----------

export const KARAKAS_8 = ['atma', 'amatya', 'bhratri', 'matri', 'pitri', 'putra', 'jnati', 'dara'] as const;
/** BPHS 32.16: "others say the mātṛkāraka is the putrakāraka too". */
export const KARAKAS_7 = ['atma', 'amatya', 'bhratri', 'matri-putra', 'pitri', 'jnati', 'dara'] as const;
export type KarakaRole = (typeof KARAKAS_8)[number] | (typeof KARAKAS_7)[number];

export interface Karaka {
  role: KarakaRole;
  graha: Graha;
  /** Degrees counted for the ranking (Rahu: 30 − degrees in sign). */
  degrees: number;
}

export interface Karakas {
  karakas: Karaka[];
  /** Pairs equal to the arcsecond, the resolution of BPHS 32.3; 32.16–17 then use fixed kārakas. Reported, not resolved. */
  ties: Array<[Graha, Graha]>;
  provisional: RuleId[];
}

export function charaKarakas(lon: Readonly<Record<Graha, number>>, count: 7 | 8): Karakas {
  const members: Graha[] = count === 8 ? [...SEVEN, 'rahu'] : [...SEVEN];
  const deg = (g: Graha) => (g === 'rahu' ? 30 - degreesInSign(lon.rahu) : degreesInSign(lon[g]));
  const ranked = members.map((g) => ({ graha: g, degrees: deg(g) })).sort((a, b) => b.degrees - a.degrees);
  const roles = count === 8 ? KARAKAS_8 : KARAKAS_7;
  const ties: Array<[Graha, Graha]> = [];
  for (let i = 1; i < ranked.length; i++) {
    if (Math.floor(ranked[i - 1]!.degrees * 3600) === Math.floor(ranked[i]!.degrees * 3600)) ties.push([ranked[i - 1]!.graha, ranked[i]!.graha]);
  }
  return {
    karakas: ranked.map((r, i) => ({ role: roles[i]!, ...r })),
    ties,
    provisional: count === 7 ? ['karaka-seven'] : [],
  };
}

// ---------- two lords ----------

/** Which graha of each sign with grahas, for counting conjunctions. */
function occupants(lon: Readonly<Record<Graha, number>>): Map<Sign, Graha[]> {
  const m = new Map<Sign, Graha[]>();
  for (const g of GRAHAS) {
    const s = signOf(lon[g]);
    m.set(s, [...(m.get(s) ?? []), g]);
  }
  return m;
}

export interface LordChoice {
  lord: Graha;
  /** Which test decided (BPHS 46.158–164), or 'single' for signs with one lord. */
  by: 'single' | 'both-in-sign' | 'other-in-sign' | 'exalted' | 'more-grahas' | 'sign-nature' | 'more-years' | 'tie';
}

/**
 * The lord to count to for a sign (BPHS 46.157–164). `count(lord)` gives the signs counted
 * from the sign to the lord's sign (0 for the sign itself), used by the last test.
 */
export function chooseLord(sign: Sign, lon: Readonly<Record<Graha, number>>, count: (lordSign: Sign) => number): LordChoice {
  const a = SIGN_LORD[sign]!;
  const b = CO_LORD[sign];
  if (!b) return { lord: a, by: 'single' };
  const sa = signOf(lon[a]);
  const sb = signOf(lon[b]);
  if (sa === sign && sb === sign) return { lord: a, by: 'both-in-sign' };
  if (sa === sign) return { lord: b, by: 'other-in-sign' };
  if (sb === sign) return { lord: a, by: 'other-in-sign' };
  const ea = dignity(a, lon[a]).kind === 'exalted';
  const eb = dignity(b, lon[b]).kind === 'exalted';
  if (ea !== eb) return { lord: ea ? a : b, by: 'exalted' };
  const occ = occupants(lon);
  const na = (occ.get(sa)?.length ?? 1) - 1;
  const nb = (occ.get(sb)?.length ?? 1) - 1;
  if (na !== nb) return { lord: na > nb ? a : b, by: 'more-grahas' };
  const rank = { movable: 0, fixed: 1, dual: 2 } as const;
  const ra = rank[modality(sa)];
  const rb = rank[modality(sb)];
  if (ra !== rb) return { lord: ra > rb ? a : b, by: 'sign-nature' };
  const ca = count(sa);
  const cb = count(sb);
  if (ca !== cb) return { lord: ca > cb ? a : b, by: 'more-years' };
  return { lord: a, by: 'tie' };
}

// ---------- ārūḍha ----------

export interface Arudha {
  /** House 1..12 from the lagna. */
  house: number;
  sign: Sign;
  lord: LordChoice;
  pada: Sign;
  /** Which exception of BPHS 29.4 applied. */
  exception: 'none' | 'own-sign-to-10th' | 'seventh-to-4th';
}

export function arudha(houseSign: Sign, house: number, lon: Readonly<Record<Graha, number>>): Arudha {
  const lord = chooseLord(houseSign, lon, (ls) => houseFrom(houseSign, ls) - 1);
  const ls = signOf(lon[lord.lord]);
  const n = houseFrom(houseSign, ls); // 1..12
  let pada = addSigns(ls, n - 1);
  let exception: Arudha['exception'] = 'none';
  if (pada === houseSign) {
    pada = addSigns(houseSign, 9);
    exception = 'own-sign-to-10th';
  } else if (pada === addSigns(houseSign, 6)) {
    pada = addSigns(houseSign, 3);
    exception = 'seventh-to-4th';
  }
  return { house, sign: houseSign, lord, pada, exception };
}

export function arudhas(lagna: Sign, lon: Readonly<Record<Graha, number>>): Arudha[] {
  return Array.from({ length: 12 }, (_, i) => arudha(addSigns(lagna, i), i + 1, lon));
}

// ---------- argalā ----------

export const ARGALA_PAIRS = [
  { place: 4, obstructor: 10 },
  { place: 2, obstructor: 12 },
  { place: 11, obstructor: 3 },
  { place: 5, obstructor: 9 },
] as const;

export interface ArgalaPair {
  place: 2 | 4 | 5 | 11;
  obstructor: 3 | 9 | 10 | 12;
  argala: Graha[];
  virodha: Graha[];
  /** 'prevails': obstructors fewer (BPHS 31.4); 'equal': same number — the strength test is open. */
  result: 'none' | 'unobstructed' | 'prevails' | 'obstructed' | 'equal';
}

export interface Argala {
  /** The sign whose argalā this is. */
  sign: Sign;
  pairs: ArgalaPair[];
  /** Cruel grahas in the 3rd: BPHS 31.4–5 makes a reverse argalā when they are "in excess" — open. */
  thirdHouseCruel: Graha[];
  provisional: RuleId[];
}

/** House of graha g from the reference sign; Rahu and Ketu are counted backwards (BPHS 31.6). */
export function argalaHouse(ref: Sign, g: Graha, s: Sign): number {
  return g === 'rahu' || g === 'ketu' ? houseFrom(s, ref) : houseFrom(ref, s);
}

export function argala(ref: Sign, lon: Readonly<Record<Graha, number>>, cruel: Readonly<Record<Graha, boolean>>): Argala {
  const at = (h: number) => GRAHAS.filter((g) => argalaHouse(ref, g, signOf(lon[g])) === h);
  const pairs = ARGALA_PAIRS.map(({ place, obstructor }) => {
    const a = at(place);
    const v = at(obstructor);
    const result: ArgalaPair['result'] = !a.length ? 'none' : !v.length ? 'unobstructed' : a.length > v.length ? 'prevails' : a.length < v.length ? 'obstructed' : 'equal';
    return { place, obstructor, argala: a, virodha: v, result };
  });
  return { sign: ref, pairs, thirdHouseCruel: at(3).filter((g) => cruel[g]), provisional: ['argala', 'benefic-malefic'] };
}

// ---------- the rest ----------

export interface Jaimini {
  karakas: Karakas;
  arudhas: Arudha[];
  /** Ārūḍha lagna (pada of the 1st) and upapada (pada of the 12th). */
  arudhaLagna: Sign;
  upapada: Sign;
  karakamsha: Sign;
  provisional: RuleId[];
}

export function jaimini(lagna: Sign, lon: Readonly<Record<Graha, number>>, count: 7 | 8): Jaimini {
  const karakas = charaKarakas(lon, count);
  const as = arudhas(lagna, lon);
  const ak = karakas.karakas[0]!.graha;
  const usesTwoLords = as.some((a) => a.lord.by !== 'single');
  return {
    karakas,
    arudhas: as,
    arudhaLagna: as[0]!.pada,
    upapada: as[11]!.pada,
    karakamsha: vargaSign(lon[ak], 9).sign,
    provisional: [...karakas.provisional, 'upapada', ...(usesTwoLords ? (['two-lords'] as const) : [])],
  };
}
