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
  special; optional extra practice is always available.
- Conservative skill-by-skill mastery tracking records first tries, retries,
  reviews, recent errors, confidence, recency, and a 1–14 day spacing interval.
  Daily selection mixes due review, current work, secure maintenance, and stretch.
- Settings can enable or disable individual concepts. The active concept list is
  stored on the device and strictly constrains newly created sessions.
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
- app/progress.ts — daily selection, local persistence model, mastery, rewards.
- app/math-input.ts — answer normalization and validation.
- app/page.tsx — the existing atmospheric screens and the daily ritual.
- tests/ — focused checks for math validity, answer formats, session selection,
  mastery, collectible progression, and rendered output.

## Running checks

Run npm test to build the Vinext/Sites artifact and run the regression tests.
