/**
 * Jaimini topics (BPHS 29–33) and the chart states (combustion, war, cruel/gentle).
 *
 * Outside references: the worked example BPHS 29.5 gives for the pada exceptions; the
 * rules of 32.3–5 and 31.3–7 worked by hand on constructed positions; for combustion, the
 * spherical astronomy (at the equator the kālāṃśa is the difference in right ascension;
 * by longitude it is the longitude difference); for war, the real conjunction of Jupiter
 * and Saturn on 2020-12-21 (closest 0.1°).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Engine } from '../src/index.ts';
import type { Graha } from '../src/grahas.ts';
import { argala, argalaHouse, arudha, arudhas, charaKarakas, jaimini } from '../src/jyotish/jaimini.ts';
import { combustion, crueltyOf, mercuryCompany, mercuryTie, moonIsCruel, wars } from '../src/jyotish/states.ts';
import { DEFAULT_JYOTISH } from '../src/jyotish/settings.ts';
import { loadEngine } from './helpers.ts';

let engine: Engine;
beforeAll(async () => {
  engine = await loadEngine();
});

/** Positions by sign and degrees (default: 15° of Mīna). */
const at = (signs: Partial<Record<Graha, number>>, deg: Partial<Record<Graha, number>> = {}) => {
  const all = {} as Record<Graha, number>;
  for (const g of ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'] as Graha[]) all[g] = (signs[g] ?? 11) * 30 + (deg[g] ?? 15);
  return all;
};

describe('chara kārakas (BPHS 32.1–5, 32.13–17)', () => {
  it('rank by degrees in the sign, the sign ignored; Rahu counts 30° − degrees', () => {
    // Degrees: Sun 29, Moon 3, Mars 17, Mercury 22, Jupiter 8, Venus 12, Saturn 25; Rahu at 2° → counts 28.
    const lon = at({ sun: 0, moon: 5, mars: 9, mercury: 1, jupiter: 3, venus: 7, saturn: 10, rahu: 2, ketu: 8 }, { sun: 29, moon: 3, mars: 17, mercury: 22, jupiter: 8, venus: 12, saturn: 25, rahu: 2, ketu: 2 });
    const k8 = charaKarakas(lon, 8).karakas;
    expect(k8.map((k) => `${k.role}:${k.graha}`)).toEqual(['atma:sun', 'amatya:rahu', 'bhratri:saturn', 'matri:mercury', 'pitri:mars', 'putra:venus', 'jnati:jupiter', 'dara:moon']);
    expect(k8[1]!.degrees).toBe(28);
    // Seven, without the pitṛkāraka (decided 2026-10-03, K.N. Rao's scheme).
    const k7 = charaKarakas(lon, 7);
    expect(k7.karakas.map((k) => k.role)).toEqual(['atma', 'amatya', 'bhratri', 'matri', 'putra', 'jnati', 'dara']);
    expect(k7.karakas.map((k) => k.graha)).toEqual(['sun', 'saturn', 'mercury', 'mars', 'venus', 'jupiter', 'moon']);
    expect(k7.provisional).toEqual([]);
    // BPHS 32.16's alternative: mātṛ = putra, pitṛ kept.
    expect(charaKarakas(lon, 7, 'matri-putra').karakas.map((k) => k.role)).toEqual(['atma', 'amatya', 'bhratri', 'matri-putra', 'pitri', 'jnati', 'dara']);
  });

  it('reports pairs equal to the arcsecond (32.16–17)', () => {
    const lon = at({ sun: 0, moon: 5 }, { sun: 10.00001, moon: 10.0001, mars: 1, mercury: 2, jupiter: 3, venus: 4, saturn: 5, rahu: 6, ketu: 6 });
    expect(charaKarakas(lon, 7).ties).toEqual([['moon', 'sun']]);
  });
});

describe('ārūḍha padas (BPHS 29.2–5)', () => {
  it('as far beyond the lord as the lord is from the house', () => {
    // Lagna Meṣa, Mars in Mithuna (3rd): 3rd from Mithuna = Siṃha.
    expect(arudha(0, 1, at({ mars: 2 })).pada).toBe(4);
  });

  it('the worked example of 29.5: lord in the 4th → the 4th is the pada; lord in the 7th → the 10th', () => {
    // Lagna Meṣa; Mars in Karka (4th): 4th from Karka is Tulā, the 7th — so the pada is the 4th, Karka.
    const a = arudha(0, 1, at({ mars: 3 }));
    expect(a).toMatchObject({ pada: 3, exception: 'seventh-to-4th' });
    // Mars in Tulā (7th): 7th from Tulā is Meṣa itself — so the pada is the 10th, Makara.
    const b = arudha(0, 1, at({ mars: 6 }));
    expect(b).toMatchObject({ pada: 9, exception: 'own-sign-to-10th' });
    // Lord in the house itself: the pada would be the house: the 10th.
    expect(arudha(0, 1, at({ mars: 0 })).pada).toBe(9);
  });

  it('a pada is never the house itself or its 7th', () => {
    for (let lagna = 0; lagna < 12; lagna++) {
      for (let k = 0; k < 50; k++) {
        const lon = at({ sun: k % 12, moon: (k * 5) % 12, mars: (k * 7) % 12, mercury: (k * 3) % 12, jupiter: (k * 11) % 12, venus: (k * 2) % 12, saturn: (k * 13) % 12, rahu: (k * 17) % 12, ketu: ((k * 17) % 12 + 6) % 12 });
        for (const a of arudhas(lagna, lon)) {
          expect(a.pada).not.toBe(a.sign);
          expect(a.pada).not.toBe((a.sign + 6) % 12);
        }
      }
    }
  });

  it('upapada is the pada of the 12th; kārakāṃśa is the ātmakāraka’s navāṃśa', () => {
    const lon = at({ sun: 0, moon: 4, mars: 7, mercury: 1, jupiter: 8, venus: 2, saturn: 10, rahu: 5, ketu: 11 }, { sun: 29.9 });
    const j = jaimini(3, lon, 8);
    expect(j.upapada).toBe(j.arudhas[11]!.pada);
    expect(j.arudhaLagna).toBe(j.arudhas[0]!.pada);
    expect(j.karakas.karakas[0]!.graha).toBe('sun');
    expect(j.karakamsha).toBe(8); // 29.9° Meṣa is the 9th pada of Aśvinī–Kṛttikā: Dhanus
  });
});

describe('argalā (BPHS 31.3–8)', () => {
  const none = { sun: false, moon: false, mars: false, mercury: false, jupiter: false, venus: false, saturn: false, rahu: true, ketu: true };

  it('Rahu and Ketu are counted backwards (31.6)', () => {
    // From Meṣa, Rahu in Kumbha is the 11th forward but the 3rd backward.
    expect(argalaHouse(0, 'rahu', 10)).toBe(3);
    expect(argalaHouse(0, 'sun', 10)).toBe(11);
  });

  it('obstructors fewer: argalā prevails; more: obstructed; equal: left open', () => {
    // Reference Meṣa. 4th (Karka): Sun, Moon; 10th (Makara): Mars → prevails.
    // 2nd (Vṛṣabha): Mercury; 12th (Mīna): Jupiter, Venus → obstructed.
    // 11th (Kumbha): Saturn; and Rahu in Mithuna, the 11th counted backwards.
    const lon = at({ sun: 3, moon: 3, mars: 9, mercury: 1, jupiter: 11, venus: 11, saturn: 10, rahu: 2, ketu: 8 });
    const a = argala(0, lon, none);
    const by = Object.fromEntries(a.pairs.map((p) => [p.place, p]));
    expect(by[4]).toMatchObject({ argala: ['sun', 'moon'], virodha: ['mars'], result: 'prevails' });
    expect(by[2]).toMatchObject({ argala: ['mercury'], virodha: ['venus', 'jupiter'], result: 'obstructed' });
    expect(by[11]).toMatchObject({ argala: ['saturn', 'rahu'], virodha: [], result: 'unobstructed' });
    // Ketu in Dhanus: 9th forward, but 5th backwards from Meṣa → argalā on the 5th place.
    expect(by[5]).toMatchObject({ argala: ['ketu'], result: 'unobstructed' });
    const eq = argala(0, at({ sun: 3, mars: 9, moon: 0, mercury: 0, jupiter: 0, venus: 0, saturn: 0, rahu: 0, ketu: 6 }), none);
    expect(eq.pairs[0]).toMatchObject({ place: 4, result: 'equal' });
  });
});

describe('cruel and gentle (BPHS 3.11; decided 2026-10-03)', () => {
  const equator = { latitude: 0, longitude: 0 };
  it('the Moon is cruel through the dark half, gentle through the bright half', () => {
    // Full moon 2024-04-23 23:49 UT; new moon 2024-05-08 03:22 UT.
    const before = engine.chart({ unixMs: Date.parse('2024-04-23T20:00:00Z') }, equator); // last hours of the bright half
    const after = engine.chart({ unixMs: Date.parse('2024-04-24T04:00:00Z') }, equator); // first hours of the dark half
    const lateDark = engine.chart({ unixMs: Date.parse('2024-05-06T00:00:00Z') }, equator);
    expect(moonIsCruel(before)).toBe(false);
    expect(moonIsCruel(after)).toBe(true);
    expect(moonIsCruel(lateDark)).toBe(true);
    // The alternative: cruel only while less than half lit (Kṛṣṇa Aṣṭamī to Śukla Aṣṭamī).
    const alt = { ...after, settings: { ...after.settings, waningMoon: 'under-half-lit' as const } };
    expect(moonIsCruel(alt)).toBe(false);
  });

  /** A real chart with Mercury's sign companions replaced (signs only matter here). */
  const withCompany = (cruelN: number, gentleN: number) => {
    const c = engine.chart({ unixMs: Date.parse('2024-04-23T20:00:00Z') }, equator); // bright half: the Moon is gentle
    const ms = c.grahas.mercury.sign;
    const away = (ms + 6) % 12;
    const grahas = structuredClone(c.grahas);
    for (const g of ['sun', 'moon', 'mars', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'] as Graha[]) grahas[g].sign = away;
    (['sun', 'mars', 'saturn'] as Graha[]).slice(0, cruelN).forEach((g) => (grahas[g].sign = ms));
    (['jupiter', 'venus', 'moon'] as Graha[]).slice(0, gentleN).forEach((g) => (grahas[g].sign = ms));
    return { ...c, grahas };
  };

  it('Mercury is cruel when joined by more cruel than gentle grahas', () => {
    expect(crueltyOf(withCompany(0, 0)).mercury).toBe(false); // alone
    expect(crueltyOf(withCompany(1, 0)).mercury).toBe(true);
    expect(crueltyOf(withCompany(2, 1)).mercury).toBe(true);
    expect(crueltyOf(withCompany(1, 2)).mercury).toBe(false);
    expect(mercuryCompany(withCompany(2, 1))).toEqual({ cruel: ['sun', 'mars'], gentle: ['jupiter'] });
  });

  it('a tie is gentle by default and flagged; the alternative makes any cruel company cruel', () => {
    const tie = withCompany(1, 1);
    expect(crueltyOf(tie).mercury).toBe(false);
    expect(mercuryTie(tie)).toBe(true);
    expect(mercuryTie(withCompany(2, 1))).toBe(false);
    expect(mercuryTie(withCompany(0, 0))).toBe(false);
    const any = { ...tie, settings: { ...tie.settings, mercuryCruel: 'any' as const } };
    expect(crueltyOf(any).mercury).toBe(true);
    expect(mercuryTie(any)).toBe(false);
  });
});

describe('combustion (SS 9.2–9, 10.1)', () => {
  it('measures by ecliptic longitude by default (decided 2026-10-03)', () => {
    const c = engine.chart({ unixMs: Date.parse('1990-05-17T04:30:00Z') }, { latitude: 28.6139, longitude: 77.209 });
    const m = combustion(c).find((x) => x.graha === 'mercury')!;
    expect(m.separation).toBeCloseTo(Math.abs(c.grahas.sun.longitude - c.grahas.mercury.longitude), 9); // 18.1°
    expect(m.combust).toBe(false);
    expect(combustion(c, 'kalamsha').find((x) => x.graha === 'mercury')!.combust).toBe(true); // 12.6° of kālāṃśa
  });

  it('at the equator the kālāṃśa is the difference in right ascension', () => {
    const c = engine.chart({ unixMs: Date.parse('2024-03-01T12:00:00Z') }, { latitude: 0, longitude: 0 });
    for (const x of combustion(c, 'kalamsha')) {
      const d = Math.abs(((c.grahas[x.graha].ra - c.grahas.sun.ra + 540) % 360) - 180);
      expect(x.separation!).toBeCloseTo(d, 9);
    }
  });

  it('by longitude, the separation is the longitude difference', () => {
    const c = engine.chart({ unixMs: Date.parse('2024-03-01T12:00:00Z') }, { latitude: 40, longitude: 0 });
    for (const x of combustion(c, 'longitude')) {
      const d = Math.abs(((c.grahas[x.graha].longitude - c.grahas.sun.longitude + 540) % 360) - 180);
      expect(x.separation).toBeCloseTo(d, 12);
    }
  });

  it('arcs: Mercury 14 / 12 retrograde, Venus 10 / 8 retrograde, the rest fixed', () => {
    for (let i = 0; i < 30; i++) {
      const c = engine.chart({ unixMs: Date.parse('2020-01-01T00:00:00Z') + i * 2.3e8 }, { latitude: 20, longitude: 80 });
      for (const x of combustion(c)) {
        const retro = c.grahas[x.graha].retrograde;
        const want = { moon: 12, mars: 17, jupiter: 11, saturn: 15, mercury: retro ? 12 : 14, venus: retro ? 8 : 10 }[x.graha];
        expect(x.arc).toBe(want);
        expect(x.horizon).toBe(((c.grahas[x.graha].longitude - c.grahas.sun.longitude + 360) % 360) < 180 ? 'west' : 'east');
      }
    }
  });

  it('a graha in conjunction with the Sun is combust; at quadrature it is not', () => {
    const c = engine.chart({ unixMs: Date.parse('2019-12-27T18:00:00Z') }, { latitude: 20, longitude: 80 }); // Jupiter conjunct the Sun
    expect(combustion(c).find((x) => x.graha === 'jupiter')!.combust).toBe(true);
    const q = engine.chart({ unixMs: Date.parse('2020-04-14T00:00:00Z') }, { latitude: 20, longitude: 80 });
    expect(combustion(q).find((x) => x.graha === 'jupiter')!.combust).toBe(false);
  });

  it('reports no verdict where the kālāṃśa is undefined (circumpolar)', () => {
    // At 65° N in January 2025 the Moon, near its major standstill (declination ±28.7°), is circumpolar on some days.
    let undefinedSeen = 0;
    for (let d = 0; d < 28; d++) {
      const c = engine.chart({ unixMs: Date.parse('2025-01-01T12:00:00Z') + d * 86400e3 }, { latitude: 65, longitude: 25 }, DEFAULT_JYOTISH);
      for (const x of combustion(c, 'kalamsha')) {
        if (x.separation === null) {
          undefinedSeen++;
          expect(x.combust).toBeNull();
          expect(Math.abs(Math.tan((65 * Math.PI) / 180) * Math.tan((c.grahas[x.graha].dec * Math.PI) / 180))).toBeGreaterThan(1);
        }
      }
    }
    expect(undefinedSeen).toBeGreaterThan(0);
  });
});

describe('graha yuddha (SS 7.1, 7.19–23)', () => {
  it('Jupiter and Saturn on 2020-12-21: at war, the northern one the victor', () => {
    const c = engine.chart({ unixMs: Date.parse('2020-12-21T18:00:00Z') }, { latitude: 20, longitude: 80 });
    const w = wars(c);
    expect(w).toHaveLength(1);
    expect(w[0]!.grahas).toEqual(['jupiter', 'saturn']);
    expect(w[0]!.separation).toBeLessThan(0.2);
    const north = c.grahas.jupiter.latitude > c.grahas.saturn.latitude ? 'jupiter' : 'saturn';
    expect(w[0]!.victor).toBe(north);
  });

  it('the Sun and Moon never make war (SS 7.1)', () => {
    for (let i = 0; i < 200; i++) {
      const c = engine.chart({ unixMs: Date.parse('2000-01-01T00:00:00Z') + i * 8.64e7 * 3.7 }, { latitude: 20, longitude: 80 });
      for (const w of wars(c, 'longitude')) {
        expect(w.grahas).not.toContain('sun');
        expect(w.grahas).not.toContain('moon');
        expect(w.longitudeDifference).toBeLessThan(1);
      }
    }
  });
});
