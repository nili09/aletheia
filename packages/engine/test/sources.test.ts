/**
 * The Mantra door is complete: every verse a rule cites is in verses.json (copied from the
 * e-texts) and has our translation; nothing in verses.json or TRANSLATIONS is uncited; every
 * open rule says what is open.
 */
import { describe, expect, it } from 'vitest';
import { RULES, TRANSLATIONS, VERSES, WORKS, type Rule } from '../src/jyotish/sources.ts';

const rules = Object.entries(RULES) as Array<[string, Rule]>;
const cited = new Set(rules.flatMap(([, r]) => r.verses));

describe('sources', () => {
  it('every cited verse has its Sanskrit and a translation', () => {
    for (const [id, r] of rules) {
      for (const v of r.verses) {
        expect(VERSES[v], `${id}: ${v} Sanskrit`).toBeTruthy();
        expect(TRANSLATIONS[v], `${id}: ${v} translation`).toBeTruthy();
        expect(Object.keys(WORKS)).toContain(v.split(' ')[0]);
      }
    }
  });

  it('every stored verse and translation is cited by some rule', () => {
    for (const v of Object.keys(VERSES)) expect(cited.has(v), v).toBe(true);
    for (const v of Object.keys(TRANSLATIONS)) expect(cited.has(v), v).toBe(true);
  });

  it('Sanskrit verses end with their own number (Devanagari texts)', () => {
    const digits = '०१२३४५६७८९';
    for (const [key, text] of Object.entries(VERSES)) {
      if (key.startsWith('SS')) continue;
      const n = key.split('.')[1]!;
      const deva = [...n].map((c) => digits[Number(c)]).join('');
      expect(text.replace(/\s/g, ''), key).toMatch(new RegExp(`॥${deva}॥$`));
    }
  });

  it('the six decisions of 2026-10-03 are canon', () => {
    for (const id of ['karana-fixed-order', 'combustion', 'benefic-malefic', 'karaka-seven', 'abda-masa-bala'] as const) {
      expect((RULES[id] as Rule).status, id).toBe('canon');
      expect((RULES[id] as Rule).decided, id).toBeTruthy();
    }
  });

  it('every pending or unsourced rule says what is open and what the default is', () => {
    for (const [id, r] of rules) {
      if (r.status === 'canon') expect(r.open, id).toBeUndefined();
      else expect(r.open?.length, id).toBeGreaterThan(20);
      if (r.decided) {
        expect(r.status, id).toBe('canon');
        expect(r.decided, id).toMatch(/^Nilesh, \d{4}-\d{2}-\d{2}: /);
      }
      if (r.status !== 'unsourced' && id !== 'dasha-year') expect(r.verses.length, id).toBeGreaterThan(0);
      expect(r.yantra.length, id).toBeGreaterThan(20);
    }
  });
});
