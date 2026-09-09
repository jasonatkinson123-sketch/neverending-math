import assert from "node:assert/strict";
import test from "node:test";
import { collectibles } from "../app/collectibles.ts";
import { skillIds } from "../app/math-system.ts";
import { runThirtyDaySimulation } from "../scripts/thirty-day-simulation.mjs";

test("one learner can complete 30 deterministic days through production state transitions", () => {
  const result = runThirtyDaySimulation();

  assert.equal(result.dailySessions, 30);
  assert.equal(result.extraSessions, 1);
  assert.equal(result.totalQuestions, 31 * 12);
  assert.equal(result.outcomes.first + result.outcomes.retry + result.outcomes.reviewed, result.totalQuestions);
  assert.equal(result.collectibles, 30);
  assert.deepEqual(result.finalProgress.collectedIds, collectibles.map(([id]) => id));
  assert.equal(new Set(result.finalProgress.collectedIds).size, 30);
  assert.equal(result.finalProgress.sessions.filter((session) => session.complete).length, 31);
  assert.equal(result.finalProgress.sessions.filter((session) => session.extra && session.rewardId).length, 0);
  assert.equal(result.finalProgress.activeSkills.includes("squareRoots"), true);
  assert.ok(result.skills.squareRoots.questions > 0, "re-enabled square roots should become eligible again");
  assert.ok(result.outcomes.first > 0 && result.outcomes.retry > 0 && result.outcomes.reviewed > 0, "learner profile should exercise all outcome paths");

  for (const skill of skillIds) {
    assert.ok(result.skills[skill].questions > 0, `${skill} should appear during the month`);
    assert.ok(Number.isFinite(result.skills[skill].confidence), `${skill} confidence should survive persistence`);
    assert.ok(result.skills[skill].intervalDays >= 1 && result.skills[skill].intervalDays <= 14, `${skill} interval should remain valid`);
    assert.match(result.skills[skill].nextDue, /^2026-\d{2}-\d{2}$/);
  }

  const secureNotDue = Object.values(result.skills).reduce((total, skill) => total + skill.secureNotDueAppearances, 0);
  assert.ok(secureNotDue < 50, `secure, not-due maintenance should be limited; saw ${secureNotDue} appearances`);
  assert.ok(result.skills.squareRoots.intervalDays <= 2, "persistently weak square roots should remain closely spaced");
  assert.ok(result.skills.fractions.intervalDays <= 2, "weak fractions should remain closely spaced");
  assert.ok(result.skills.commonDenominators.intervalDays <= 2, "weak common denominators should remain closely spaced");
  assert.ok(Math.max(...Object.values(result.skills).map(skill => skill.questions)) <= 65, "no skill should dominate the month");
});
