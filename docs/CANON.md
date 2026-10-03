# Canon

Every rule decision Aletheia makes, with its source. If texts conflict or a rule is unclear, Nilesh decides and the answer is recorded here.
A row marked **source to verify** is a working default only; it is not canon until the source column cites text, chapter and verse (or a named standard).
A row marked **Awaiting Nilesh** is a reading the texts leave open or contest; its default is used meanwhile, and every result that depends on it lists the rule id in its `provisional` field (`packages/engine/src/jyotish/sources.ts`). **Unsourced** marks a convention for which no verse was found in the texts consulted.

Texts consulted, cited by the chapter and verse numbers of these e-texts. The Sanskrit is fetched verbatim by `packages/engine/scripts/fetch-verses.mjs` into `src/jyotish/verses.json`; the translations are our own, in `src/jyotish/sources.ts`.
BPHS — Bṛhat Pārāśara Horā Śāstra, 97-chapter recension, sanskritdocuments.org e-text (transliterated by Ahto Jarve; proofread by Ahto Jarve, Ginda Lass, Abhisyanta Tejaswi). BJ — Bṛhajjātaka, sanskritdocuments.org. PD — Phaladīpikā, sanskritdocuments.org. SS — Sūrya Siddhānta, GRETIL (Michio Yano), IAST. Not available as primary e-texts, so not consulted: Sārāvalī, the Jaimini Upadeśa Sūtras, Siddhānta Śiromaṇi.

| Topic | Choice | Source (text, chapter, verse or standard) | Alternatives | Date |
|---|---|---|---|---|
| Ayanamsa | Lahiri (Swiss Ephemeris `SE_SIDM_LAHIRI`): 23°15′00.658″ true at 1956-03-21 0h TT (IAE 1989 p. 556), carried into the IAU 2006 frame by a constant +0.13″ | **source to verify** | Raman, Krishnamurti (KP), Fagan/Bradley, True Chitrapaksha, Yukteshwar | 2026-10-02 |
| Lunar nodes | True nodes (osculating) | **source to verify** | Mean nodes | 2026-10-02 |
| Vimshottari dasha year | 365.25 days | **source to verify** | 360-day savana year, 365.2422-day tropical year, 365.2564-day sidereal year | 2026-10-02 |
| Sunrise definition | Upper limb of the Sun on the horizon, with standard atmospheric refraction (Sinclair formula at 1013.25 hPa scaled to altitude, 10 °C: 34.6′ at the horizon) | **source to verify** | Centre of the disc; no refraction; Hindu sunrise (centre, no refraction) | 2026-10-02 |
| Lunar month | Amanta (month ends at new moon) | **source to verify** | Purnimanta (month ends at full moon) | 2026-10-02 |
| House system | Whole-sign houses | **source to verify** | Sripati (Porphyry-type) bhava, equal houses from the ascendant degree, Placidus (KP) | 2026-10-02 |
| Chart style | North Indian (diamond, houses fixed) | **source to verify** | South Indian (signs fixed), East Indian | 2026-10-02 |
| Chara karakas | 8 karakas, Rahu included and its longitude counted in reverse (30° minus degrees in sign) | BPHS 32.1–2 (seven, “or eight ending with Rahu”; “some say seven, some eight”), 32.5 (Rahu’s degrees from 30); eight is the CLAUDE.md default | 7 karakas (Rahu excluded): see *Seven-kāraka roles* below | 2026-10-02 |
| Retrograde (vakra) and stations | A graha is retrograde when its sidereal longitude speed is negative (moving back against the stars); stations are where that speed is zero. Astronomical only: the true nodes can briefly move direct and are shown so | **source to verify** | Tropical speed (differs from sidereal by precession, a few hours near a station); nodes always treated as retrograde | 2026-10-02 |
| Nakṣatra junction stars (yogatārās) | Provisional table of common modern identifications in `packages/engine/src/stars.ts`; not to be shown in Vedhashala as fact. Disputed: Bharaṇī (41 vs 35 Ari), Ārdrā (α Ori vs γ Gem), Punarvasu (β vs α Gem), Āśleṣā (ε Hya vs α Cnc), Hasta (δ vs γ Crv), Viśākhā (α² Lib; ι Lib is not in the catalogue), Dhaniṣṭhā (β vs α Del), Uttara Bhādrapadā (γ Peg vs α And) | **source to verify**: Sūrya Siddhānta ch. 8 gives the coordinates; Nilesh to decide which identification to follow | Other identifications; derive each star from the Sūrya Siddhānta coordinates | 2026-10-02 |

