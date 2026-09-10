import { collectibles } from "../app/collectibles.ts";
import { makeQuestion, seededRandom, skillIds } from "../app/math-system.ts";
import { blankProgress, checkpointSession, dateKey, startSession } from "../app/progress.ts";

const candidatesFor = (skill) => Array.from({ length: 160 }, (_, seed) => makeQuestion(skill, seededRandom(seed), seed));

/** The widest known generated prompt per skill for deterministic component/browser checks. */
export const representativeQuestions = Object.fromEntries(
  skillIds.map((skill) => [skill, candidatesFor(skill).sort((a, b) => b.prompt.length - a.prompt.length)[0]]),
);

export const challengeStates = [
  { name: "answering", feedback: "", detail: "" },
  { name: "retry", feedback: "NOT QUITE — TRY ONCE MORE", detail: "A representative hint." },
  { name: "review", feedback: "LET’S REVIEW IT", detail: "A representative worked explanation." },
  { name: "prime-factor-format", feedback: "", detail: "", skill: "primeFactors" },
];

export function fixtureProgress({ skill = "commonDenominators", collected = 0, placed = [], date = dateKey() } = {}) {
  const progress = { ...blankProgress(), collectedIds: collectibles.slice(0, collected).map(([id]) => id), placedIds: placed };
  const started = startSession(progress, date);
  const question = representativeQuestions[skill];
  const session = { ...started.session, questions: [question, ...started.session.questions.slice(1)] };
  const withSession = { ...started.progress, sessions: started.progress.sessions.map((item) => item.id === session.id ? session : item) };
  return checkpointSession(withSession, session.id, { phase: "challenge", warmIndex: 0, questionIndex: 0, outcomes: [] });
}

export const placementFixtures = {
  earlyUnplacedWithThirty: { collected: 30, placed: ["pen", "compass"] },
  alreadyPlacedBell: { collected: 30, placed: ["bell"] },
};
