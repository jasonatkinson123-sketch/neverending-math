import assert from "node:assert/strict";
import test from "node:test";
import { correctAnswer, normalizeFactors, normalizeNumber } from "../app/math-input.ts";
import { makeQuestion, seededRandom, skillIds, validQuestion, warmupFor } from "../app/math-system.ts";
import { questionDisplay, questionDisplayClass } from "../app/question-display.ts";
import { blankProgress, checkpointSession, chooseSkills, completeSession, masteryPriority, parseProgress, sessionIsCompatible, setSkillEnabled, startSession, updateMastery } from "../app/progress.ts";

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

test("every generated skill receives a safe question display treatment", () => {
  for (const skill of skillIds) {
    for (let seed = 0; seed < 100; seed += 1) {
      const question = makeQuestion(skill, seededRandom(seed), seed);
      assert.ok(["expression", "sentence", "sentence-long"].includes(questionDisplay(question)), question.prompt);
      assert.match(questionDisplayClass(question), /^challenge-(expression|sentence|sentence-long)$/);
    }
  }
  assert.equal(questionDisplay({ skill: "multiplication", prompt: "12 × 12 = ?" }), "expression");
  assert.equal(questionDisplay({ skill: "primeFactors", prompt: "List the prime factors of 42." }), "sentence");
  assert.equal(questionDisplay({ skill: "commonDenominators", prompt: "What is the least common denominator for 1/6 and 1/8?" }), "sentence-long");
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

test("the session owns its stable warm-up and challenge content", () => {
  const started = startSession(blankProgress(), "2026-09-08");
  assert.equal(started.session.warmups.length, 8);
  assert.deepEqual(started.session.eligibleSkills, started.progress.activeSkills);
  const restored = parseProgress(JSON.stringify(started.progress));
  const resumed = startSession(restored, "2026-09-08");
  assert.deepEqual(resumed.session.warmups, started.session.warmups);
  assert.deepEqual(resumed.session.questions, started.session.questions);
});

test("warm-up respects enabled fluency skills and skips when both are disabled", () => {
  const divisionOnly = warmupFor("2026-09-08", 1, ["division", "fractions"]);
  assert.equal(divisionOnly.length, 8);
  assert.ok(divisionOnly.every((question) => question.skill === "division"));

  const noFluency = { ...blankProgress(), activeSkills: ["fractions", "squareRoots"] };
  const started = startSession(noFluency, "2026-09-08");
  assert.deepEqual(started.session.warmups, []);
  assert.equal(started.session.checkpoint.phase, "challengeIntro");
  assert.ok(started.session.questions.every((question) => noFluency.activeSkills.includes(question.skill)));
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

test("new concepts are introduced gradually and ordinary duplication is bounded", () => {
  const selected = chooseSkills(blankProgress().mastery, "2026-09-09", 1);
  const introduced = new Set(selected);
  assert.equal(selected.length, 12);
  assert.ok(introduced.size <= 3, "only three unseen concepts may be introduced in one session");
  for (const skill of introduced) assert.ok(selected.filter(item => item === skill).length <= 4, `${skill} should not dominate the first session`);

  let mastery = blankProgress().mastery;
  const questions = selected.map((skill, index) => makeQuestion(skill, seededRandom(index + 20), index));
  mastery = updateMastery(mastery, questions, questions.map(() => "first"), "2026-09-09");
  const next = chooseSkills(mastery, "2026-09-10", 2);
  const newlySeen = new Set(next.filter(skill => mastery[skill].seen === 0));
  assert.ok(newlySeen.size <= 1, "later sessions introduce at most one unseen concept");
});

test("same-day reviewed evidence keeps a short interval despite a later success", () => {
  const progress = blankProgress();
  const question = makeQuestion("fractions", seededRandom(9), 1);
  const mixed = updateMastery(progress.mastery, [question, question, question], ["reviewed", "retry", "first"], "2026-09-09");
  assert.equal(mixed.fractions.intervalDays, 1);
  assert.equal(mixed.fractions.nextDue, "2026-09-10");
  assert.ok(mixed.fractions.confidence < .4);
});

test("repeated retry success stays on short spacing", () => {
  const progress = blankProgress();
  const question = makeQuestion("negatives", seededRandom(11), 1);
  const retried = updateMastery(progress.mastery, [question, question, question], ["retry", "retry", "retry"], "2026-09-09");
  assert.ok(retried.negatives.intervalDays <= 2);
  assert.ok(retried.negatives.confidence < .5);
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

test("a Settings change also checks stored warm-up eligibility", () => {
  const original = startSession(blankProgress(), "2026-09-16");
  const changed = setSkillEnabled(original.progress, "multiplication", false);
  assert.equal(sessionIsCompatible(original.session, changed.activeSkills), false);
  const restarted = startSession(changed, "2026-09-16");
  assert.notEqual(restarted.session.id, original.session.id);
  assert.ok(restarted.session.warmups.every((question) => question.skill === "division"));
  assert.ok([...restarted.session.warmups, ...restarted.session.questions].every((question) => question.skill !== "multiplication"));
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

test("persistence retains mastery and a precise interruption checkpoint", () => {
  const started = startSession(blankProgress(), "2026-09-17");
  const checkpointed = checkpointSession(started.progress, started.session.id, { phase: "challenge", warmIndex: 7, questionIndex: 4, outcomes: ["first", "retry", "reviewed", "first"] });
  const restored = parseProgress(JSON.stringify(checkpointed));
  const resumed = startSession(restored, "2026-09-17");
  assert.deepEqual(resumed.session.checkpoint, checkpointed.sessions[0].checkpoint);
  assert.deepEqual(resumed.session.questions, started.session.questions);
});

test("legacy checkpoints load as an answer-ready session and new checkpoints retain retry state", () => {
  const started = startSession(blankProgress(), "2026-09-19");
  const legacy = {
    ...started.progress,
    sessions: started.progress.sessions.map((session) => session.id === started.session.id ? {
      ...session,
      checkpoint: { phase: "challenge", warmIndex: 8, questionIndex: 2, outcomes: ["first", "retry"] },
    } : session),
  };
  const restoredLegacy = parseProgress(JSON.stringify(legacy));
  assert.deepEqual(restoredLegacy.sessions[0].checkpoint, { phase: "challenge", warmIndex: 8, questionIndex: 2, outcomes: ["first", "retry"], attempts: 0, answerState: "answering" });

  const retry = checkpointSession(started.progress, started.session.id, { phase: "challenge", warmIndex: 8, questionIndex: 2, outcomes: ["first", "retry"], attempts: 1, answerState: "retry" });
  assert.deepEqual(parseProgress(JSON.stringify(retry)).sessions[0].checkpoint, retry.sessions[0].checkpoint);
});

test("obsolete sessions cannot checkpoint, complete, or earn a reward", () => {
  const started = startSession(blankProgress(), "2026-09-20");
  const disabled = started.session.questions[0].skill;
  const changed = setSkillEnabled(started.progress, disabled, false);
  const replacement = startSession(changed, "2026-09-20");
  const staleCheckpoint = checkpointSession(replacement.progress, started.session.id, { phase: "results", warmIndex: 8, questionIndex: 11, outcomes: started.session.questions.map(() => "first") });
  assert.deepEqual(staleCheckpoint, replacement.progress);
  assert.deepEqual(completeSession(staleCheckpoint, started.session.id, started.session.questions.map(() => "first")), staleCheckpoint);
});

test("disabled-skill mastery is untouched by an enabled-only session", () => {
  let progress = blankProgress();
  progress = setSkillEnabled(progress, "squareRoots", false);
  const before = structuredClone(progress.mastery.squareRoots);
  const started = startSession(progress, "2026-09-18");
  const completed = completeSession(started.progress, started.session.id, started.session.questions.map(() => "first"));
  assert.deepEqual(completed.mastery.squareRoots, before);
});

test("a new collection is empty and the first daily reward is the bell", () => {
  const fresh = blankProgress();
  assert.deepEqual(fresh.collectedIds, []);
  const started = startSession(fresh, "2026-09-13");
  const done = completeSession(started.progress, started.session.id, started.session.questions.map(() => "first"));
  assert.deepEqual(done.collectedIds, ["bell"]);
});