## Jyotish rules (2026-10-03)

| Topic | Choice | Source (text, chapter, verse or standard) | Alternatives | Date |
|---|---|---|---|---|
| Tithi | Moon − Sun in 12° parts; 1–15 bright half, 16–30 dark half; times are the exact crossings | SS 2.66, 14.12 | — | 2026-10-03 |
| Nakṣatra and pada | Moon in 27 parts of 800′ (13°20′) from 0° sidereal; four padas of 3°20′ | SS 2.64; BJ 1.4 | — | 2026-10-03 |
| Yoga | Sun + Moon (sidereal) in 27 parts of 800′; the 27 names of the pañcāṅgas | SS 2.65 (computation); names: pañcāṅga convention | — | 2026-10-03 |
| Karaṇa | Half a tithi; seven movable karaṇas eight times from the second half of Śukla Pratipadā, four fixed ones on the last three halves and the first | SS 2.67–69 | — | 2026-10-03 |
| Fixed karaṇa order | **Awaiting Nilesh.** Default SS order: Kṛṣṇa 14 (2nd half) Śakuni, Amāvāsyā Nāga then Catuṣpada, Śukla 1 (1st half) Kiṃstughna | SS 2.67: “Śakuni, Nāga, Catuṣpada the third, Kiṃstughna” | Pañcāṅga order Śakuni, Catuṣpada, Nāga, Kiṃstughna (Drik Panchang; switch `karanaOrder`) | 2026-10-03 |
| Vāra | Sunrise to next sunrise at the place; weekday of the local civil date of sunrise | SS 1.51 (lords by weekday); BPHS 3.66 (day portions from sunrise) | SS counts days from midnight at Laṅkā | 2026-10-03 |
| Lunar month | **Awaiting Nilesh.** Amānta, new moon to new moon, named by the sidereal saṅkrānti within it (Meṣa → Caitra); none → adhika (next month’s name); two → kṣaya (both names). Pūrṇimānta: the dark half takes the next month’s name, except in an adhika month | Bhāskara II, Siddhānta Śiromaṇi (the saṅkrānti rule) — verse not yet transcribed from a primary source | SS 14.15–16: months named by the nakṣatra at full moon | 2026-10-03 |
| Saṃvatsara | **Awaiting Nilesh.** Luni-solar 60-year cycle of south India: (Śaka year + 11) mod 60 from Prabhava, changing at Caitra (2026–27 = Parābhava) | Convention | SS 14.2, 1.55: the cycle is Jupiter’s (bārhaspatya), from Vijaya — not implemented | 2026-10-03 |
| Ṛtu | **Awaiting Nilesh.** Two sidereal signs each from Makara: Śiśira, Vasanta, Grīṣma, Varṣā, Śarad, Hemanta | SS 14.10 | Tropical signs; seasons by lunar months (Drik’s “Vedic ṛtu”) | 2026-10-03 |
| Ayana | **Awaiting Nilesh.** Uttarāyaṇa from the sidereal Makara saṅkrānti | SS 14.9 | The true (tropical) solstices | 2026-10-03 |
| Gulika kāla, Yamagaṇḍa | Day (sunrise–sunset) and night each in eight parts, lords from the weekday lord (night: from the fifth), eighth lordless; Gulika = Saturn’s part, Yamaghaṇṭaka = Jupiter’s | BPHS 3.66–69 | — | 2026-10-03 |
| Rāhu kāla | **Unsourced.** An eighth of the day by weekday: Sun 8th, Mon 2nd, Tue 7th, Wed 5th, Thu 6th, Fri 4th, Sat 3rd | Modern pañcāṅga convention; no verse found in BPHS, BJ, PD, SS | — | 2026-10-03 |
| Horā lords | Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon, round and round; the first horā is the weekday lord’s | SS 12.78–79 | — | 2026-10-03 |
| Horā length | **Awaiting Nilesh.** 24 equal parts of sunrise to sunrise | SS 12.79 (24 to a day) | 12 of the day and 12 of the night (switch `hora`) | 2026-10-03 |
| Muhūrtas, abhijit | **Unsourced.** Fifteen equal parts of day and of night; abhijit = the 8th by day. Names not shown | Muhūrta works and Vedic literature, not consulted | — | 2026-10-03 |
| Sixteen vargas | D1 sign; D2 Sun/Moon horā; D3 1st, 5th, 9th; D4 kendras; D7 odd from itself, even from 7th; D9 movable/fixed/dual from itself/9th/5th; D10 odd from itself, even from 9th; D12 from itself; D16 and D45 from Meṣa/Siṃha/Dhanus; D20 from Meṣa/Dhanus/Siṃha; D24 odd Siṃha, even Karka; D27 from Meṣa, Karka, Tulā, Makara by element; D30 Mars 5° Saturn 5° Jupiter 8° Mercury 7° Venus 5° (even reversed); D40 odd Meṣa, even Tulā; D60 2 × degrees mod 12 from the sign | BPHS 6.5–33; BJ 1.6–7, 1.11 | — | 2026-10-03 |
| D2 and D3 schemes | **Awaiting Nilesh.** Parāśara’s Sun/Moon horā and 1st/5th/9th drekkāṇa | BPHS 6.5–8 | Parivṛtti horā and drekkāṇa (cyclic from Meṣa), also stated in BPHS 6.6–7; BJ 1.12 records lord/11th-lord horās and 1st/12th/11th drekkāṇas (switches `vargas.hora`, `vargas.drekkana`) | 2026-10-03 |
| D30 signs | **Awaiting Nilesh.** Odd sign → the lord’s odd sign (Meṣa, Kumbha, Dhanus, Mithuna, Tulā); even sign → its even sign (Vṛṣabha, Kanyā, Mīna, Makara, Vṛścika) | BPHS 6.27 and BJ 1.7 name only the lords | — | 2026-10-03 |
| Exaltation, debilitation, mūlatrikoṇa, own sign | Sun Meṣa 10°, Moon Vṛṣabha 3°, Mars Makara 28°, Mercury Kanyā 15°, Jupiter Karka 5°, Venus Mīna 27°, Saturn Tulā 20°; whole sign exalted, deepest at the degree; debilitation opposite. MT: Sun Siṃha 0–20°, Moon Vṛṣabha 3–30°, Mars Meṣa 0–12°, Mercury Kanyā 15–20°, Jupiter Dhanus 0–10°, Venus Tulā 0–15°, Saturn Kumbha 0–20° | BPHS 3.49–54; BJ 1.13–14 agree | — | 2026-10-03 |
| Rahu and Ketu dignities | Exalted Vṛṣabha / Vṛścika, MT Mithuna / Dhanus, own Kumbha / Vṛścika, whole signs; no friendships | BPHS 47.35–36 | Own Kanyā / Mīna (“some”, 47.36) | 2026-10-03 |
| Friendship | Natural: computed from the rule (lords of 2, 4, 5, 8, 9, 12 from MT and of exaltation are friends, of the rest enemies, both neutral) — reproduces BJ 2.16–17 exactly. Temporal: 2, 3, 4, 10, 11, 12 apart. Compound per 3.57–58 | BPHS 3.55–58; BJ 2.15–18 | — | 2026-10-03 |
| Cruel and gentle | **Awaiting Nilesh.** Sun, Mars, Saturn, Rahu, Ketu cruel; the Moon cruel while less than half lit (elongation < 90° or > 270°); Mercury cruel in the same sign as a cruel graha (not the Moon) | BPHS 3.11 (no threshold given) | Moon cruel through the whole dark half; or within 72° of the Sun; Mercury by aspect too | 2026-10-03 |
| Combustion | **Awaiting Nilesh.** Arcs Moon 12°, Mars 17°, Mercury 14° (12° retrograde), Jupiter 11°, Venus 10° (8° retrograde), Saturn 15°, measured as kālāṃśa: sidereal-time degrees between the risings (graha behind the Sun) or settings (ahead) at the observer’s latitude, from apparent RA and declination; undefined when circumpolar | SS 9.2–9, 10.1 (BPHS, BJ, PD give no arcs) | Ecliptic longitude difference (common software; switch `combustion`). Example: Delhi 1990-05-17 10:00 IST, Mercury 18.1° from the Sun in longitude but 12.6° in kālāṃśa | 2026-10-03 |
| Graha yuddha | **Awaiting Nilesh.** Only Mars, Mercury, Jupiter, Venus, Saturn; at war when < 1° apart on the sky; victor = greater ecliptic latitude (north) | SS 7.1, 7.12, 7.19–21; BJ 2.20; PD 4.2 | Longitude difference < 1°; SS 7.21 lets a brighter southern graha win and 7.23 says Venus mostly wins — reported, not applied (no magnitudes in the engine) | 2026-10-03 |
| Precise aspect | Piecewise in the arc from aspecting to aspected, with the special rules for Saturn, Mars, Jupiter | BPHS 26.6–12 | — | 2026-10-03 |
| Ṣaḍbala | Six components in virūpas: sthāna (uccha, saptavargaja 45/30/20/15/10/4/2, ojayugma, kendrādi 60/30/15, drekkāṇa), dik, kāla (natonnata, pakṣa, tribhāga, abda 15, māsa 30, vāra 45, horā 60, ayana, yuddha), ceṣṭā, naisargika 60/7 × 7…1, dṛk; minimums 390, 360, 300, 420, 390, 330, 300. The Moon’s pakṣa bala and the Sun’s ayana bala are not doubled (this text does not say so) | BPHS 27.1–25, 27.32–33; genders BPHS 3.19 | Books that double them | 2026-10-03 |
| Saptavargaja: mūlatrikoṇa | **Awaiting Nilesh.** MT (45) only in D1; in other vargas the MT sign counts as own (30) | BPHS 27.2–4 lists MT for all seven vargas | MT in every varga | 2026-10-03 |
| Dik bala points | **Awaiting Nilesh.** 1st = ascendant, 4th = MC + 180°, 7th = ascendant + 180°, 10th = MC (sidereal) | BPHS 27.7–8 | Middles of whole-sign houses | 2026-10-03 |
| Natonnata | **Awaiting Nilesh.** Distance from midnight by the Sun’s hour angle (apparent solar time), 6° = 1 ghaṭī; Moon/Mars/Saturn 2 × (30 − ghaṭīs from midnight), Sun/Jupiter/Venus 60 − that, Mercury 60 | BPHS 27.8–9 (terse in this e-text) | Midnight as the middle of the night; mean time | 2026-10-03 |
| Abda and māsa lords | **Awaiting Nilesh.** SS day-count from creation: 714 402 296 627 days at the Kali epoch (Friday, JDN 588 466); year lord rules day 360⌊A/360⌋, month lord day 30⌊A/30⌋ | SS 1.51–52 (BPHS 27.13 does not say how) | Day counts from the Kali epoch (Raman) | 2026-10-03 |
| Ayana bala | **Awaiting Nilesh.** (90 ± khaṇḍa sum) ÷ 3, khaṇḍas 45, 33, 12 over the bhuja of the tropical longitude, linear between; + north for Sun, Mars, Jupiter, Venus, + south for Moon, Saturn, Mercury always + | BPHS 27.15–17 (the 90 is implied) | Exact 90 sin λ; true declination (24° ± δ)/48 × 60; PD 4.2 puts Mercury with the southern group | 2026-10-03 |
| Ceṣṭā bala | **Awaiting Nilesh.** Sun = its ayana bala, Moon = its pakṣa bala; Mars–Saturn by the ceṣṭā kendra: śīghrocca − (mean + true)/2, ÷ 3; mean longitudes from Meeus, Astronomical Algorithms, Table 31.A | BPHS 27.18, 27.24–25 | The eight-motion table of 27.21–23 (no speed thresholds given); Sūrya Siddhānta mean motions | 2026-10-03 |
| Dṛk bala | **Awaiting Nilesh.** + ¼ of gentle grahas’ aspects, − ¼ of cruel grahas’, Mercury’s and Jupiter’s in full | BPHS 27.19 | Mercury and Jupiter at ¼ like the others, or added in addition | 2026-10-03 |
| Yuddha bala | **Awaiting Nilesh.** The difference of the two totals (all other components) moves from vanquished to victor | BPHS 27.20 | — | 2026-10-03 |
| Aṣṭakavarga tables | **Awaiting Nilesh.** BPHS 66 as transcribed. It differs from BJ 9 in four marks (equal totals): Moon’s table — the Moon gives the 9th, Mars not the 9th, Jupiter the 2nd not the 12th; Venus’s table — Mars the 4th not the 5th. BPHS lists each table twice (karaṇa and sthāna) and both agree; its Venus 4th-house karaṇa count (66.35–36) contradicts its own list (66.37) | BPHS 66.16–60; BJ 9.1–7 | BJ tables (the standard modern ones; switch `ashtakavarga`) | 2026-10-03 |
| Trikoṇa śodhana | Subtract the least of each triangle from all three | BPHS 67.1–5 | — | 2026-10-03 |
| Ekādhipatya śodhana | **Awaiting Nilesh** (occupants only). Pairs of one lord except Karka/Siṃha; cases of 68.2–5; “occupied” = holds one of the seven grahas | BPHS 68.1–6 | Rahu and Ketu counting as occupants | 2026-10-03 |
| Seven-kāraka roles | **Awaiting Nilesh.** Ātma, amātya, bhrātṛ, mātṛ (= putra), pitṛ, jñāti, dāra | BPHS 32.16 (“others say the mātṛkāraka is the putrakāraka too”) | Drop the pitṛkāraka (common in modern books). Ties to the arcsecond (32.16–17) are reported, not resolved | 2026-10-03 |
| Ārūḍha padas | As far beyond the lord as the lord is from the house; landing on the house → its 10th; on its 7th → its 4th (from the house, as the worked example of 29.5 requires) | BPHS 29.2–5 | — | 2026-10-03 |
| Signs with two lords | **Awaiting Nilesh.** Vṛścika: Mars, Ketu; Kumbha: Saturn, Rahu. Tests in order: both in the sign → 12 years; one in the sign → the other; one exalted → it; more grahas with it; dual > fixed > movable sign; more years (for padas: farther); tie → Mars / Saturn. Used for cara daśā and for padas | BPHS 46.157–164; 29.7 (“up to the stronger”) | The place of the exaltation test (46.164) in the order is not stated | 2026-10-03 |
| Upapada | **Awaiting Nilesh.** The pada of the 12th | BPHS 30.2–3 (“of the one that attends on the first house”) | The 2nd (a literal reading of anucara) | 2026-10-03 |
| Kārakāṃśa | Navāṃśa sign of the ātmakāraka | BPHS 33.1 | — | 2026-10-03 |
| Argalā | **Awaiting Nilesh** (two cases). 2nd, 4th, 11th, 5th hold; 12th, 10th, 3rd, 9th obstruct; Rahu and Ketu counted backwards; fewer obstructors → argalā prevails; more → obstructed; equal → left undecided; cruel grahas in the 3rd reported for viparīta argalā, not judged | BPHS 31.3–8 | A strength test for equal counts; a count for “in excess” | 2026-10-03 |
| Viṃśottarī | From Kṛttikā thrice: Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19, Mercury 17, Ketu 7, Venus 20; balance = years × fraction of the nakṣatra’s **arc** remaining; sub-periods from the period’s own lord in proportion, to five levels; instants in TT | BPHS 46.12–16, 51.1–2; SS 2.64 (bhabhoga = 800′ of arc) | Fraction of the nakṣatra’s duration in time | 2026-10-03 |
| Yoginī | Maṅgalā (Moon) 1, Piṅgalā (Sun) 2, Dhanyā (Jupiter) 3, Bhrāmarī (Mars) 4, Bhadrikā (Mercury) 5, Ulkā (Saturn) 6, Siddhā (Venus) 7, Saṅkaṭā (Rahu) 8; first = (nakṣatra number + 3) mod 8; sub-periods as Viṃśottarī | BPHS 46.195–200, 51.1–2 | — | 2026-10-03 |
| Cara daśā | **Awaiting Nilesh** (parts). Twelve signs from the lagna, forward if the 9th is in an odd pada (Meṣa–Mithuna, Tulā–Dhanus), else backward; years = signs from the sign to its lord (forward in odd padas, backward in even), 12 if in the sign, +1 if the lord is exalted, −1 if debilitated; from birth, no balance. Sub-periods and the second cycle not computed | BPHS 46.155–167 | 46.165 read as “any exalted graha in the sign”; antardaśās of 51.5 vs 51.6–11 | 2026-10-03 |

