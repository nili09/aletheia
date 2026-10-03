/**
 * Dignities and friendships of the grahas (BPHS 3.49–58; nodes BPHS 47.35–36).
 *
 * - Exaltation (BPHS 3.49–50): Sun Meṣa 10°, Moon Vṛṣabha 3°, Mars Makara 28°, Mercury
 *   Kanyā 15°, Jupiter Karka 5°, Venus Mīna 27°, Saturn Tulā 20°. The whole sign is the
 *   exaltation sign; the degree is the deepest point. The 7th sign is the debilitation,
 *   deepest at the same degree.
 * - Mūlatrikoṇa (BPHS 3.51–54), the rest of the sign being own sign: Sun Siṃha 0–20°;
 *   Moon Vṛṣabha after its exaltation 0–3°; Mars Meṣa 0–12°; Mercury Kanyā 15–20°, after
 *   its exaltation 0–15° and before own sign 20–30°; Jupiter Dhanus 0–10°; Venus Tulā
 *   0–15°; Saturn Kumbha 0–20°.
 * - Natural friendship (BPHS 3.55): counted from a graha's mūlatrikoṇa sign, the lords of
 *   the 2nd, 4th, 5th, 8th, 9th and 12th, and of its exaltation sign, are friends; lords of
 *   the other signs are enemies; a graha that is both is neutral. Derived here from that
 *   rule, not from a table; test/dignity.test.ts checks the result against the table of
 *   Bṛhajjātaka 2.16–17.
 * - Temporal friendship (BPHS 3.56): grahas in the 2nd, 3rd, 4th, 10th, 11th or 12th from
 *   each other are temporary friends, otherwise enemies.
 * - Compound (BPHS 3.57–58): friend + friend = great friend, friend + enemy = neutral, …
 * - Rahu and Ketu (BPHS 47.35–36): exalted in Vṛṣabha and Vṛścika, mūlatrikoṇa Mithuna and
 *   Dhanus, own Kumbha and Vṛścika (some: Kanyā and Mīna). No degrees are given, so these
 *   are whole-sign dignities. The texts give the nodes no friendships.
 */
import type { Graha } from '../grahas.ts';
import { addSigns, degreesInSign, houseFrom, SEVEN, SIGN_LORD, signOf, type Planet, type Sign } from './core.ts';

export const EXALTATION: Readonly<Record<Graha, { sign: Sign; degree: number | null }>> = {
  sun: { sign: 0, degree: 10 },
  moon: { sign: 1, degree: 3 },
  mars: { sign: 9, degree: 28 },
  mercury: { sign: 5, degree: 15 },
  jupiter: { sign: 3, degree: 5 },
  venus: { sign: 11, degree: 27 },
  saturn: { sign: 6, degree: 20 },
  rahu: { sign: 1, degree: null },
  ketu: { sign: 7, degree: null },
};

/** Mūlatrikoṇa sign and its degree range [from, to). */
export const MOOLATRIKONA: Readonly<Record<Graha, { sign: Sign; from: number; to: number }>> = {
  sun: { sign: 4, from: 0, to: 20 },
  moon: { sign: 1, from: 3, to: 30 },
  mars: { sign: 0, from: 0, to: 12 },
  mercury: { sign: 5, from: 15, to: 20 },
  jupiter: { sign: 8, from: 0, to: 10 },
  venus: { sign: 6, from: 0, to: 15 },
  saturn: { sign: 10, from: 0, to: 20 },
  rahu: { sign: 2, from: 0, to: 30 },
  ketu: { sign: 8, from: 0, to: 30 },
};

/** Own signs. Nodes: BPHS 47.36, first reading (Kumbha, Vṛścika). */
export const OWN_SIGNS: Readonly<Record<Graha, readonly Sign[]>> = {
  sun: [4],
  moon: [3],
  mars: [0, 7],
  mercury: [2, 5],
  jupiter: [8, 11],
  venus: [1, 6],
  saturn: [9, 10],
  rahu: [10],
  ketu: [7],
};

/** Deepest debilitation, sidereal degrees (7 grahas). */
export function debilitationPoint(g: Planet): number {
  const e = EXALTATION[g];
  return addSigns(e.sign, 6) * 30 + e.degree!;
}

export type Relation = 'friend' | 'neutral' | 'enemy';
export type Compound = 'great-friend' | 'friend' | 'neutral' | 'enemy' | 'great-enemy';

