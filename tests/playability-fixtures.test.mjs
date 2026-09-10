import assert from "node:assert/strict";
import test from "node:test";
import { collectibles } from "../app/collectibles.ts";
import { skillIds } from "../app/math-system.ts";
import { parseProgress } from "../app/progress.ts";
import { challengeStates, fixtureProgress, placementFixtures, representativeQuestions } from "./playability-fixtures.mjs";

test("playability fixtures cover every supported skill and challenge state", () => {
  assert.deepEqual(Object.keys(representativeQuestions).sort(), [...skillIds].sort());
  for (const question of Object.values(representativeQuestions)) assert.ok(question.prompt.length > 0);
  assert.deepEqual(challengeStates.map((state) => state.name), ["answering", "retry", "review", "prime-factor-format"]);
});

test("placement fixtures preserve a thirty-object collection and placed-object state", () => {
  const early = fixtureProgress(placementFixtures.earlyUnplacedWithThirty);
  assert.equal(early.collectedIds.length, collectibles.length);
  assert.equal(early.placedIds.includes("bell"), false);
  assert.equal(early.placedIds.includes("pen"), true);
  assert.equal(parseProgress(JSON.stringify(early)).collectedIds.length, collectibles.length);

  const placed = fixtureProgress(placementFixtures.alreadyPlacedBell);
  assert.equal(placed.placedIds.includes("bell"), true);
});
