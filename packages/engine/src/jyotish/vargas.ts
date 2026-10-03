/**
 * The sixteen divisional charts (ṣoḍaśavarga) of BPHS 6.
 *
 * A sign is cut into n equal parts (D30: five unequal parts); the part a longitude falls in
 * is mapped to a sign. BPHS 6 gives, for each division, the sign the counting starts from:
 *
 *   D1  the sign itself (6.5)
 *   D2  odd sign: Sun's horā (Siṃha) then Moon's (Karka); even sign: the reverse (6.5–6)
 *   D3  the sign, its 5th, its 9th (6.7–8)
 *   D4  the sign and its kendras: 1st, 4th, 7th, 10th (6.9)
 *   D7  odd: from the sign; even: from its 7th (6.10)
 *   D9  movable: from the sign; fixed: from its 9th; dual: from its 5th (6.12)
 *   D10 odd: from the sign; even: from its 9th (6.13)
 *   D12 from the sign (6.15)
 *   D16 movable from Meṣa, fixed from Siṃha, dual from Dhanus (6.16)
 *   D20 movable from Meṣa, fixed from Dhanus, dual from Siṃha (6.17)
 *   D24 odd from Siṃha, even from Karka (6.22)
 *   D27 from Meṣa, continuing through the movable signs: Meṣa, Karka, Tulā, Makara (6.26)
 *   D30 odd: Mars 5°, Saturn 5°, Jupiter 8°, Mercury 7°, Venus 5°; even: reversed (6.27)
 *   D40 odd from Meṣa, even from Tulā (6.29)
 *   D45 movable from Meṣa, fixed from Siṃha, dual from Dhanus (6.31)
 *   D60 drop the signs, double the degrees, divide by 12; remainder + 1, counted from the
 *       sign itself (6.33)
 *
 * Variants (docs/CANON.md): D2 and D3 "parivṛtti" — BPHS 6.6 and 6.7 also say the horās and
 * drekkāṇas run from Meṣa in two and three cycles — and the sign each D30 lord maps to,
 * which BPHS does not state.
 */
import { addSigns, degreesInSign, isOddSign, modality, signOf, type Planet, type Sign } from './core.ts';

export const VARGAS = [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60] as const;
export type Varga = (typeof VARGAS)[number];

export type HoraScheme = 'parashara' | 'parivritti';
export type DrekkanaScheme = 'parashara' | 'parivritti';
export interface VargaOptions {
  hora: HoraScheme;
  drekkana: DrekkanaScheme;
}
export const DEFAULT_VARGA_OPTIONS: Readonly<VargaOptions> = { hora: 'parashara', drekkana: 'parashara' };

/** D30 parts as [end degree, lord] for odd signs; even signs use them reversed (BPHS 6.27). */
const TRIMSHAMSHA_ODD: ReadonlyArray<readonly [number, Planet]> = [
  [5, 'mars'], [10, 'saturn'], [18, 'jupiter'], [25, 'mercury'], [30, 'venus'],
];
const TRIMSHAMSHA_EVEN: ReadonlyArray<readonly [number, Planet]> = [
  [5, 'venus'], [12, 'mercury'], [20, 'jupiter'], [25, 'saturn'], [30, 'mars'],
];
/**
 * The sign of each D30 lord: in odd signs the lord's odd sign, in even signs its even sign.
 * BPHS 6.27 names only the lords; this mapping is the common convention (docs/CANON.md).
 */
const TRIMSHAMSHA_SIGN: Readonly<Record<'odd' | 'even', Record<Exclude<Planet, 'sun' | 'moon'>, Sign>>> = {
  odd: { mars: 0, saturn: 10, jupiter: 8, mercury: 2, venus: 6 },
  even: { mars: 7, saturn: 9, jupiter: 11, mercury: 5, venus: 1 },
};

export interface VargaPosition {
  varga: Varga;
  /** Sign in the divisional chart. */
  sign: Sign;
  /** Index of the part within the D1 sign, 0-based (D30: 0..4 in the text's order). */
  part: number;
  /** D30 only: the lord of the part. */
  lord?: Planet;
}

/** The part of the sign a longitude falls in, for n equal parts. Computed on the full longitude so sign and part agree at boundaries. */
function equalPart(longitude: number, n: number): { sign: Sign; part: number } {
  const g = Math.floor((longitude * n) / 30); // global part index
  const sign = Math.min(Math.floor(g / n), 11);
  return { sign, part: Math.min(Math.max(g - sign * n, 0), n - 1) };
}

export function vargaSign(longitude: number, varga: Varga, opts: VargaOptions = DEFAULT_VARGA_OPTIONS): VargaPosition {
  if (!(longitude >= 0 && longitude < 360)) throw new RangeError(`longitude must be in [0, 360), got ${longitude}`);
  if (varga === 30) {
    const s = signOf(longitude);
    const deg = degreesInSign(longitude);
    const odd = isOddSign(s);
    const table = odd ? TRIMSHAMSHA_ODD : TRIMSHAMSHA_EVEN;
    const part = table.findIndex(([end]) => deg < end);
    const p = part < 0 ? 4 : part;
    const lord = table[p]![1] as Exclude<Planet, 'sun' | 'moon'>;
    return { varga, sign: TRIMSHAMSHA_SIGN[odd ? 'odd' : 'even'][lord], part: p, lord };
  }
  const { sign: s, part: p } = equalPart(longitude, varga);
  const odd = isOddSign(s);
  const m = modality(s);
  let sign: Sign;
  switch (varga) {
    case 1:
      sign = s;
      break;
    case 2:
      sign = opts.hora === 'parivritti' ? addSigns(2 * s, p) : (odd ? p === 0 : p === 1) ? 4 : 3;
      break;
    case 3:
      sign = opts.drekkana === 'parivritti' ? addSigns(3 * s, p) : addSigns(s, 4 * p);
      break;
    case 4:
      sign = addSigns(s, 3 * p);
      break;
    case 7:
      sign = addSigns(s, (odd ? 0 : 6) + p);
      break;
    case 9:
      sign = addSigns(s, (m === 'movable' ? 0 : m === 'fixed' ? 8 : 4) + p);
      break;
    case 10:
      sign = addSigns(s, (odd ? 0 : 8) + p);
      break;
    case 12:
      sign = addSigns(s, p);
      break;
    case 16:
    case 45:
      sign = addSigns(m === 'movable' ? 0 : m === 'fixed' ? 4 : 8, p);
      break;
    case 20:
      sign = addSigns(m === 'movable' ? 0 : m === 'fixed' ? 8 : 4, p);
      break;
    case 24:
      sign = addSigns(odd ? 4 : 3, p);
      break;
    case 27:
      sign = addSigns(3 * (s % 4), p);
      break;
    case 40:
      sign = addSigns(odd ? 0 : 6, p);
      break;
    case 60:
      // 6.33: "double the degrees, divide by 12, remainder + 1, from that sign".
      sign = addSigns(s, p % 12);
      break;
  }
  return { varga, sign, part: p };
}

/** Every varga of one longitude. */
export function allVargas(longitude: number, opts: VargaOptions = DEFAULT_VARGA_OPTIONS): Record<Varga, VargaPosition> {
  const out = {} as Record<Varga, VargaPosition>;
  for (const v of VARGAS) out[v] = vargaSign(longitude, v, opts);
  return out;
}
