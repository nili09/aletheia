# Aletheia: rules for every session

## What this is

A personal jyotish instrument for Nilesh and the few friends he shares it with. Never predictive.

* Vedhashala (observatory): only verifiable truth, meaning real astronomy and quoted classical texts.
* Prayogashala (lab): jyotish ideas tested against data, with honest statistics.
* Every concept has two doors. Mantra: the classical verse and its source. Yantra: the astronomy or arithmetic behind it.

## Priority zero: authenticity

* The sky comes from the Swiss Ephemeris and its JPL-derived data files. No approximations. Never round intermediate values; round only for display.
* A silent fallback to the built-in Moshier ephemeris is a bug. Check the return flags of every call and fail loudly.
* The rules come from classical texts, in this order of authority: Brihat Parashara Hora Shastra; where it is silent or unclear, Brihat Jataka, Saravali, Phaladeepika; for Jaimini topics, the Jaimini Sutras.
* Log every rule decision in docs/CANON.md with text, chapter and verse.
* Quote Sanskrit originals and write our own English translations. Never copy modern copyrighted translations.
* If texts conflict or a rule is unclear, stop and ask Nilesh. Never guess silently. His answer goes into CANON.md.
* Every number in the UI is traceable: tapping it shows its inputs, convention and source.
* Show precision honestly: outside 1800–2400, mark results as reduced precision.
* Lab results are provisional. They never appear in Vedhashala as facts.

## Default conventions (all switchable in Settings)

Lahiri ayanamsa (Swiss Ephemeris SE_SIDM_LAHIRI) · true nodes · Vimshottari year of 365.25 days · sunrise at the upper limb with standard refraction · amanta months · whole-sign houses · North Indian chart · 8 chara karakas, Rahu counted in reverse

## Engineering rules

* packages/engine wraps a WebAssembly build of the Swiss Ephemeris in pure, deterministic TypeScript. In the app it runs inside a Web Worker.
* Tests come before features. Nothing is done until its numbers are checked against an outside reference (see docs/TESTING.md).
* Zero cost: only free, open-source tools and free services. Nothing that needs a credit card.
* Few dependencies, all well maintained.
* Mobile first: 60 fps on a mid-range Android phone. Heavy maths never runs on the main thread.
* Privacy: nothing leaves the device unless its owner said yes on the consent screen.
* After each task: run the tests, take Playwright phone screenshots of any UI change, update the docs, and commit with a clear message.

## Coding principles

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

