/**
 * Fixed stars from the Swiss Ephemeris catalogue (sefstars.txt, SIMBAD/Hipparcos data with
 * proper motion, parallax and radial velocity), and the nakṣatra junction stars (yogatārās).
 *
 * Stars are looked up the way the library does it: by traditional name ("Spica") or, with a
 * leading comma, by Bayer/Flamsteed designation (",alVir").
 */
import { SEFLG_SIDEREAL, SEFLG_SPEED } from './swe/constants.ts';
import { ephemerisFlag, type SwissEph } from './swe/swisseph.ts';
import type { Instant } from './time.ts';
import type { Coordinates } from './grahas.ts';
import type { Precision } from './precision.ts';

export interface FixedStar {
  /** The catalogue's own name, "traditional,designation", e.g. "Spica,alVir". */
  name: string;
  tropical: Coordinates;
  sidereal: Coordinates;
  /** Visual magnitude. */
  magnitude: number;
  precision: Precision;
}

/** The caller must have set the sidereal mode and loaded sefstars.txt. */
export function fixedStar(swe: SwissEph, instant: Instant, star: string): FixedStar {
  if (!star.trim()) throw new RangeError('star name is empty');
  const f = ephemerisFlag(instant.ephemeris) | SEFLG_SPEED;
  const t = swe.fixstar(star, instant.jdTT, f);
  const s = swe.fixstar(star, instant.jdTT, f | SEFLG_SIDEREAL);
  const c = (x: typeof t.value.xx): Coordinates => ({
    longitude: x[0],
    latitude: x[1],
    distance: x[2],
    longitudeSpeed: x[3],
    latitudeSpeed: x[4],
    distanceSpeed: x[5],
  });
  return { name: t.value.name, tropical: c(t.value.xx), sidereal: c(s.value.xx), magnitude: swe.fixstarMag(star), precision: instant.precision };
}

export interface Yogatara {
  /** 1..27 in the 27-nakṣatra scheme; Abhijit (used in muhūrta) is 0. */
  nakshatra: number;
  name: string;
  /** Lookup key in sefstars.txt. */
  star: string;
  /** Plain-language label of the star. */
  label: string;
  /** Other stars proposed for this nakṣatra (catalogue keys, or a note if not in the catalogue). */
  alternatives: string[];
}

/**
 * PROVISIONAL. Which star is each nakṣatra's yogatārā is a textual question: the Sūrya
 * Siddhānta (ch. 8) gives their coordinates, and modern identifications differ for several.
 * This table holds common modern identifications as a working default. It is logged in
 * docs/CANON.md as "source to verify" and must not be shown as fact in Vedhashala until
 * Nilesh decides it. Entries with alternatives are the disputed ones.
 */
export const YOGATARAS_STATUS = 'provisional: source to verify (docs/CANON.md)' as const;

export const YOGATARAS: readonly Yogatara[] = [
  { nakshatra: 1, name: 'Aśvinī', star: ',beAri', label: 'β Arietis (Sheratan)', alternatives: [',alAri'] },
  { nakshatra: 2, name: 'Bharaṇī', star: ',41Ari', label: '41 Arietis', alternatives: ['35 Arietis (not in sefstars.txt)'] },
  { nakshatra: 3, name: 'Kṛttikā', star: ',etTau', label: 'η Tauri (Alcyone)', alternatives: [] },
  { nakshatra: 4, name: 'Rohiṇī', star: ',alTau', label: 'α Tauri (Aldebaran)', alternatives: [] },
  { nakshatra: 5, name: 'Mṛgaśīrṣa', star: ',laOri', label: 'λ Orionis', alternatives: [] },
  { nakshatra: 6, name: 'Ārdrā', star: ',alOri', label: 'α Orionis (Betelgeuse)', alternatives: [',gaGem'] },
  { nakshatra: 7, name: 'Punarvasu', star: ',beGem', label: 'β Geminorum (Pollux)', alternatives: [',alGem'] },
  { nakshatra: 8, name: 'Puṣya', star: ',deCnc', label: 'δ Cancri (Asellus Australis)', alternatives: [] },
  { nakshatra: 9, name: 'Āśleṣā', star: ',epHya', label: 'ε Hydrae', alternatives: [',alCnc'] },
  { nakshatra: 10, name: 'Maghā', star: ',alLeo', label: 'α Leonis (Regulus)', alternatives: [] },
  { nakshatra: 11, name: 'Pūrva Phalgunī', star: ',deLeo', label: 'δ Leonis (Zosma)', alternatives: [] },
  { nakshatra: 12, name: 'Uttara Phalgunī', star: ',beLeo', label: 'β Leonis (Denebola)', alternatives: [] },
  { nakshatra: 13, name: 'Hasta', star: ',deCrv', label: 'δ Corvi (Algorab)', alternatives: [',gaCrv'] },
  { nakshatra: 14, name: 'Citrā', star: ',alVir', label: 'α Virginis (Spica)', alternatives: [] },
  { nakshatra: 15, name: 'Svātī', star: ',alBoo', label: 'α Boötis (Arcturus)', alternatives: [] },
  { nakshatra: 16, name: 'Viśākhā', star: ',al-2Lib', label: 'α² Librae (Zubenelgenubi)', alternatives: ['ι Librae (not in sefstars.txt)'] },
  { nakshatra: 17, name: 'Anurādhā', star: ',deSco', label: 'δ Scorpii (Dschubba)', alternatives: [] },
  { nakshatra: 18, name: 'Jyeṣṭhā', star: ',alSco', label: 'α Scorpii (Antares)', alternatives: [] },
  { nakshatra: 19, name: 'Mūla', star: ',laSco', label: 'λ Scorpii (Shaula)', alternatives: [] },
  { nakshatra: 20, name: 'Pūrva Āṣāḍhā', star: ',deSgr', label: 'δ Sagittarii (Kaus Media)', alternatives: [] },
  { nakshatra: 21, name: 'Uttara Āṣāḍhā', star: ',siSgr', label: 'σ Sagittarii (Nunki)', alternatives: [] },
  { nakshatra: 0, name: 'Abhijit', star: ',alLyr', label: 'α Lyrae (Vega)', alternatives: [] },
  { nakshatra: 22, name: 'Śravaṇa', star: ',alAql', label: 'α Aquilae (Altair)', alternatives: [] },
  { nakshatra: 23, name: 'Dhaniṣṭhā', star: ',beDel', label: 'β Delphini (Rotanev)', alternatives: [',alDel'] },
  { nakshatra: 24, name: 'Śatabhiṣaj', star: ',laAqr', label: 'λ Aquarii', alternatives: [] },
  { nakshatra: 25, name: 'Pūrva Bhādrapadā', star: ',alPeg', label: 'α Pegasi (Markab)', alternatives: [] },
  { nakshatra: 26, name: 'Uttara Bhādrapadā', star: ',gaPeg', label: 'γ Pegasi (Algenib)', alternatives: [',alAnd'] },
  { nakshatra: 27, name: 'Revatī', star: ',zePsc', label: 'ζ Piscium', alternatives: [] },
];
