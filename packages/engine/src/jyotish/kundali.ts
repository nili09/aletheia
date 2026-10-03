/**
 * Everything the jyotish layer derives from one chart, in one plain-data object (it
 * crosses the worker boundary by structured clone). `provisional` collects every rule
 * used whose reading awaits Nilesh's decision (docs/CANON.md).
 */
import { GRAHAS, type Graha } from '../grahas.ts';
import { addSigns } from './core.ts';
import { longitudes, planetSigns, type Chart } from './chart.ts';
import { dignity, type Dignity } from './dignity.ts';
import { argala, jaimini, type Argala, type Jaimini } from './jaimini.ts';
import { ashtakavarga, type Ashtakavarga } from './ashtakavarga.ts';
import { shadbala, type Shadbala } from './shadbala.ts';
import { charaDasha, vimshottari, yogini, type CharaDasha, type DashaRun } from './dasha.ts';
import { combustion, crueltyOf, wars, type Combustion, type War } from './states.ts';
import { allVargas, type Varga, type VargaPosition } from './vargas.ts';
import type { RuleId } from './sources.ts';

export interface Kundali {
  chart: Chart;
  /** Every varga of every graha and of the lagna. */
  vargas: Record<Graha | 'lagna', Record<Varga, VargaPosition>>;
  dignities: Record<Graha, Dignity>;
  cruel: Record<Graha, boolean>;
  combustion: Combustion[];
  wars: War[];
  jaimini: Jaimini;
  /** Argalā on each of the twelve houses from the lagna. */
  argala: Argala[];
  ashtakavarga: Ashtakavarga;
  shadbala: Shadbala;
  dashas: { vimshottari: DashaRun; yogini: DashaRun; chara: CharaDasha };
  provisional: RuleId[];
}

export function kundali(c: Chart): Kundali {
  const s = c.settings;
  const lon = longitudes(c);
  const signs = planetSigns(c);
  const vargas = { lagna: allVargas(c.ascendant, s.vargas) } as Kundali['vargas'];
  const dignities = {} as Record<Graha, Dignity>;
  for (const g of GRAHAS) {
    vargas[g] = allVargas(lon[g], s.vargas);
    dignities[g] = dignity(g, lon[g], signs);
  }
  const cruel = crueltyOf(c);
  const j = jaimini(c.lagna, lon, s.karakas);
  const arg = Array.from({ length: 12 }, (_, i) => argala(addSigns(c.lagna, i), lon, cruel));
  const av = ashtakavarga(lon, c.lagna, s.ashtakavarga);
  const sb = shadbala(c);
  const birth = c.instant.jdTT;
  const dashas = {
    vimshottari: vimshottari(lon.moon, birth, s.dashaYearDays),
    yogini: yogini(lon.moon, birth, s.dashaYearDays),
    chara: charaDasha(c.lagna, lon, birth, s.dashaYearDays),
  };
  const ws = wars(c);
  const provisional = new Set<RuleId>([
    ...j.provisional,
    ...arg.flatMap((a) => a.provisional),
    ...av.provisional,
    ...sb.provisional,
    ...dashas.vimshottari.provisional,
    ...dashas.chara.provisional,
    'benefic-malefic',
    'combustion',
    ...ws.flatMap((w) => w.provisional),
  ]);
  if (s.vargas.hora === 'parashara' || s.vargas.drekkana === 'parashara') provisional.add('varga-hora-drekkana');
  provisional.add('varga-trimshamsha-signs');
  return { chart: c, vargas, dignities, cruel, combustion: combustion(c), wars: ws, jaimini: j, argala: arg, ashtakavarga: av, shadbala: sb, dashas, provisional: [...provisional] };
}