## Open decisions for Nilesh

Each is used with its default meanwhile and listed in `provisional` on every result that depends on it.

1. Fixed karaṇa order: SS 2.67 (Nāga before Catuṣpada) or the pañcāṅgas’ (Catuṣpada before Nāga)?
2. Lunar month naming and adhika/kṣaya: accept Bhāskara’s saṅkrānti rule (needs a primary text of Siddhānta Śiromaṇi to quote), or SS 14.15–16’s full-moon nakṣatra?
3. Saṃvatsara: luni-solar (south) or Jupiter’s cycle (SS 14.2, 1.55; north)? Implementing the bārhaspatya count needs a decision on mean Jupiter.
4. Ṛtu and ayana: sidereal saṅkrāntis (literal SS) or the true solstices?
5. Rāhu kāla and muhūrtas: accept as unsourced conventions, or name a text (e.g. Muhūrta Cintāmaṇi) to fetch and cite?
6. Horā: equal or unequal?
7. D2/D3: Parāśara’s or parivṛtti as default? D30: confirm the sign mapping.
8. Waning Moon and Mercury’s company (BPHS 3.11): which thresholds?
9. Combustion: the Sūrya Siddhānta is outside the authority list — accept it? Kālāṃśa (literal) or longitude?
10. Graha yuddha: sky distance or longitude; how to treat SS 7.21’s brightness clause and 7.23’s Venus clause?
11. Ṣaḍbala: MT in vargas; dik points; midnight; the SS epoch for abda/māsa lords; the implied 90 and the khaṇḍa interpolation in ayana bala; mean longitudes for ceṣṭā; dṛk bala reading.
12. Aṣṭakavarga: BPHS (this recension) or BJ tables? Do Rahu and Ketu occupy signs for ekādhipatya?
13. Seven kārakas: merge mātṛ with putra (BPHS 32.16) or drop pitṛ?
14. Two-lord tests: where exaltation sits in the order; same tests for padas?
15. Upapada: 12th (tradition) or 2nd?
16. Argalā: a strength test for equal counts; how many cruel grahas in the 3rd make viparīta argalā?
17. Cara daśā: which antardaśā order (51.5 or 51.6–11), whether to compute a second cycle, and the reading of 46.165.
18. Drik Panchang’s Lahiri differs from ours by about 15–20″ (yoga ends up to 135 s apart): keep SE_SIDM_LAHIRI (matches IAE 1989 to 0.008″)? The yoga test stays failing until decided.
19. The BPHS e-text (97-chapter recension): is this the edition to cite? Its numbering differs from Santhanam’s and Sharma’s in places, and it has typing errors (e.g. 27.13 “वष” for “वर्ष”, 32.4 first line corrupt, 66.52 “शक्र”).
