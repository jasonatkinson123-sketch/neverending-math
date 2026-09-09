import type { Question } from "./math-system.ts";

export function normalizeNumber(raw: string) { const value = raw.trim().replace(/−/g, "-").replace(/,/g, ""); return /^[-+]?\d+(?:\.0+)?$/.test(value) ? Number(value) : Number.NaN; }
export function normalizeFactors(raw: string) { const factorText = raw.toLowerCase().replace(/−/g, "-").includes("=") ? raw.split("=").slice(1).join("=") : raw; return factorText.match(/\d+/g)?.map(Number).sort((a, b) => a - b) ?? []; }
export function normalizePair(raw: string) { return raw.toLowerCase().match(/-?\d+/g)?.map(Number).sort((a, b) => a - b) ?? []; }
export function correctAnswer(question: Question, raw: string) {
  if (question.input === "factors") return JSON.stringify(normalizeFactors(raw)) === JSON.stringify([...question.answer as number[]].sort((a, b) => a - b));
  if (question.input === "pair") return JSON.stringify(normalizePair(raw)) === JSON.stringify(question.answer);
  if (question.input === "oneOf") return (question.answer as number[]).includes(normalizeNumber(raw));
  return normalizeNumber(raw) === question.answer;
}
// Kept for compatibility with the original Day 1 tests and any old saved build.
export function correctChallengeAnswer(index: number, raw: string, expected: number | string) {
  if (index === 2) return JSON.stringify(normalizeFactors(raw)) === JSON.stringify([2, 3, 3]);
  if (index === 11) return JSON.stringify(normalizePair(raw)) === JSON.stringify([7, 8]);
  return normalizeNumber(raw) === expected;
}
