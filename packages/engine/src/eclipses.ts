/**
 * Solar and lunar eclipses, searched globally (anywhere on Earth): type, contact times and
 * greatest eclipse. Times come back from the library in UT; each is returned as an Instant
 * with both UT and TT, and test/eclipses.test.ts compares the TT of greatest eclipse with
 * NASA's catalogue.
 */
import {
  SE_ECL_ALLTYPES_LUNAR,
  SE_ECL_ALLTYPES_SOLAR,
  SE_ECL_ANNULAR,
  SE_ECL_ANNULAR_TOTAL,
  SE_ECL_CENTRAL,
  SE_ECL_NONCENTRAL,
  SE_ECL_PARTIAL,
  SE_ECL_PENUMBRAL,
  SE_ECL_TOTAL,
} from './swe/constants.ts';
import { ephemerisFlag, type SwissEph } from './swe/swisseph.ts';
import { instantFromJdUT, type Instant } from './time.ts';

export type SolarEclipseType = 'total' | 'annular' | 'hybrid' | 'partial';
export type LunarEclipseType = 'total' | 'partial' | 'penumbral';

export interface SolarEclipse {
  kind: 'solar';
  type: SolarEclipseType;
  /** Whether the shadow axis touches Earth (null for partial eclipses). */
  central: boolean | null;
  greatest: Instant;
  /** Contacts on Earth as a whole; null when the eclipse type has no such phase. */
  contacts: {
    partialBegin: Instant | null;
    partialEnd: Instant | null;
    centralBegin: Instant | null;
    centralEnd: Instant | null;
    /** Umbra (total) or antumbra (annular) first and last touch Earth. */
    umbralBegin: Instant | null;
    umbralEnd: Instant | null;
  };
  /** Where the eclipse is greatest (on the central line for central eclipses). */
  greatestAt: { latitude: number; longitude: number };
  /** Fraction of the solar diameter covered, at greatest eclipse there. */
  magnitude: number;
}

export interface LunarEclipse {
  kind: 'lunar';
  type: LunarEclipseType;
  greatest: Instant;
  contacts: {
    penumbralBegin: Instant | null;
    partialBegin: Instant | null;
    totalityBegin: Instant | null;
    totalityEnd: Instant | null;
    partialEnd: Instant | null;
    penumbralEnd: Instant | null;
  };
  umbralMagnitude: number;
  penumbralMagnitude: number;
}

function solarType(bits: number): SolarEclipseType {
  if (bits & SE_ECL_ANNULAR_TOTAL) return 'hybrid';
  if (bits & SE_ECL_TOTAL) return 'total';
  if (bits & SE_ECL_ANNULAR) return 'annular';
  if (bits & SE_ECL_PARTIAL) return 'partial';
  throw new Error(`unrecognised solar eclipse type bits ${bits}`);
}

function lunarType(bits: number): LunarEclipseType {
  if (bits & SE_ECL_TOTAL) return 'total';
  if (bits & SE_ECL_PARTIAL) return 'partial';
  if (bits & SE_ECL_PENUMBRAL) return 'penumbral';
  throw new Error(`unrecognised lunar eclipse type bits ${bits}`);
}

export function nextSolarEclipse(swe: SwissEph, from: Instant, backward = false): SolarEclipse {
  const f = ephemerisFlag(from.ephemeris);
  const { type: bits, tret } = swe.solEclipseWhenGlob(from.jdUT, f, SE_ECL_ALLTYPES_SOLAR, backward);
  const at = (i: number) => (tret[i] ? instantFromJdUT(swe, tret[i]!) : null);
  const greatest = instantFromJdUT(swe, tret[0]!);
  const where = swe.solEclipseWhere(tret[0]!, f);
  const type = solarType(bits);
  return {
    kind: 'solar',
    type,
    central: type === 'partial' ? null : (bits & SE_ECL_CENTRAL) !== 0 && (bits & SE_ECL_NONCENTRAL) === 0,
    greatest,
    contacts: {
      partialBegin: at(2),
      partialEnd: at(3),
      umbralBegin: at(4),
      umbralEnd: at(5),
      centralBegin: at(6),
      centralEnd: at(7),
    },
    greatestAt: { longitude: where.geopos[0]!, latitude: where.geopos[1]! },
    magnitude: where.attr[0]!,
  };
}

export function nextLunarEclipse(swe: SwissEph, from: Instant, backward = false): LunarEclipse {
  const f = ephemerisFlag(from.ephemeris);
  const { type: bits, tret } = swe.lunEclipseWhen(from.jdUT, f, SE_ECL_ALLTYPES_LUNAR, backward);
  const at = (i: number) => (tret[i] ? instantFromJdUT(swe, tret[i]!) : null);
  const how = swe.lunEclipseHow(tret[0]!, f);
  return {
    kind: 'lunar',
    type: lunarType(bits),
    greatest: instantFromJdUT(swe, tret[0]!),
    contacts: {
      penumbralBegin: at(6),
      partialBegin: at(2),
      totalityBegin: at(4),
      totalityEnd: at(5),
      partialEnd: at(3),
      penumbralEnd: at(7),
    },
    umbralMagnitude: how.attr[0]!,
    penumbralMagnitude: how.attr[1]!,
  };
}
