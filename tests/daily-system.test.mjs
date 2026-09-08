import assert from "node:assert/strict";
import test from "node:test";
import { correctAnswer, normalizeFactors, normalizeNumber } from "../app/math-input.ts";
import { makeQuestion, seededRandom, skillIds, validQuestion } from "../app/math-system.ts";
import { blankProgress, completeSession, startSession } from "../app/progress.ts";

test("every supported skill generates mathematically valid questions", () => {
  for (const skill of skillIds) {
    for (let seed = 1; seed < 20; seed += 1) {
      const question = makeQuestion(skill, seededRandom(seed), seed);
      assert.equal(validQuestion(question), true, question.prompt);
      assert.equal(correctAnswer(question, Array.isArray(question.answer) ? question.answer.join(" × ") : String(question.answer)), true, question.prompt);
    }
  }
});

test("normalizes ordinary typed answers without accepting malformed values", () => {
  assert.equal(normalizeNumber(" 1,000 "), 1000);
  assert.equal(normalizeNumber("−12"), -12);
  assert.equal(Number.isNaN(normalizeNumber("12 apples")), true);
  assert.deepEqual(normalizeFactors("18 = 3 x 2 x 3"), [2, 3, 3]);
});

test("the same day resumes unfinished work and extra practice makes a new session", () => {
  const progress = blankProgress();
  const first = startSession(progress, "2026-09-08");
  const resumed = startSession(first.progress, "2026-09-08");
  const extra = startSession(first.progress, "2026-09-08", true);
  assert.equal(resumed.session.id, first.session.id);
  assert.notEqual(extra.session.id, first.session.id);
});

test("completion updates mastery and grants the next quiet collectible once", () => {
  const started = startSession(blankProgress(), "2026-09-08");
  const outcomes = started.session.questions.map((_, index) => index === 0 ? "reviewed" : "first");
  const done = completeSession(started.progress, started.session.id, outcomes);
  assert.equal(done.collectedIds[0], "bell");
  assert.equal(done.mastery[started.session.questions[0].skill].reviewed, 1);
  const expectedFirstForSecondSkill = started.session.questions
    .slice(1)
    .filter((question) => question.skill === started.session.questions[1].skill).length;
  assert.equal(done.mastery[started.session.questions[1].skill].first, expectedFirstForSecondSkill);
  assert.equal(done.sessions[0].complete, true);
});
