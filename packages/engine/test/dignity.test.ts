/**
 * Dignities and friendships (BPHS 3.49–58, 47.35–36).
 *
 * Outside reference: Bṛhajjātaka. Varāhamihira states the same exaltation degrees
 * (BJ 1.13) and mūlatrikoṇa signs (BJ 1.14), and after giving Satya's rule for natural
 * friendship (BJ 2.15, the rule of BPHS 3.55) he lists its result graha by graha
 * (BJ 2.16–17). The relations here are derived from the rule; the test checks them
 * against his list.
 */
import { describe, expect, it } from 'vitest';
import { SEVEN, type Planet } from '../src/jyotish/core.ts';
import { compoundRelation, debilitationPoint, dignity, naturalRelation, temporalRelation, type Relation } from '../src/jyotish/dignity.ts';

/** BJ 2.16–17, as Varāhamihira lists them: friends, neutrals, enemies. */
const BJ_2_16_17: Record<Planet, { friend: Planet[]; neutral: Planet[]; enemy: Planet[] }> = {
  // "śatrū manda sitau samaś ca śaśijo mitrāṇi śeṣā raveḥ"
  sun: { friend: ['moon', 'mars', 'jupiter'], neutral: ['mercury'], enemy: ['venus', 'saturn'] },
  // "tīkṣṇāṃśur himaraśmijaś ca suhṛdau śeṣāḥ samāḥ śītagoḥ"
  moon: { friend: ['sun', 'mercury'], neutral: ['mars', 'jupiter', 'venus', 'saturn'], enemy: [] },
  // "jīvendūṣṇakarāḥ kujasya suhṛdo jño 'riḥ sitārkī samau"
  mars: { friend: ['jupiter', 'moon', 'sun'], neutral: ['venus', 'saturn'], enemy: ['mercury'] },
  // "mitre sūrya sitau budhasya himaguḥ śatruḥ samāś cāpare"
  mercury: { friend: ['sun', 'venus'], neutral: ['mars', 'jupiter', 'saturn'], enemy: ['moon'] },
  // "sūreḥ saumya sitāv arī ravi suto madhyo 'pare tv anyathā"
  jupiter: { friend: ['sun', 'moon', 'mars'], neutral: ['saturn'], enemy: ['mercury', 'venus'] },
  // "saumyārkī suhṛdau samau kuja gurū śukrasya śeṣāv arī"
  venus: { friend: ['mercury', 'saturn'], neutral: ['mars', 'jupiter'], enemy: ['sun', 'moon'] },
  // "śukrajñau suhṛdau samaḥ sura guruḥ saurasya cānye 'rayaḥ"
  saturn: { friend: ['venus', 'mercury'], neutral: ['jupiter'], enemy: ['sun', 'moon', 'mars'] },
};

describe('natural friendship (BPHS 3.55) reproduces Bṛhajjātaka 2.16–17', () => {
  for (const a of SEVEN) {
    it(a, () => {
      const want = BJ_2_16_17[a];
      for (const kind of ['friend', 'neutral', 'enemy'] as Relation[]) {
        for (const b of want[kind]) expect(naturalRelation(a, b), `${a} → ${b}`).toBe(kind);
      }
      expect(want.friend.length + want.neutral.length + want.enemy.length).toBe(6);
    });
  }
});

