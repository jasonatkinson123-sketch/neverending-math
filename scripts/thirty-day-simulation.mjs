import { pathToFileURL } from "node:url";
import { collectibles } from "../app/collectibles.ts";
import { correctAnswer } from "../app/math-input.ts";
import { skillIds, skillNames, validQuestion } from "../app/math-system.ts";
import {
  blankProgress,
  checkpointSession,
  completeSession,
  parseProgress,
  setSkillEnabled,
  startSession,
} from "../app/progress.ts";

const START_DATE = "2026-01-01";
const SETTINGS_SKILL = "squareRoots";

const profiles = {
  multiplication: ["first", "first", "first", "first", "retry"],
  division: ["first", "first", "first", "retry", "first"],
  factors: ["first", "first", "retry", "first"],
  primeFactors: ["first", "retry", "first", "first"],
  gcf: ["first", "first", "retry", "first"],
  lcm: ["first", "retry", "first", "first"],
  negatives: ["retry", "first", "reviewed", "retry", "first"],
  commonDenominators: ["reviewed", "retry", "first", "retry", "reviewed"],
  fractions: ["retry", "reviewed", "retry", "first", "reviewed"],
  squareRoots: ["reviewed", "retry", "reviewed", "retry", "first"],
  orderOfOperations: ["first", "retry", "reviewed", "first", "retry"],
};

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function addDays(date, amount) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function canonicalAnswer(question) {
  if (question.input === "oneOf") return String(question.answer[0]);
  return Array.isArray(question.answer) ? question.answer.join(" × ") : String(question.answer);
}

function outcomeFor(skill, day, encounter) {
  if (skill === "exponents") {
    const improving = day < 9 ? ["reviewed", "retry", "retry"] : day < 19 ? ["retry", "first", "retry"] : ["first", "first", "retry"];
    return improving[encounter % improving.length];
  }
  const profile = profiles[skill];
  return profile[(encounter + day - 1) % profile.length];
}

function persistedState(progress) {
  return {
    activeSkills: progress.activeSkills,
    mastery: progress.mastery,
    sessions: progress.sessions.map(({ id, dateKey, serial, eligibleSkills, warmups, questions, complete, extra, superseded, rewardId, checkpoint }) => ({
      id, dateKey, serial, eligibleSkills, warmups, questions, complete, extra: Boolean(extra), superseded: Boolean(superseded), rewardId: rewardId ?? null, checkpoint: checkpoint ?? null,
    })),
    collectedIds: progress.collectedIds,
    placedIds: progress.placedIds,
  };
}

function validateSession(session, activeSkills) {
  invariant(session.questions.length === 12, `${session.id}: expected 12 challenge questions`);
  for (const question of [...session.warmups, ...session.questions]) {
    invariant(activeSkills.includes(question.skill), `${session.id}: disabled skill ${question.skill} appeared`);
    invariant(validQuestion(question), `${session.id}: invalid generated question ${question.prompt}`);
    invariant(correctAnswer(question, canonicalAnswer(question)), `${session.id}: canonical answer rejected for ${question.prompt}`);
  }
}

function formatSummary(summary) {
  const lines = [
    "Neverending Math — deterministic 30-day diagnostic",
    `Daily sessions: ${summary.dailySessions}; extra sessions: ${summary.extraSessions}`,
    `Questions: ${summary.totalQuestions} challenge + ${summary.totalWarmups} warm-up`,
    `Outcomes: ${summary.outcomes.first} first / ${summary.outcomes.retry} retry / ${summary.outcomes.reviewed} reviewed`,
    `Collectibles: ${summary.collectibles} distinct`,
    "",
    "Skill                         Questions  First  Retry  Reviewed  Confidence  Interval",
  ];
  for (const skill of skillIds) {
    const row = summary.skills[skill];
    lines.push(`${skillNames[skill].padEnd(29)} ${String(row.questions).padStart(9)}  ${String(row.first).padStart(5)}  ${String(row.retry).padStart(5)}  ${String(row.reviewed).padStart(8)}  ${row.confidence.toFixed(2).padStart(10)}  ${String(row.intervalDays).padStart(8)}d`);
  }
  lines.push("", "Adaptive findings:");
  for (const finding of summary.findings) lines.push(`- [${finding.code}] ${finding.message}`);
  return lines.join("\n");
}

