import { hash, makeQuestion, seededRandom, skillIds, type Question, type SkillId } from "./math-system.ts";

export type Outcome = "first" | "retry" | "reviewed";
export type Mastery = Record<SkillId, { seen: number; first: number; reviewed: number }>;
export type Session = { id: string; dateKey: string; serial: number; questions: Question[]; warmups: Question[]; complete: boolean; rewardId?: string };
export type Progress = { version: 2; sound: boolean; voice: boolean; sessions: Session[]; mastery: Mastery; collectedIds: string[]; placedIds: string[] };

export const collectibles = [
  ["bell", "OLD BRASS SCHOOL BELL", "Found on Day 1"], ["pen", "FOUNTAIN PEN", "Found beneath the attendance book"], ["compass", "BRASS COMPASS", "Found in a shallow drawer"], ["ruler", "WOODEN RULER", "Found by the blackboard"], ["globe", "SMALL GLOBE", "Found in the map cabinet"], ["abacus", "RED-WOOD ABACUS", "Found near the window"], ["textbook", "OLD TEXTBOOK", "Found on a high shelf"], ["lens", "MAGNIFYING GLASS", "Found beside the ink"], ["puzzle", "WOODEN PUZZLE", "Found in the cupboard"], ["protractor", "BRASS PROTRACTOR", "Found in a paper sleeve"], ["watch", "POCKET WATCH", "Found behind the desk"], ["ink", "INK BOTTLE", "Found in the writing drawer"], ["slate", "SMALL SLATE", "Found under a stack of papers"], ["chalk", "CHALK BOX", "Found beneath the ledge"], ["key", "CABINET KEY", "Found in the coat pocket"], ["stamp", "LIBRARY STAMP", "Found in the card file"], ["map", "FOLDED STAR MAP", "Found in a blue envelope"], ["ledger", "LEATHER LEDGER", "Found under the globe"], ["eraser", "FELT ERASER", "Found near the board"], ["bookmark", "RIBBON BOOKMARK", "Found in an atlas"], ["top", "WOODEN TOP", "Found in the drawer"], ["clip", "BRASS PAPER CLIP", "Found on a note"], ["box", "MATCHBOX OF TACKS", "Found in the supply cabinet"], ["card", "INDEX CARD", "Found among old problems"], ["cube", "NUMBER CUBE", "Found beside the bell"], ["feather", "INK-STAINED FEATHER", "Found in a book"], ["shell", "SMALL SHELL", "Found on the sill"], ["coin", "OLD TOKEN", "Found under the rug"], ["tape", "MEASURING TAPE", "Found in a tin"], ["lamp", "LAMP PULL", "Found in the desk"],
] as const;
export type CollectibleId = typeof collectibles[number][0];
export const collectible = (id: string) => collectibles.find(([item]) => item === id) ?? collectibles[0];

const blankMastery = () => Object.fromEntries(skillIds.map((skill) => [skill, { seen: 0, first: 0, reviewed: 0 }])) as Mastery;
export const blankProgress = (): Progress => ({ version: 2, sound: true, voice: true, sessions: [], mastery: blankMastery(), collectedIds: [], placedIds: [] });

export function dateKey(now = new Date()) { return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
const score = (entry: Mastery[SkillId]) => entry.seen ? (entry.first - entry.reviewed) / entry.seen : 0;
export function chooseSkills(mastery: Mastery, date: string, serial: number) {
  const random = seededRandom(hash(`${date}-${serial}-skills`));
  const review = [...skillIds].sort((a, b) => score(mastery[a]) - score(mastery[b]));
  const familiar = [...skillIds].sort((a, b) => mastery[b].seen - mastery[a].seen);
  // The order is intentional: a little review first, familiar work in the
  // middle, then a few varied prompts. Repetition is allowed here; a skill
  // that needs attention should quietly return rather than waiting weeks.
  return [
    review[0], review[1], review[0],
    familiar[0], familiar[1],
    ...Array.from({ length: 5 }, () => skillIds[Math.floor(random() * skillIds.length)]),
    review[2], skillIds[Math.floor(random() * skillIds.length)],
  ];
}
export function createSession(progress: Progress, date: string, serial: number): Session {
  const random = seededRandom(hash(`${date}-${serial}-questions`));
  const skills = chooseSkills(progress.mastery, date, serial);
  return { id: `${date}-${serial}`, dateKey: date, serial, warmups: [], questions: skills.map((skill, index) => makeQuestion(skill, random, index)), complete: false };
}
export function updateMastery(mastery: Mastery, questions: Question[], outcomes: Outcome[]) {
  const next = structuredClone(mastery);
  questions.forEach((question, index) => { const entry = next[question.skill]; entry.seen += 1; if (outcomes[index] === "first") entry.first += 1; if (outcomes[index] === "reviewed") entry.reviewed += 1; });
  return next;
}
export function startSession(progress: Progress, today = dateKey(), extra = false) {
  const existing = progress.sessions.find((session) => session.dateKey === today && !session.complete && !extra);
  if (existing) return { progress, session: existing };
  const serial = progress.sessions.length + 1;
  const session = createSession(progress, today, serial);
  return { progress: { ...progress, sessions: [...progress.sessions, session] }, session };
}
export function completeSession(progress: Progress, id: string, outcomes: Outcome[]) {
  const session = progress.sessions.find((item) => item.id === id); if (!session) return progress;
  const rewardId = collectibles[progress.collectedIds.length % collectibles.length][0];
  const sessions = progress.sessions.map((item) => item.id === id ? { ...item, complete: true, rewardId } : item);
  return { ...progress, sessions, mastery: updateMastery(progress.mastery, session.questions, outcomes), collectedIds: progress.collectedIds.includes(rewardId) ? progress.collectedIds : [...progress.collectedIds, rewardId] };
}
export function parseProgress(raw: string | null): Progress {
  if (!raw) return blankProgress(); try { const value = JSON.parse(raw); if (value.version === 2) return { ...blankProgress(), ...value, mastery: { ...blankMastery(), ...value.mastery } }; } catch {} return blankProgress();
}
