import { collectibles } from "./collectibles.ts";
import { hash, makeQuestion, seededRandom, skillIds, warmupFor, type Question, type SkillId } from "./math-system.ts";

export type Outcome = "first" | "retry" | "reviewed";
export type MasteryEntry = {
  seen: number; first: number; retry: number; reviewed: number;
  successful: number; recentErrors: number; confidence: number;
  lastSeen: string | null; intervalDays: number; nextDue: string | null;
  recent: Outcome[];
};
export type Mastery = Record<SkillId, MasteryEntry>;
export type JourneyPhase = "warmupIntro" | "warmup" | "warmupComplete" | "challengeIntro" | "challenge" | "results";
export type Session = { id: string; dateKey: string; serial: number; eligibleSkills: SkillId[]; questions: Question[]; warmups: Question[]; complete: boolean; extra?: boolean; superseded?: boolean; rewardId?: string; checkpoint?: { phase: JourneyPhase; warmIndex: number; questionIndex: number; outcomes: Outcome[] } };
export type Progress = { version: 4; sound: boolean; voice: boolean; activeSkills: SkillId[]; sessions: Session[]; mastery: Mastery; collectedIds: string[]; placedIds: string[] };

const blankEntry = (): MasteryEntry => ({ seen: 0, first: 0, retry: 0, reviewed: 0, successful: 0, recentErrors: 0, confidence: .35, lastSeen: null, intervalDays: 1, nextDue: null, recent: [] });
const blankMastery = () => Object.fromEntries(skillIds.map((skill) => [skill, blankEntry()])) as Mastery;
export const blankProgress = (): Progress => ({ version: 4, sound: true, voice: true, activeSkills: [...skillIds], sessions: [], mastery: blankMastery(), collectedIds: [], placedIds: [] });

export function setSkillEnabled(progress: Progress, skill: SkillId, enabled: boolean): Progress {
  const active = progress.activeSkills.includes(skill);
  if (enabled && !active) return { ...progress, activeSkills: [...progress.activeSkills, skill] };
  if (!enabled && active && progress.activeSkills.length > 1) return { ...progress, activeSkills: progress.activeSkills.filter(item => item !== skill) };
  return progress;
}

