import assert from "node:assert/strict";
import test from "node:test";
import { correctAnswer, normalizeFactors, normalizeNumber } from "../app/math-input.ts";
import { makeQuestion, seededRandom, skillIds, validQuestion } from "../app/math-system.ts";
import { blankProgress, chooseSkills, completeSession, masteryPriority, parseProgress, setSkillEnabled, startSession, updateMastery } from "../app/progress.ts";

test("every supported skill generates mathematically valid questions", () => {
  for (const skill of skillIds) {
    for (let seed = 1; seed < 20; seed += 1) {
      const question = makeQuestion(skill, seededRandom(seed), seed);
      assert.equal(validQuestion(question), true, question.prompt);
      const canonical = question.input === "oneOf" ? String(question.answer[0]) : Array.isArray(question.answer) ? question.answer.join(" × ") : String(question.answer);
      assert.equal(correctAnswer(question, canonical), true, question.prompt);
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
  assert.deepEqual(completeSession(done, started.session.id, outcomes), done, "completion is idempotent");
});

test("extra practice strengthens mastery without farming daily objects", () => {
  const daily = startSession(blankProgress(), "2026-09-08");
  const firstDone = completeSession(daily.progress, daily.session.id, daily.session.questions.map(() => "first"));
  const extra = startSession(firstDone, "2026-09-08", true);
  const extraDone = completeSession(extra.progress, extra.session.id, extra.session.questions.map(() => "first"));
  assert.equal(extraDone.collectedIds.length, 1);
  assert.equal(extraDone.sessions.at(-1).rewardId, undefined);
});

test("factor prompts accept every mathematically valid internal factor", () => {
  const question = makeQuestion("factors", seededRandom(7), 1);
  for (const factor of question.answer) assert.equal(correctAnswer(question, String(factor)), true);
  assert.equal(correctAnswer(question, "1"), false);
});

test("mastery changes conservatively and spaces repeated success", () => {
  const progress = blankProgress();
  const question = makeQuestion("multiplication", seededRandom(3), 1);
  const afterOne = updateMastery(progress.mastery, [question], ["first"], "2026-09-01");
  assert.ok(afterOne.multiplication.confidence > .35 && afterOne.multiplication.confidence < .6);
  let mastery = afterOne;
  for (let day = 2; day <= 9; day += 1) mastery = updateMastery(mastery, [question], ["first"], `2026-09-${String(day).padStart(2,"0")}`);
  assert.ok(mastery.multiplication.confidence > .75);
  assert.ok(mastery.multiplication.intervalDays > afterOne.multiplication.intervalDays);
});

test("reviewed work becomes higher priority and returns sooner by skill", () => {
  const progress = blankProgress();
  const multiply = makeQuestion("multiplication", seededRandom(4), 1);
  const negatives = makeQuestion("negatives", seededRandom(5), 1);
  let mastery = progress.mastery;
  for (let day = 1; day <= 7; day += 1) mastery = updateMastery(mastery, [multiply], ["first"], `2026-08-0${day}`);
  mastery = updateMastery(mastery, [negatives, negatives], ["reviewed", "reviewed"], "2026-08-07");
  assert.ok(masteryPriority(mastery.negatives, "2026-08-09") > masteryPriority(mastery.multiplication, "2026-08-09"));
  const selected = chooseSkills(mastery, "2026-08-09", 8, ["multiplication", "negatives"]);
  assert.ok(selected.filter(skill => skill === "negatives").length >= selected.filter(skill => skill === "multiplication").length);
});

test("active concept settings persist and strictly constrain future sessions", () => {
  let progress = blankProgress();
  progress = setSkillEnabled(progress, "squareRoots", false);
  assert.equal(progress.activeSkills.includes("squareRoots"), false, "a concept can be disabled");
  const restored = parseProgress(JSON.stringify(progress));
  assert.deepEqual(restored.activeSkills, progress.activeSkills);
  const started = startSession(restored, "2026-09-12");
  assert.ok(started.session.questions.every(question => question.skill !== "squareRoots"));
  assert.equal(started.session.questions.length, 12, "a partial selection still makes a complete session");
});

test("changing Settings replaces an incompatible unfinished session", () => {
  const original = startSession(blankProgress(), "2026-09-14");
  const disabledSkill = original.session.questions[0].skill;
  const changed = setSkillEnabled(original.progress, disabledSkill, false);
  const restarted = startSession(changed, "2026-09-14");
  assert.notEqual(restarted.session.id, original.session.id);
  assert.equal(restarted.progress.sessions.find(session => session.id === original.session.id).superseded, true);
  assert.ok(restarted.session.questions.every(question => question.skill !== disabledSkill));
});

test("re-enabling a concept allows it back into generated sessions", () => {
  let progress = { ...blankProgress(), activeSkills: ["multiplication"] };
  progress = setSkillEnabled(progress, "squareRoots", true);
  progress = setSkillEnabled(progress, "multiplication", false);
  const started = startSession(progress, "2026-09-15");
  assert.ok(started.session.questions.every(question => question.skill === "squareRoots"));
});

test("the final active concept cannot be disabled", () => {
  const progress = { ...blankProgress(), activeSkills: ["division"] };
  assert.deepEqual(setSkillEnabled(progress, "division", false).activeSkills, ["division"]);
});

test("a new collection is empty and the first daily reward is the bell", () => {
  const fresh = blankProgress();
  assert.deepEqual(fresh.collectedIds, []);
  const started = startSession(fresh, "2026-09-13");
  const done = completeSession(started.progress, started.session.id, started.session.questions.map(() => "first"));
  assert.deepEqual(done.collectedIds, ["bell"]);
});
