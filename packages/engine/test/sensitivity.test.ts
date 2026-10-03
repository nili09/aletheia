import { beforeAll, describe, expect, test } from 'vitest';
import { DEFAULT_JYOTISH, vargaSign, type Engine, type SensitiveQuantity } from '../src/index.ts';
import { fixture, loadEngine } from './helpers.ts';

interface DrikLagna {
  source: string;
  days: Array<{ place: string; latitude: number; longitude: number; date: string; zone: string; lagnas: Array<{ sign: number; start: string; end: string }> }>;
}

let engine: Engine;
beforeAll(async () => {
  engine = await loadEngine(['sepl_18.se1', 'semo_18.se1']);
});

/** Local wall time on Indian Standard Time (every fixture date is after 1947) → Unix ms. */
const ist = (s: string) => Date.parse(`${s}:00+05:30`);

describe('lagna changes against Drik Panchang (Udaya Lagna tables)', () => {
  const drik = fixture<DrikLagna>('drik-lagna.json');
  // Drik shows minutes; its Lahiri differs from ours by ~15–20″ (TESTING.md), a few seconds of ascendant.
  const TOLERANCE_S = 90;

  test.each(drik.days.map((d) => [d.place, d.date, d] as const))('%s %s', (_, __, day) => {
    const place = { latitude: day.latitude, longitude: day.longitude };
    let worst = 0;
    for (const l of day.lagnas) {
      const start = ist(l.start);
      const end = ist(l.end);
      const mid = (start + end) / 2;
      const s = engine.sensitivity({ unixMs: mid }, place);
      const lagna = s.holds.find((h) => h.quantity === 'lagna')!;
      expect(lagna.value).toBe(l.sign);
      const from = mid + lagna.earlier!.seconds * 1000;
      const to = mid + lagna.later!.seconds * 1000;
      worst = Math.max(worst, Math.abs(from - start) / 1000, Math.abs(to - end) / 1000);
      expect(Math.abs(from - start) / 1000, `${l.sign} starts ${l.start}`).toBeLessThan(TOLERANCE_S);
      expect(Math.abs(to - end) / 1000, `${l.sign} ends ${l.end}`).toBeLessThan(TOLERANCE_S);
      expect(lagna.earlier!.value).toBe((l.sign + 11) % 12);
      expect(lagna.later!.value).toBe((l.sign + 1) % 12);
    }
    console.log(`${day.place} ${day.date}: worst ${worst.toFixed(1)} s`);
  });
});

describe('each change is where the quantity changes (definition)', () => {
  // Seeded instants 1800–2400, latitudes within ±60°.
  let seed = 20261003;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const cases = Array.from({ length: 40 }, () => ({
    jdUT: 2378497.5 + rand() * (2597641 - 2378497.5),
    place: { latitude: -60 + rand() * 120, longitude: -180 + rand() * 360 },
  }));

  const valueAt = (quantity: SensitiveQuantity, jdUT: number, place: { latitude: number; longitude: number }) => {
    const p = engine.birthPoint({ jdUT }, place);
    if (quantity === 'moon-nakshatra') return Math.floor(p.moon / (40 / 3));
    const n = quantity === 'lagna' ? 1 : quantity === 'navamsa-lagna' ? 9 : 60;
    return vargaSign(p.ascendant, n, DEFAULT_JYOTISH.vargas).sign;
  };

  test('the value holds up to each crossing and differs just beyond it', () => {
    for (const { jdUT, place } of cases) {
      const s = engine.sensitivity({ jdUT }, place);
      for (const h of s.holds) {
        expect(valueAt(h.quantity, jdUT, place)).toBe(h.value);
        for (const side of [h.earlier, h.later]) {
          expect(side, `${h.quantity} found within ${s.searchedDays} days`).not.toBeNull();
          const at = jdUT + side!.seconds / 86400;
          const inward = -Math.sign(side!.seconds) / 86400; // one second back toward the birth
          expect(valueAt(h.quantity, at + inward, place), `${h.quantity} 1 s inside`).toBe(h.value);
          expect(valueAt(h.quantity, at - inward, place), `${h.quantity} 1 s beyond`).toBe(side!.value);
          expect(side!.value).not.toBe(h.value);
        }
      }
    }
  });

  test('no change is missed: a 15-second scan finds none closer', () => {
    for (const { jdUT, place } of cases.slice(0, 6)) {
      const s = engine.sensitivity({ jdUT }, place);
      for (const h of s.holds.filter((x) => x.quantity !== 'moon-nakshatra')) {
        for (const side of [h.earlier!, h.later!]) {
          const dir = Math.sign(side.seconds);
          for (let k = 15; k < Math.abs(side.seconds) - 1; k += 15) {
            expect(valueAt(h.quantity, jdUT + (dir * k) / 86400, place), `${h.quantity} at ${dir * k} s`).toBe(h.value);
          }
        }
      }
    }
  });
});
