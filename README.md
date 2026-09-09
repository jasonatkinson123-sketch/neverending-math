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
- Gentle local mastery tracking that favors material needing review while retaining
  familiar work and occasional stretch material.
- Thirty named old-study collectibles, beginning with the brass school bell.
- Typed input is always available. Voice is optional and fails gently back to typing.
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