export function runThirtyDaySimulation() {
  let progress = blankProgress();
  const encounters = Object.fromEntries(skillIds.map((skill) => [skill, 0]));
  const skills = Object.fromEntries(skillIds.map((skill) => [skill, { questions: 0, first: 0, retry: 0, reviewed: 0, days: [], errorDays: [], secureNotDue: 0 }]));
  const outcomes = { first: 0, retry: 0, reviewed: 0 };
  let totalQuestions = 0;
  let totalWarmups = 0;
  let resumeVerified = false;
  let extraSessions = 0;
  let disabledMastery;

  invariant(progress.collectedIds.length === 0, "Day 0 collection must be empty");

  for (let day = 1; day <= 30; day += 1) {
    const date = addDays(START_DATE, day - 1);
    if (day === 10) {
      progress = setSkillEnabled(progress, SETTINGS_SKILL, false);
      disabledMastery = structuredClone(progress.mastery[SETTINGS_SKILL]);
      invariant(!progress.activeSkills.includes(SETTINGS_SKILL), "Settings did not disable square roots");
    }
    if (day === 15) {
      invariant(JSON.stringify(progress.mastery[SETTINGS_SKILL]) === JSON.stringify(disabledMastery), "Disabled mastery changed before re-enable");
      progress = setSkillEnabled(progress, SETTINGS_SKILL, true);
      invariant(progress.activeSkills.includes(SETTINGS_SKILL), "Settings did not re-enable square roots");
      invariant(JSON.stringify(progress.mastery[SETTINGS_SKILL]) === JSON.stringify(disabledMastery), "Re-enable lost prior mastery");
    }

    const beforeMastery = structuredClone(progress.mastery);
    const beforeRewards = progress.collectedIds.length;
    let started = startSession(progress, date);
    progress = started.progress;
    validateSession(started.session, progress.activeSkills);
    totalWarmups += started.session.warmups.length;
    totalQuestions += started.session.questions.length;

    const sessionOutcomes = started.session.questions.map((question) => {
      const outcome = outcomeFor(question.skill, day, encounters[question.skill]++);
      const entryBefore = beforeMastery[question.skill];
      if (entryBefore.seen > 0 && entryBefore.confidence >= .72 && entryBefore.nextDue && entryBefore.nextDue > date) skills[question.skill].secureNotDue += 1;
      const row = skills[question.skill];
      row.questions += 1;
      row[outcome] += 1;
      row.days.push(day);
      if (outcome !== "first") row.errorDays.push(day);
      outcomes[outcome] += 1;
      return outcome;
    });

    if (day === 7) {
      const checkpoint = { phase: "challenge", warmIndex: started.session.warmups.length, questionIndex: 4, outcomes: sessionOutcomes.slice(0, 4), attempts: 0, answerState: "answering" };
      progress = checkpointSession(progress, started.session.id, checkpoint);
      const storedQuestions = structuredClone(started.session.questions);
      const restored = parseProgress(JSON.stringify(progress));
      started = startSession(restored, date);
      invariant(started.session.id === progress.sessions.at(-1).id, "Interrupted session did not resume by id");
      invariant(JSON.stringify(started.session.questions) === JSON.stringify(storedQuestions), "Interrupted session regenerated its questions");
      invariant(JSON.stringify(started.session.checkpoint) === JSON.stringify(checkpoint), "Interrupted checkpoint was not restored");
      progress = started.progress;
      resumeVerified = true;
    }

    progress = completeSession(progress, started.session.id, sessionOutcomes);
    invariant(progress.collectedIds.length === beforeRewards + 1, `Day ${day}: expected exactly one collectible`);
    invariant(progress.sessions.find((session) => session.id === started.session.id)?.rewardId === collectibles[day - 1][0], `Day ${day}: wrong collectible`);
    invariant(new Set(progress.collectedIds).size === progress.collectedIds.length, `Day ${day}: duplicate collectible`);
    if (day === 1) invariant(progress.collectedIds[0] === "bell", "First reward was not the Old Brass School Bell");

    if (day >= 10 && day < 15) {
      invariant(!started.session.questions.some((question) => question.skill === SETTINGS_SKILL), `Day ${day}: disabled square roots appeared`);
      invariant(JSON.stringify(progress.mastery[SETTINGS_SKILL]) === JSON.stringify(disabledMastery), `Day ${day}: disabled mastery changed`);
    }

    if (day === 20) {
      const rewardCount = progress.collectedIds.length;
      const extra = startSession(progress, date, true);
      validateSession(extra.session, extra.progress.activeSkills);
      totalWarmups += extra.session.warmups.length;
      totalQuestions += extra.session.questions.length;
      const extraMastery = structuredClone(extra.progress.mastery);
      const extraOutcomes = extra.session.questions.map((question) => {
        const outcome = outcomeFor(question.skill, day, encounters[question.skill]++);
        const entryBefore = extraMastery[question.skill];
        if (entryBefore.seen > 0 && entryBefore.confidence >= .72 && entryBefore.nextDue && entryBefore.nextDue > date) skills[question.skill].secureNotDue += 1;
        const row = skills[question.skill];
        row.questions += 1;
        row[outcome] += 1;
        row.days.push(day);
        if (outcome !== "first") row.errorDays.push(day);
        outcomes[outcome] += 1;
        return outcome;
      });
      progress = completeSession(extra.progress, extra.session.id, extraOutcomes);
      invariant(progress.collectedIds.length === rewardCount, "Extra practice granted a collectible");
      invariant(!progress.sessions.find((session) => session.id === extra.session.id)?.rewardId, "Extra practice stored a reward");
      extraSessions += 1;
    }

    const beforeSave = persistedState(progress);
    const serialized = JSON.stringify(progress);
    progress = parseProgress(serialized);
    invariant(JSON.stringify(persistedState(progress)) === JSON.stringify(beforeSave), `Day ${day}: persistence round-trip changed state`);
    invariant(progress.activeSkills.includes(SETTINGS_SKILL) === (day < 10 || day >= 15), `Day ${day}: Settings did not persist`);
  }

  invariant(resumeVerified, "Interruption/resume scenario did not run");
  invariant(progress.collectedIds.length === 30, "Expected exactly 30 collectibles after Day 30");
  invariant(new Set(progress.collectedIds).size === 30, "All 30 daily collectibles must be distinct");
  invariant(progress.sessions.filter((session) => !session.extra && session.complete).length === 30, "Expected 30 completed daily sessions");

  const findings = [];
  const repeatedSecure = skillIds.filter((skill) => skills[skill].secureNotDue >= 3);
  if (repeatedSecure.length) findings.push({
    code: "SECURE_NOT_DUE_REPETITION",
    message: `${repeatedSecure.map((skill) => skillNames[skill]).join(", ")} appeared at least three times while secure and not due. Selection spacing is advisory rather than a strict gate.`,
  });
  const starvedWeak = skillIds.filter((skill) => {
    const entry = progress.mastery[skill];
    const lastDay = skills[skill].days.at(-1) ?? 0;
    return entry.confidence < .55 && 30 - lastDay > 6;
  });
  if (starvedWeak.length) findings.push({ code: "WEAK_SKILL_STARVATION", message: `${starvedWeak.map((skill) => skillNames[skill]).join(", ")} ended weak and absent for more than six days.` });
  if (!findings.length) findings.push({ code: "NO_SUSPICIOUS_PATTERN", message: "No secure repetition or weak-skill starvation threshold was crossed." });

  const summary = {
    dailySessions: 30,
    extraSessions,
    totalQuestions,
    totalWarmups,
    outcomes,
    collectibles: progress.collectedIds.length,
    settingsScenario: { skill: SETTINGS_SKILL, disabledDays: [10, 11, 12, 13, 14], reenabledDay: 15 },
    resumeDay: 7,
    skills: Object.fromEntries(skillIds.map((skill) => [skill, {
      questions: skills[skill].questions,
      first: skills[skill].first,
      retry: skills[skill].retry,
      reviewed: skills[skill].reviewed,
      confidence: progress.mastery[skill].confidence,
      intervalDays: progress.mastery[skill].intervalDays,
      nextDue: progress.mastery[skill].nextDue,
      recentErrors: progress.mastery[skill].recentErrors,
      secureNotDueAppearances: skills[skill].secureNotDue,
    }])),
    findings,
    finalProgress: progress,
  };
  return summary;
}

export { formatSummary };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(formatSummary(runThirtyDaySimulation()));
}
