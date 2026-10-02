/**
 * Divisions of the sidereal zodiac used by the event finder and the UI.
 * Names are given in IAST transliteration.
 */

/** 12 rāśis of 30°. */
export const RASHIS = [
  'Meṣa', 'Vṛṣabha', 'Mithuna', 'Karka', 'Siṃha', 'Kanyā',
  'Tulā', 'Vṛścika', 'Dhanus', 'Makara', 'Kumbha', 'Mīna',
] as const;

/** 27 nakṣatras of 13°20′, from 0° sidereal. */
export const NAKSHATRAS = [
  'Aśvinī', 'Bharaṇī', 'Kṛttikā', 'Rohiṇī', 'Mṛgaśīrṣa', 'Ārdrā', 'Punarvasu', 'Puṣya', 'Āśleṣā',
  'Maghā', 'Pūrva Phalgunī', 'Uttara Phalgunī', 'Hasta', 'Citrā', 'Svātī', 'Viśākhā', 'Anurādhā', 'Jyeṣṭhā',
  'Mūla', 'Pūrva Āṣāḍhā', 'Uttara Āṣāḍhā', 'Śravaṇa', 'Dhaniṣṭhā', 'Śatabhiṣaj', 'Pūrva Bhādrapadā', 'Uttara Bhādrapadā', 'Revatī',
] as const;

export const SIGN_SPAN = 30;
export const NAKSHATRA_SPAN = 40 / 3; // 13°20′
export const PADA_SPAN = 10 / 3; // 3°20′
export const PADAS = 108;

/** Index of the pada boundary p (0..107) in degrees, computed exactly where it can be. */
export function padaBoundary(p: number): number {
  return (p * 10) / 3;
}

export function signIndex(longitude: number): number {
  return Math.floor(longitude / SIGN_SPAN);
}

/**
 * Nakshatra (0..26) and pada (0..3) of a sidereal longitude. Computed on integer multiples
 * of 1/3 degree so boundaries such as 120° fall exactly where they should.
 */
export function nakshatraPada(longitude: number): { nakshatra: number; pada: number } {
  const p = Math.floor((longitude * 3) / 10); // pada index 0..107
  const q = Math.min(Math.max(p, 0), PADAS - 1);
  return { nakshatra: Math.floor(q / 4), pada: q % 4 };
}