export function dateKey(now = new Date()) { return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
const outcomeValue: Record<Outcome, number> = { first: 1, retry: .68, reviewed: .12 };
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
const isDue = (entry: MasteryEntry, date: string) => !entry.nextDue || daysBetween(entry.nextDue, date) >= 0;
export function masteryPriority(entry: MasteryEntry, date: string) {
  if (!entry.seen) return .58;
  const overdue = entry.nextDue ? Math.max(0, daysBetween(entry.nextDue, date)) : 0;
  return (1 - entry.confidence) * .62 + Math.min(.24, entry.recentErrors * .06) + Math.min(.14, overdue * .025);
}
export function chooseSkills(mastery: Mastery, date: string, serial: number, activeSkills: SkillId[] = skillIds) {
  const random = seededRandom(hash(`${date}-${serial}-skills`));
  const shuffle = (items: SkillId[]) => items.map(item => ({ item, order: random() })).sort((a,b) => a.order-b.order).map(x => x.item);
  const allowed = skillIds.filter(skill => activeSkills.includes(skill));
  if (!allowed.length) return [];
  const seen = allowed.filter(skill => mastery[skill].seen > 0);
  const newSkills = shuffle(allowed.filter(skill => mastery[skill].seen === 0));
  const review = shuffle(seen.filter(skill => isDue(mastery[skill], date))).sort((a, b) => masteryPriority(mastery[b], date) - masteryPriority(mastery[a], date));
  const secure = shuffle(seen.filter(skill => mastery[skill].confidence >= .72)).sort((a, b) => mastery[a].confidence - mastery[b].confidence);
  const current = shuffle(seen.filter(skill => mastery[skill].confidence < .72 && !review.includes(skill)));
  const stretch = shuffle((["orderOfOperations", "exponents", "squareRoots", "primeFactors", "gcf", "lcm"] as SkillId[]).filter(skill => allowed.includes(skill)));
  const plan: SkillId[] = [];
  plan.push(...review.slice(0, 3));
  if (review[0]) plan.push(review[0]);
  plan.push(...secure.slice(0, 2), ...current.slice(0, 2), ...newSkills.slice(0, 3));
  if (stretch[0]) plan.push(stretch[0]);
  const refill = shuffle([...allowed]);
  for (let index = 0; plan.length < 12; index += 1) plan.push(refill[index % refill.length]);
  return shuffle(plan.slice(0, 12));
}
export function createSession(progress: Progress, date: string, serial: number, extra = false): Session {
  const random = seededRandom(hash(`${date}-${serial}-questions`));
  const eligibleSkills = [...progress.activeSkills];
  const skills = chooseSkills(progress.mastery, date, serial, eligibleSkills);
  const warmups = warmupFor(date, serial, eligibleSkills);
  return { id: `${date}-${serial}`, dateKey: date, serial, eligibleSkills, warmups, questions: skills.map((skill, index) => makeQuestion(skill, random, index)), complete: false, extra, checkpoint: { phase: warmups.length ? "warmupIntro" : "challengeIntro", warmIndex: 0, questionIndex: 0, outcomes: [] } };
}

export function sessionIsCompatible(session: Session, activeSkills: SkillId[]) {
  return [...session.warmups, ...session.questions].every((question) => activeSkills.includes(question.skill));
}
export function updateMastery(mastery: Mastery, questions: Question[], outcomes: Outcome[], completedOn: string) {
  const next = structuredClone(mastery);
  questions.forEach((question, index) => {
    const outcome = outcomes[index] ?? "reviewed", entry = next[question.skill];
    entry.seen += 1; entry[outcome] += 1;
    if (outcome !== "reviewed") entry.successful += 1;
    entry.recentErrors = outcome === "first" ? Math.max(0, entry.recentErrors - 1) : Math.min(8, entry.recentErrors + (outcome === "reviewed" ? 2 : 1));
    entry.confidence = Math.max(.08, Math.min(.96, entry.confidence * .8 + outcomeValue[outcome] * .2));
    entry.recent = [...entry.recent, outcome].slice(-6);
    entry.intervalDays = outcome === "reviewed" ? 1 : Math.max(1, Math.min(14, 1 + Math.floor(entry.confidence * 6) + Math.floor(entry.successful / 4)));
    entry.lastSeen = completedOn;
    const due = new Date(`${completedOn}T12:00:00Z`); due.setUTCDate(due.getUTCDate() + entry.intervalDays); entry.nextDue = due.toISOString().slice(0, 10);
  });
  return next;
}
export function startSession(progress: Progress, today = dateKey(), extra = false) {
  const existing = progress.sessions.find((session) => session.dateKey === today && !session.complete && !session.superseded && !extra && sessionIsCompatible(session, progress.activeSkills));
  if (existing) return { progress, session: existing };
  const sessions = extra ? progress.sessions : progress.sessions.map(session => session.dateKey === today && !session.complete && !session.extra ? { ...session, superseded: true } : session);
  const serial = sessions.length + 1;
  const session = createSession(progress, today, serial, extra);
  return { progress: { ...progress, sessions: [...sessions, session] }, session };
}
export function completeSession(progress: Progress, id: string, outcomes: Outcome[]) {
  const session = progress.sessions.find((item) => item.id === id); if (!session) return progress;
  if (session.complete) return progress;
  const alreadyRewardedToday = progress.sessions.some(item => item.id !== id && item.dateKey === session.dateKey && item.complete && item.rewardId);
  const rewardId = session.extra || alreadyRewardedToday ? undefined : collectibles[progress.collectedIds.length % collectibles.length][0];
  const sessions = progress.sessions.map((item) => item.id === id ? { ...item, complete: true, rewardId } : item);
  return { ...progress, sessions, mastery: updateMastery(progress.mastery, session.questions, outcomes, session.dateKey), collectedIds: rewardId && !progress.collectedIds.includes(rewardId) ? [...progress.collectedIds, rewardId] : progress.collectedIds };
}
export function checkpointSession(progress: Progress, id: string, checkpoint: NonNullable<Session["checkpoint"]>) {
  return { ...progress, sessions: progress.sessions.map(item => item.id === id ? { ...item, checkpoint } : item) };
}
export function parseProgress(raw: string | null): Progress {
  if (!raw) return blankProgress(); try {
    const value = JSON.parse(raw), blank = blankProgress();
    if (value.version === 2 || value.version === 3 || value.version === 4) {
      const mastery = blankMastery();
      for (const skill of skillIds) mastery[skill] = { ...mastery[skill], ...(value.mastery?.[skill] ?? {}) };
      const activeSkills = Array.isArray(value.activeSkills) ? value.activeSkills.filter((skill: SkillId) => skillIds.includes(skill)) : [...skillIds];
      const normalizedSkills = activeSkills.length ? activeSkills : [...skillIds];
      const sessions = Array.isArray(value.sessions) ? value.sessions.map((session: Session) => {
        const eligibleSkills = Array.isArray(session.eligibleSkills) ? session.eligibleSkills.filter((skill: SkillId) => skillIds.includes(skill)) : [...normalizedSkills];
        const warmups = Array.isArray(session.warmups) && session.warmups.length ? session.warmups : warmupFor(session.dateKey, session.serial, eligibleSkills);
        const phase = !warmups.length && session.checkpoint && ["warmupIntro", "warmup", "warmupComplete"].includes(session.checkpoint.phase) ? "challengeIntro" : session.checkpoint?.phase;
        return { ...session, eligibleSkills, warmups, checkpoint: session.checkpoint ? { ...session.checkpoint, phase } : session.checkpoint };
      }) : [];
      return { ...blank, ...value, version: 4, activeSkills: normalizedSkills, mastery, sessions };
    }
  } catch {} return blankProgress();
}
