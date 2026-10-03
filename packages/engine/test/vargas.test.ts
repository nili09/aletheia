/**
 * The sixteen vargas of BPHS 6.
 *
 * Outside references in the texts themselves:
 * - BJ 1.4: the nine nakṣatra quarters (padas) of each sign begin with Aśvinī at Meṣa, so
 *   the navāṃśa sign is the pada counted from Meṣa, mod 12; BJ 1.6: navāṃśas of Meṣa,
 *   Makara, Tulā, Karka signs begin from those signs. BPHS 6.12 states the rule another way.
 * - BJ 1.11: horā of the Sun first in odd signs; drekkāṇas ruled by the lords of the sign,
 *   its 5th and 9th — the BPHS 6.5–8 scheme.
 * - BJ 1.7: the triṃśāṃśa lords and their 5, 5, 8, 7, 5 degrees, reversed in even signs.
 * - BPHS 6.33: the D60 arithmetic, worked by hand below.
 */
import { describe, expect, it } from 'vitest';
import { nakshatraPada } from '../src/zodiac.ts';
import { allVargas, vargaSign, VARGAS, type Varga } from '../src/jyotish/vargas.ts';

const S = (sign: number, deg: number) => sign * 30 + deg;

describe('each varga, by its rule in BPHS 6', () => {
  it('D1 is the sign', () => {
    for (let s = 0; s < 12; s++) expect(vargaSign(S(s, 17), 1).sign).toBe(s);
  });

  it('D2: odd signs Siṃha then Karka, even signs Karka then Siṃha (6.5–6; BJ 1.11)', () => {
    expect(vargaSign(S(0, 14.99), 2).sign).toBe(4);
    expect(vargaSign(S(0, 15), 2).sign).toBe(3);
    expect(vargaSign(S(1, 1), 2).sign).toBe(3);
    expect(vargaSign(S(1, 29), 2).sign).toBe(4);
    // Parivṛtti-dvaya: 24 horās from Meṣa, twice round.
    expect(vargaSign(S(0, 1), 2, { hora: 'parivritti', drekkana: 'parashara' }).sign).toBe(0);
    expect(vargaSign(S(6, 20), 2, { hora: 'parivritti', drekkana: 'parashara' }).sign).toBe(1);
  });

  it('D3: the sign, its 5th, its 9th (6.7–8; BJ 1.11)', () => {
    expect([5, 15, 25].map((d) => vargaSign(S(3, d), 3).sign)).toEqual([3, 7, 11]);
    expect([5, 15, 25].map((d) => vargaSign(S(3, d), 3, { hora: 'parashara', drekkana: 'parivritti' }).sign)).toEqual([9, 10, 11]);
  });

  it('D4: kendras from the sign (6.9)', () => {
    expect([1, 8, 16, 23].map((d) => vargaSign(S(5, d), 4).sign)).toEqual([5, 8, 11, 2]);
  });

  it('D7: odd from itself, even from its 7th (6.10)', () => {
    expect(vargaSign(S(0, 0), 7).sign).toBe(0);
    expect(vargaSign(S(1, 0), 7).sign).toBe(7);
    expect(vargaSign(S(1, 29.9), 7).sign).toBe(1);
  });

  it('D9: movable from itself, fixed from its 9th, dual from its 5th (6.12)', () => {
    expect(vargaSign(S(0, 0.1), 9).sign).toBe(0);
    expect(vargaSign(S(1, 0.1), 9).sign).toBe(9);
    expect(vargaSign(S(2, 0.1), 9).sign).toBe(6);
  });

  it('D9 is the pada counted from Meṣa, mod 12 (BJ 1.4, 1.6) — at 100 000 longitudes', () => {
    for (let i = 0; i < 100000; i++) {
      const lon = (i * 360) / 100000 + 0.0001;
      const { nakshatra, pada } = nakshatraPada(lon);
      expect(vargaSign(lon, 9).sign).toBe((nakshatra * 4 + pada) % 12);
    }
  });

  it('D10: odd from itself, even from its 9th (6.13)', () => {
    expect(vargaSign(S(2, 3.1), 10).sign).toBe(3);
    expect(vargaSign(S(3, 0), 10).sign).toBe(11);
  });

  it('D12: from the sign (6.15)', () => {
    expect(vargaSign(S(11, 29.99), 12).sign).toBe(10);
  });

  it('D16 and D45: movable from Meṣa, fixed from Siṃha, dual from Dhanus (6.16, 6.31)', () => {
    for (const v of [16, 45] as const) {
      expect(vargaSign(S(3, 0), v).sign).toBe(0);
      expect(vargaSign(S(4, 0), v).sign).toBe(4);
      expect(vargaSign(S(5, 0), v).sign).toBe(8);
    }
  });

  it('D20: movable from Meṣa, fixed from Dhanus, dual from Siṃha (6.17)', () => {
    expect(vargaSign(S(6, 0), 20).sign).toBe(0);
    expect(vargaSign(S(7, 0), 20).sign).toBe(8);
    expect(vargaSign(S(8, 0), 20).sign).toBe(4);
  });

  it('D24: odd from Siṃha, even from Karka (6.22)', () => {
    expect(vargaSign(S(0, 0), 24).sign).toBe(4);
    expect(vargaSign(S(1, 0), 24).sign).toBe(3);
  });

  it('D27: Meṣa, Karka, Tulā, Makara for fire, earth, air, water signs (6.26)', () => {
    expect([0, 1, 2, 3, 4, 7].map((s) => vargaSign(S(s, 0), 27).sign)).toEqual([0, 3, 6, 9, 0, 9]);
  });

  it('D30: lords and degrees of 6.27 (BJ 1.7)', () => {
    const odd = [2, 7, 14, 21, 27].map((d) => vargaSign(S(0, d), 30));
    expect(odd.map((p) => p.lord)).toEqual(['mars', 'saturn', 'jupiter', 'mercury', 'venus']);
    expect(odd.map((p) => p.sign)).toEqual([0, 10, 8, 2, 6]);
    const even = [2, 7, 14, 21, 27].map((d) => vargaSign(S(1, d), 30));
    expect(even.map((p) => p.lord)).toEqual(['venus', 'mercury', 'jupiter', 'saturn', 'mars']);
    expect(even.map((p) => p.sign)).toEqual([1, 5, 11, 9, 7]);
    // Boundaries: 5° begins Saturn's part in odd signs; 12° begins Jupiter's in even signs.
    expect(vargaSign(S(0, 5), 30).lord).toBe('saturn');
    expect(vargaSign(S(1, 12), 30).lord).toBe('jupiter');
  });

  it('D40: odd from Meṣa, even from Tulā (6.29)', () => {
    expect(vargaSign(S(2, 0), 40).sign).toBe(0);
    expect(vargaSign(S(3, 0.75), 40).sign).toBe(7);
  });

  it('D60: the arithmetic of 6.33, worked by hand', () => {
    // 13°20′ in Meṣa: 2 × 13°20′ = 26°40′; 26 ÷ 12 leaves 2; 2 + 1 = 3rd from Meṣa = Mithuna.
    expect(vargaSign(S(0, 13 + 20 / 60), 60).sign).toBe(2);
    // 29°50′ in Kumbha: 2 × 29°50′ = 59°40′; 59 ÷ 12 leaves 11; 12th from Kumbha = Makara.
    expect(vargaSign(S(10, 29 + 50 / 60), 60).sign).toBe(9);
    // 0°10′ in Karka: 0 ÷ 12 leaves 0; 1st from Karka = Karka.
    expect(vargaSign(S(3, 10 / 60), 60).sign).toBe(3);
  });
});