describe('exaltation, debilitation, mūlatrikoṇa (BPHS 3.49–54; BJ 1.13–14)', () => {
  it('deepest exaltation degrees agree with BJ 1.13 and debilitation is 180° away', () => {
    // BJ 1.13: "daśa śikhi manuyuk tithīndriyāṃśais trinavaka viṃśatibhiḥ" = 10, 3, 28, 15, 5, 27, 20.
    const bj = { sun: 10, moon: 33, mars: 298, mercury: 165, jupiter: 95, venus: 357, saturn: 200 };
    for (const g of SEVEN) expect(debilitationPoint(g)).toBe((bj[g] + 180) % 360);
  });

  it('classifies the sign zones', () => {
    expect(dignity('sun', 9.99).kind).toBe('exalted');
    expect(dignity('sun', 190).kind).toBe('debilitated');
    expect(dignity('sun', 120 + 19.999).kind).toBe('moolatrikona');
    expect(dignity('sun', 120 + 20).kind).toBe('own');
    expect(dignity('moon', 30 + 2.999).kind).toBe('exalted');
    expect(dignity('moon', 30 + 3).kind).toBe('moolatrikona');
    expect(dignity('moon', 90 + 5).kind).toBe('own');
    expect(dignity('mercury', 150 + 14.9).kind).toBe('exalted');
    expect(dignity('mercury', 150 + 15).kind).toBe('moolatrikona');
    expect(dignity('mercury', 150 + 20).kind).toBe('own');
    expect(dignity('mercury', 60 + 1).kind).toBe('own');
    expect(dignity('mars', 11.9).kind).toBe('moolatrikona');
    expect(dignity('mars', 12).kind).toBe('own');
    expect(dignity('mars', 210).kind).toBe('own');
    expect(dignity('jupiter', 240 + 9).kind).toBe('moolatrikona');
    expect(dignity('venus', 180 + 14).kind).toBe('moolatrikona');
    expect(dignity('saturn', 300 + 25).kind).toBe('own');
    expect(dignity('saturn', 0.5).kind).toBe('debilitated');
  });

  it('gives the nodes the whole-sign dignities of BPHS 47.35–36 and no relations', () => {
    expect(dignity('rahu', 45).kind).toBe('exalted');
    expect(dignity('rahu', 225).kind).toBe('debilitated');
    expect(dignity('rahu', 75).kind).toBe('moolatrikona');
    expect(dignity('rahu', 315).kind).toBe('own');
    expect(dignity('ketu', 225).kind).toBe('exalted'); // also its own sign: exaltation first
    expect(dignity('ketu', 255).kind).toBe('moolatrikona');
    expect(dignity('ketu', 15).kind).toBeNull();
    expect(dignity('ketu', 15).lordRelation).toBeNull();
  });

  it('measures the arc from the debilitation point, 0 … 180', () => {
    expect(dignity('sun', 10).fromDebilitation).toBe(180);
    expect(dignity('sun', 190).fromDebilitation).toBe(0);
    expect(dignity('saturn', 110).fromDebilitation).toBe(90);
  });
});

describe('temporal and compound friendship (BPHS 3.56–58)', () => {
  it('2nd, 3rd, 4th, 10th, 11th, 12th are temporal friends', () => {
    const friends = Array.from({ length: 12 }, (_, i) => temporalRelation(0, i)).map((r, i) => (r === 'friend' ? i + 1 : 0)).filter(Boolean);
    expect(friends).toEqual([2, 3, 4, 10, 11, 12]);
  });

  it('combines as BPHS 3.57–58 says', () => {
    expect(compoundRelation('friend', 'friend')).toBe('great-friend');
    expect(compoundRelation('neutral', 'friend')).toBe('friend');
    expect(compoundRelation('enemy', 'friend')).toBe('neutral');
    expect(compoundRelation('friend', 'enemy')).toBe('neutral');
    expect(compoundRelation('neutral', 'enemy')).toBe('enemy');
    expect(compoundRelation('enemy', 'enemy')).toBe('great-enemy');
  });

  it('uses the compound relation to the sign lord when positions are given', () => {
    // Sun in Mithuna (lord Mercury, naturally neutral); Mercury in the next sign: temporal friend.
    const signs = { sun: 2, moon: 0, mars: 0, mercury: 3, jupiter: 0, venus: 0, saturn: 0 };
    expect(dignity('sun', 65, signs).kind).toBe('friend');
    expect(dignity('sun', 65).kind).toBe('neutral');
  });
});
