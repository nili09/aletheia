#!/usr/bin/env node
/**
 * Fetch the Sanskrit verses that the jyotish rules cite and save them, verbatim, for the
 * Mantra door.
 *
 *   node packages/engine/scripts/fetch-verses.mjs
 *
 * Writes packages/engine/src/jyotish/verses.json: { "BPHS 6.12": "…", … }.
 *
 * Sources (public-domain texts; the e-texts are volunteer transcriptions):
 * - Bṛhat Pārāśara Horā Śāstra, 97-chapter recension, sanskritdocuments.org (par0110 …
 *   par9197; transliterated by Ahto Jarve, proofread by Ahto Jarve, Ginda Lass,
 *   Abhisyanta Tejaswi). Chapter and verse numbers are that e-text's.
 * - Bṛhajjātaka of Varāhamihira, sanskritdocuments.org (brihajjAtakam).
 * - Phaladīpikā of Mantreśvara, sanskritdocuments.org (phaladIpika).
 * - Sūrya Siddhānta, GRETIL (sa_sUryasiddhAnta, entered by Michio Yano), in IAST.
 *
 * Text is copied as published. The only change: GRETIL's ASCII visarga "H" becomes "ḥ".
 * Typing errors in the e-texts are kept; docs/CANON.md lists the ones that matter.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../src/jyotish/verses.json', import.meta.url));
const SD = 'https://sanskritdocuments.org/doc_z_misc_sociology_astrology/';
const BPHS_FILES = ['par0110', 'par1120', 'par2130', 'par3140', 'par4145', 'par4650', 'par5160', 'par6170'];
const GRETIL_SS = 'https://gretil.sub.uni-goettingen.de/gretil/corpustei/sa_sUryasiddhAnta.xml';

/** The verses the rules cite, as [chapter, first verse, last verse]. */
const WANT = {
  BPHS: [
    [3, 10, 11], [3, 19, 19], [3, 49, 58], [3, 66, 69],
    [6, 2, 17], [6, 22, 22], [6, 26, 29], [6, 31, 31], [6, 33, 33],
    [26, 3, 12],
    [27, 1, 25], [27, 32, 33],
    [29, 2, 7], [30, 2, 3], [31, 3, 8],
    [32, 1, 5], [32, 13, 17], [33, 1, 1],
    [46, 12, 16], [46, 155, 167], [46, 195, 200],
    [47, 35, 36],
    [51, 1, 2], [51, 5, 5],
    [66, 15, 16], [66, 43, 60], [66, 69, 69], [67, 1, 5], [68, 1, 6],
  ],
  BJ: [[1, 4, 4], [1, 6, 7], [1, 11, 14], [2, 15, 18], [2, 20, 20], [9, 1, 8]],
  PD: [[4, 2, 2]],
  SS: [[1, 51, 52], [1, 55, 55], [2, 64, 69], [7, 1, 1], [7, 12, 12], [7, 19, 23], [9, 2, 9], [10, 1, 1], [12, 78, 79], [14, 2, 2], [14, 9, 10], [14, 12, 16]],
};

const DIGITS = '०१२३४५६७८९';
const num = (s) => Number([...s.trim()].map((c) => (DIGITS.includes(c) ? DIGITS.indexOf(c) : c)).join(''));

/** Text of a sanskritdocuments.org page, one source line per line. */
async function sdText(name) {
  const res = await fetch(`${SD}${name}.html`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return (await res.text())
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/‍/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim());
}

/**
 * Split lines into verses. A verse ends with "॥ n॥"; its text is the lines since the
 * previous verse end. chapterOf(line) returns a chapter number for a heading line.
 */
function verses(lines, chapterOf, into, work) {
  let chapter = null;
  let buf = [];
  for (const line of lines) {
    const c = chapterOf(line);
    if (c !== null) {
      chapter = c;
      buf = [];
      continue;
    }
    if (chapter === null || !line) continue;
    const end = /॥\s*([०-९]+)\s*॥\s*$/.exec(line);
    buf.push(line);
    if (end) {
      const key = `${work} ${chapter}.${num(end[1])}`;
      // The first occurrence wins; a verse number repeated inside a chapter is a typo.
      if (!(key in into)) into[key] = buf.join('\n');
      buf = [];
    }
  }
}

const ORDINALS = [
  'प्रथम', 'द्वितीय', 'तृतीय', 'चतुर्थ', 'पञ्चम', 'षष्ट', 'सप्तम', 'अष्टम', 'नवम', 'दशम',
  'एकादशम', 'द्वादश', 'त्रयोदश', 'चतुर्दश', 'पञ्चदश', 'षोडश', 'सप्तदश', 'अष्टादश', 'एकोनविंश', 'विंश',
  'एकविंश', 'द्वाविंश', 'त्रयोविंश', 'चतुर्विंश', 'पंचविंश', 'षड्विंश', 'सप्तविंश', 'अष्टाविंश',
];
/** Headings such as "नवमोऽध्यायः". */
function ordinalChapter(line) {
  const m = /^(\S+?)ोऽध्यायः$/.exec(line);
  if (!m) return null;
  const i = ORDINALS.indexOf(m[1]);
  return i < 0 ? null : i + 1;
}
/** BPHS headings such as "अथ षोडशवर्गाध्यायः ॥ ६॥" (two have typos: "अध्ययाः", "अद्यायः"). */
function bphsChapter(line) {
  const m = /^(?:\\section\{)?अथ.*(?:ध्याय|ध्यय|द्याय)\S*\s*॥\s*([०-९]+)\s*॥/.exec(line);
  return m ? num(m[1]) : null;
}

const all = {};
for (const f of BPHS_FILES) verses(await sdText(f), bphsChapter, all, 'BPHS');
verses(await sdText('brihajjAtakam'), ordinalChapter, all, 'BJ');
verses(await sdText('phaladIpika'), ordinalChapter, all, 'PD');

// Sūrya Siddhānta, GRETIL: "9.06a: …/" and "9.06b: …//" lines.
{
  const xml = await (await fetch(GRETIL_SS)).text();
  const re = /(\d+)\.(\d+)([a-z]): ([^<\n]*)/g;
  for (const m of xml.matchAll(re)) {
    const key = `SS ${Number(m[1])}.${Number(m[2])}`;
    const half = m[4].replace(/H/g, 'ḥ').trim();
    all[key] = all[key] ? `${all[key]}\n${half}` : half;
  }
}

const out = {};
const missing = [];
for (const [work, ranges] of Object.entries(WANT)) {
  for (const [c, a, b] of ranges) {
    for (let v = a; v <= b; v++) {
      const key = `${work} ${c}.${v}`;
      if (all[key]) out[key] = all[key];
      else missing.push(key);
    }
  }
}
if (missing.length) throw new Error(`verses not found: ${missing.join(', ')}`);

const doc = {
  description: 'Sanskrit verses cited by the jyotish rules, copied verbatim from the e-texts named in scripts/fetch-verses.mjs.',
  sources: {
    BPHS: `${SD}par0110.html … par6170.html (Bṛhat Pārāśara Horā Śāstra, 97-chapter recension)`,
    BJ: `${SD}brihajjAtakam.html (Bṛhajjātaka)`,
    PD: `${SD}phaladIpika.html (Phaladīpikā)`,
    SS: `${GRETIL_SS} (Sūrya Siddhānta, IAST)`,
  },
  retrieved: new Date().toISOString().slice(0, 10),
  generator: 'packages/engine/scripts/fetch-verses.mjs',
  verses: out,
};
writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`wrote ${Object.keys(out).length} verses to ${OUT}`);