/** Natural relation of a towards b (BPHS 3.55), derived from the rule. */
export function naturalRelation(a: Planet, b: Planet): Relation {
  if (a === b) throw new RangeError('a graha has no relation to itself');
  const m = MOOLATRIKONA[a].sign;
  const friendSigns = new Set([1, 3, 4, 7, 8, 11].map((n) => addSigns(m, n)));
  friendSigns.add(EXALTATION[a].sign);
  const owned = OWN_SIGNS[b];
  const f = owned.some((s) => friendSigns.has(s));
  const e = owned.some((s) => !friendSigns.has(s));
  return f && e ? 'neutral' : f ? 'friend' : 'enemy';
}

/** Temporal relation (BPHS 3.56): b in the 2nd, 3rd, 4th, 10th, 11th or 12th from a. */
export function temporalRelation(aSign: Sign, bSign: Sign): 'friend' | 'enemy' {
  return [2, 3, 4, 10, 11, 12].includes(houseFrom(aSign, bSign)) ? 'friend' : 'enemy';
}

/** Compound relation (BPHS 3.57–58). */
export function compoundRelation(natural: Relation, temporal: 'friend' | 'enemy'): Compound {
  if (temporal === 'friend') return natural === 'friend' ? 'great-friend' : natural === 'neutral' ? 'friend' : 'neutral';
  return natural === 'friend' ? 'neutral' : natural === 'neutral' ? 'enemy' : 'great-enemy';
}

export type DignityKind = 'exalted' | 'moolatrikona' | 'own' | 'debilitated' | 'great-friend' | 'friend' | 'neutral' | 'enemy' | 'great-enemy';

export interface Dignity {
  graha: Graha;
  sign: Sign;
  /** Exalted, mūlatrikoṇa, own or debilitated; otherwise the relation to the sign lord. */
  kind: DignityKind | null;
  /** The relation to the sign's lord, natural or (with positions given) compound. Null for the nodes and in own sign. */
  lordRelation: Compound | Relation | null;
  /** Arc from the deepest debilitation point, [0, 180], degrees (7 grahas). */
  fromDebilitation: number | null;
}

/**
 * Dignity of a graha at a sidereal longitude. With `signs` (the D1 sign of every planet),
 * the relation to the sign lord is the compound relation; otherwise the natural one.
 */
export function dignity(graha: Graha, longitude: number, signs?: Readonly<Record<Planet, Sign>>): Dignity {
  const sign = signOf(longitude);
  const deg = degreesInSign(longitude);
  const e = EXALTATION[graha];
  const mt = MOOLATRIKONA[graha];
  let kind: DignityKind | null = null;
  if (sign === e.sign) {
    // Moon and Mercury share their exaltation sign with mūlatrikoṇa (and Mercury with own sign).
    if (graha === 'moon') kind = deg < 3 ? 'exalted' : 'moolatrikona';
    else if (graha === 'mercury') kind = deg < 15 ? 'exalted' : deg < 20 ? 'moolatrikona' : 'own';
    else kind = 'exalted';
  } else if (sign === addSigns(e.sign, 6)) kind = 'debilitated';
  else if (sign === mt.sign && deg >= mt.from && deg < mt.to) kind = 'moolatrikona';
  else if (OWN_SIGNS[graha].includes(sign)) kind = 'own';

  let lordRelation: Compound | Relation | null = null;
  const lord = SIGN_LORD[sign]!;
  if (graha !== 'rahu' && graha !== 'ketu' && lord !== graha) {
    const natural = naturalRelation(graha, lord);
    lordRelation = signs ? compoundRelation(natural, temporalRelation(signs[graha], signs[lord])) : natural;
    kind ??= lordRelation;
  }
  let fromDebilitation: number | null = null;
  if (graha !== 'rahu' && graha !== 'ketu') {
    const d = (((longitude - debilitationPoint(graha)) % 360) + 360) % 360;
    fromDebilitation = d > 180 ? 360 - d : d;
  }
  return { graha, sign, kind, lordRelation, fromDebilitation };
}

/** Natural relations of every planet to every other, for display. */
export function naturalRelations(): Record<Planet, Partial<Record<Planet, Relation>>> {
  const out = {} as Record<Planet, Partial<Record<Planet, Relation>>>;
  for (const a of SEVEN) {
    out[a] = {};
    for (const b of SEVEN) if (a !== b) out[a][b] = naturalRelation(a, b);
  }
  return out;
}
