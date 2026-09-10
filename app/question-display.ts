import type { Question, SkillId } from "./math-system";

export type QuestionDisplay = "expression" | "sentence" | "sentence-long";

const sentenceSkills = new Set<SkillId>([
  "factors", "primeFactors", "gcf", "lcm", "commonDenominators", "fractions",
]);

/** Classify by mathematical form first, then by the amount of prose. */
export function questionDisplay(question: Pick<Question, "skill" | "prompt">): QuestionDisplay {
  if (!sentenceSkills.has(question.skill)) return "expression";
  return question.prompt.length > 48 ? "sentence-long" : "sentence";
}

export function questionDisplayClass(question: Pick<Question, "skill" | "prompt">) {
  return `challenge-${questionDisplay(question)}`;
}
