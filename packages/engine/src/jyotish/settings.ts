/**
 * Conventions of the jyotish layer. Every one is switchable; the defaults are recorded in
 * docs/CANON.md. Where the texts leave a choice open, the default is marked there as
 * awaiting Nilesh's decision, and results computed with it list the rule in `provisional`.
 */
import { DEFAULT_AYANAMSA } from '../ayanamsa.ts';
import type { NodeKind } from '../grahas.ts';
import { DEFAULT_RISE_CONVENTION, type RiseConvention } from '../riseset.ts';
import { DEFAULT_VARGA_OPTIONS, type VargaOptions } from './vargas.ts';

export interface JyotishSettings {
  ayanamsa: number;
  node: NodeKind;
  riseConvention: RiseConvention;
  /** Days in a dasha year (CLAUDE.md: 365.25). */
  dashaYearDays: number;
  /** Chara kārakas: 8 with Rahu (default) or 7. */
  karakas: 7 | 8;
  /** Horās: 24 equal parts of sunrise-to-sunrise, or 12 of the day and 12 of the night. */
  hora: 'equal' | 'unequal';
  /** The fixed karaṇas: in the order of Sūrya Siddhānta 2.67, or the order of modern pañcāṅgas. */
  karanaOrder: 'surya-siddhanta' | 'pancanga';
  vargas: VargaOptions;
  /** Aṣṭakavarga bindu tables: BPHS 66 or Bṛhajjātaka 9 (they differ in four places). */
  ashtakavarga: 'bphs' | 'bj';
  /** Combustion arcs as kālāṃśa (Sūrya Siddhānta 9.5) or as ecliptic longitude. */
  combustion: 'kalamsha' | 'longitude';
}

/** Standard dasha year lengths in days. */
export const DASHA_YEARS = { julian: 365.25, savana: 360, tropical: 365.24219, sidereal: 365.256363 } as const;

export const DEFAULT_JYOTISH: Readonly<JyotishSettings> = {
  ayanamsa: DEFAULT_AYANAMSA,
  node: 'true',
  riseConvention: DEFAULT_RISE_CONVENTION,
  dashaYearDays: DASHA_YEARS.julian,
  karakas: 8,
  hora: 'equal',
  karanaOrder: 'surya-siddhanta',
  vargas: DEFAULT_VARGA_OPTIONS,
  ashtakavarga: 'bphs',
  combustion: 'kalamsha',
};
