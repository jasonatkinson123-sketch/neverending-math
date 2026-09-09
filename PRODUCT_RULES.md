# Neverending Math product rules

These rules are the contract for implementation and regression tests. Changes should preserve
them unless the product decision is deliberately revisited and this document is updated.

## Mathematics

- Settings determines which mathematical concepts are eligible for practice.
- Disabled skills do not appear in either the Warm-Up or Daily Challenge.
- Adaptability chooses only among currently enabled skills and tracks evidence by skill.
- Weak skills return sooner. Strong skills are spaced farther apart but return periodically.
- Confidence changes conservatively from repeated evidence; one answer never creates or removes mastery.

## Daily experience

- The loop remains **Warm-Up → Daily Challenge → Results → Reward → Study**.
- A Session is the source of truth for its eligible-skill snapshot, Warm-Up questions,
  Daily Challenge questions, checkpoint, completion state, and reward state.
- An unfinished Session resumes only while all of its stored questions remain eligible.
  Disabling a skill used by that Session supersedes it and creates a compatible Session.
- Warm-Up uses enabled multiplication and/or division facts. If both are disabled, the
  Warm-Up is omitted and the learner moves calmly to the Daily Challenge.

## Persistence

- Settings, mastery, compatible current-session progress, and collected objects survive reloads.
- Persisted data is normalized on load so older valid progress remains usable.

## Rewards

- A new user begins with an empty Objects collection.
- The first completed daily Session earns the **Old Brass School Bell**.
- At most one standard collectible is earned for a calendar day's completion.
- Extra practice can strengthen mastery but never grants another collectible.

## Input

- Typed input always works.
- Voice is an optional enhancement, never a requirement.
- Microphone failure or denial never counts as a wrong answer and never traps the learner.