describe('structure of every varga', () => {
  it('within a sign, part p + 1 lies 1 sign on from part p (D3: 4 signs, D4: 3 signs)', () => {
    const step: Partial<Record<Varga, number>> = { 3: 4, 4: 3 };
    for (const v of VARGAS) {
      if (v === 30 || v === 2) continue;
      for (let s = 0; s < 12; s++) {
        for (let p = 0; p + 1 < v; p++) {
          const a = vargaSign(S(s, ((p + 0.5) * 30) / v), v);
          const b = vargaSign(S(s, ((p + 1.5) * 30) / v), v);
          expect(a.part).toBe(p);
          expect((b.sign - a.sign + 12) % 12, `D${v} sign ${s} part ${p}`).toBe(step[v] ?? 1);
        }
      }
    }
  });

  it('changes part exactly at each boundary (1e-9° either side), and never leaves the sign', () => {
    // A boundary such as 150/7° is not a double, so test just either side of it.
    for (const v of VARGAS) {
      if (v === 30) continue;
      for (let k = 1; k < 12 * v; k++) {
        const b = (k * 30) / v;
        expect(vargaSign(b + 1e-9, v).part).toBe(k % v);
        expect(vargaSign(b - 1e-9, v).part).toBe((k - 1) % v);
        expect(vargaSign(b + 1e-9, 1).sign).toBe(Math.floor(k / v));
      }
    }
    expect(allVargas(359.99999999999994)[60].part).toBe(59);
  });

  it('rejects longitudes outside [0, 360)', () => {
    expect(() => vargaSign(360, 9)).toThrow(RangeError);
    expect(() => vargaSign(-0.1, 9)).toThrow(RangeError);
    expect(() => vargaSign(Number.NaN, 9)).toThrow(RangeError);
  });
});
