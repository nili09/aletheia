/**
 * Shared vocabulary of the jyotish rules: signs, lords, weekday order, house counting.
 *
 * Signs are 0..11 from Meṣa (zodiac.ts RASHIS). Houses are counted inclusively, as the
 * texts count them: a sign is the 1st from itself.
 */
import type { Graha } from '../grahas.ts';
import { SIGN_SPAN } from '../zodiac.ts';

export type Sign = number;

/** The seven grahas in weekday order (Sunday first), the order the texts list them in. */
export const SEVEN = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'] as const satisfies readonly Graha[];
export type Planet = (typeof SEVEN)[number];

/** Lord of each sign (BPHS 6.5 kṣetra; the standard ownership). */
export const SIGN_LORD: readonly Planet[] = [
  'mars', 'venus', 'mercury', 'moon', 'sun', 'mercury',
  'venus', 'mars', 'jupiter', 'saturn', 'saturn', 'jupiter',
];

/** Second lords: Ketu of Vṛścika, Rahu of Kumbha (BPHS 46.157). */
export const CO_LORD: Readonly<Partial<Record<Sign, 'ketu' | 'rahu'>>> = { 7: 'ketu', 10: 'rahu' };

/** Sign of a sidereal longitude in [0, 360). */
export function signOf(longitude: number): Sign {
  return Math.min(Math.floor(longitude / SIGN_SPAN), 11);
}

/** Degrees within the sign, [0, 30). */
export function degreesInSign(longitude: number): number {
  return longitude - signOf(longitude) * SIGN_SPAN;
}

/** The sign n signs on from s (n may be negative). */
export function addSigns(s: Sign, n: number): Sign {
  return (((s + n) % 12) + 12) % 12;
}

/** House of `to` counted from `from`, 1..12. */
export function houseFrom(from: Sign, to: Sign): number {
  return addSigns(to, -from) + 1;
}

/** Odd (viṣama) signs are Meṣa, Mithuna, …: even indices. */
export function isOddSign(s: Sign): boolean {
  return s % 2 === 0;
}

/** Cara (movable), sthira (fixed), dvisvabhāva (dual). */
export type Modality = 'movable' | 'fixed' | 'dual';
export function modality(s: Sign): Modality {
  return (['movable', 'fixed', 'dual'] as const)[s % 3]!;
}

/** Normalise an angle to [0, 360). */
export function norm360(x: number): number {
  const y = x % 360;
  return y < 0 ? y + 360 : y === 360 ? 0 : y;
}

/** Arc from a to b going forward, [0, 360). */
export function arc(a: number, b: number): number {
  return norm360(b - a);
}

export function isPlanet(g: Graha): g is Planet {
  return (SEVEN as readonly Graha[]).includes(g);
}
