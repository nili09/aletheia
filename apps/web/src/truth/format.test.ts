import { describe, expect, it } from 'vitest';
import type { AstroEvent, Instant } from '@aletheia/engine';
import { describeEvents, dms, groupByInstant, inSign, longitude360, nakshatraOf, signedDms, tithiName } from './format.ts';

const instant = (jdTT: number): Instant => ({ jdTT, jdUT: jdTT, deltaTSeconds: 0, ephemeris: 'swiss', precision: 'full' });

describe('angles', () => {
  it('truncates to the arcsecond, never rounding up into the next sign', () => {
    expect(dms(29 + 59 / 60 + 59.7 / 3600)).toBe('29°59′59″');
    expect(inSign(149.99999)).toMatchObject({ sign: 'Siṃha', dms: '29°59′59″' });
    expect(inSign(150)).toMatchObject({ sign: 'Kanyā', dms: '0°00′00″' });
  });

  it('keeps exact boundaries exact despite binary noise', () => {
    expect(dms(10 / 3)).toBe('3°20′00″');
    expect(nakshatraOf(120)).toEqual({ name: 'Maghā', pada: 1 });
    expect(nakshatraOf(119.9999)).toEqual({ name: 'Āśleṣā', pada: 4 });
  });

  it('formats 0–360 longitudes and signed latitudes', () => {
    expect(longitude360(5.5)).toBe('005°30′00″');
    expect(longitude360(359.99999)).toBe('359°59′59″');
    expect(signedDms(-0.0114)).toBe('−0°00′41″');
    expect(signedDms(5.1675)).toBe('+5°10′03″');
  });
});

describe('events', () => {
  it('names tithis', () => {
    expect(tithiName(1)).toBe('Śukla Pratipadā');
    expect(tithiName(15)).toBe('Pūrṇimā');
    expect(tithiName(16)).toBe('Kṛṣṇa Pratipadā');
    expect(tithiName(30)).toBe('Amāvāsyā');
  });

  it('merges a sign, nakshatra and pada ingress at one instant into one line', () => {
    const t = instant(2461316);
    const base = { graha: 'moon' as const, boundary: 120, motion: 'direct' as const, instant: t };
    const group: AstroEvent[] = [
      { kind: 'pada-ingress', ...base, entered: 36, left: 35 },
      { kind: 'nakshatra-ingress', ...base, entered: 9, left: 8 },
      { kind: 'sign-ingress', ...base, entered: 4, left: 3 },
    ];
    expect(describeEvents(group)).toBe('Candra enters Siṃha · Maghā 1');
  });

  it('says saṅkrānti for the Sun, and new moon with the tithi that begins', () => {
    const t = instant(2461316);
    const sun = { graha: 'sun' as const, boundary: 180, motion: 'direct' as const, instant: t };
    expect(
      describeEvents([
        { kind: 'pada-ingress', ...sun, entered: 54, left: 53 },
        { kind: 'sign-ingress', ...sun, entered: 6, left: 5 },
        { kind: 'sankranti', ...sun, entered: 6, left: 5 },
      ]),
    ).toBe('Sūrya enters Citrā 3 · Tulā saṅkrānti');
    expect(
      describeEvents([
        { kind: 'tithi', boundary: 0, tithi: 1, instant: t },
        { kind: 'new-moon', boundary: 0, tithi: 1, instant: t },
      ]),
    ).toBe('New moon · Śukla Pratipadā begins');
  });

  it('marks retrograde ingresses and groups only identical instants', () => {
    const e = (jd: number): AstroEvent => ({ kind: 'pada-ingress', graha: 'mercury', boundary: 10, entered: 2, left: 3, motion: 'retrograde', instant: instant(jd) });
    expect(describeEvents([e(1)])).toBe('Budha ℞ enters Aśvinī 3');
    expect(groupByInstant([e(1), e(1), e(2)]).map((g) => g.length)).toEqual([2, 1]);
  });
});
