# Neverending Math

Neverending Math is a quiet, local-first daily mathematics ritual for one child.

The loop is deliberately small:

**Warm-Up → Daily Challenge → Results → a found object → The Study**

There are no accounts, grades, streaks, rankings, coins, or network services. The
browser stores progress on the device. Each completed session records a little
mastery information and prepares future review. The first completed session of a
calendar day adds one object to the collection; optional extra practice does not.

## What is in this version

- A controlled, generated question system covering multiplication and division facts,
  factors, prime factorization, GCF, LCM, negative numbers, common denominators,
  fraction concepts, exponents, square roots, and order of operations.
- A daily session model: an unfinished question resumes after a reload; a completed day remains
  special; optional extra practice is always available. Each session owns its eligible-skill
  snapshot, generated warm-up, challenge questions, checkpoint, completion, and reward state.
- Conservative skill-by-skill mastery tracking records first tries, retries,
  reviews, recent errors, confidence, recency, and a 1–14 day spacing interval.
  Daily selection mixes due review, current work, secure maintenance, and stretch.
- Settings can enable or disable individual concepts. The active concept list is
  stored on the device and strictly constrains both warm-up and challenge content.
- Warm-up uses enabled multiplication and division facts. It uses either one alone when only
  one is enabled, and is skipped when both are disabled.
- Thirty named old-study collectibles, beginning with the brass school bell.
- A new collection is empty. The first daily completion discovers the brass school
  bell; later daily completions add one object at a time.
- Typed input is always available. Once voice is started in the warm-up, recognition
  rearms between facts; denied, unsupported, or repeated failures stop cleanly and
  leave typing ready.
- Device-local persistence in localStorage; append ?reset=1 to clear this
  device's progress while testing.

## Project map

- app/math-system.ts — skill definitions and mathematically controlled generators.
- app/progress.ts — the Session source of truth, daily selection, persistence model, mastery, rewards.
- app/collectibles.ts — collectible descriptions and display glyphs.
- app/math-input.ts — answer normalization and validation.
- app/page.tsx — the existing atmospheric screens and the daily ritual.
- PRODUCT_RULES.md — product invariants that implementation and tests must preserve.
- tests/ — unit and rendered interaction checks for math validity, Settings, session resume,
  mastery, collectible progression, and output.

## Running checks

Run npm test to build the Vinext/Sites artifact and run the regression tests.

Run npm run diagnose:30-days to execute the deterministic month-long learner simulation and
print its per-skill outcome, confidence, spacing, reward, Settings, and resume diagnostics.
