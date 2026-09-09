export type SkillId =
  | "multiplication" | "division" | "factors" | "primeFactors" | "gcf" | "lcm"
  | "negatives" | "commonDenominators" | "fractions" | "exponents" | "squareRoots" | "orderOfOperations";

export type Question = {
  id: string;
  skill: SkillId;
  prompt: string;
  answer: number | number[];
  shown: string;
  hint: string;
  input: "number" | "factors" | "pair" | "oneOf";
};

export const skillNames: Record<SkillId, string> = {
  multiplication: "multiplication facts", division: "division facts", factors: "factors",
  primeFactors: "prime factorization", gcf: "greatest common factors", lcm: "least common multiples",
  negatives: "negative numbers", commonDenominators: "common denominators", fractions: "fraction concepts",
  exponents: "exponents", squareRoots: "square roots", orderOfOperations: "order of operations",
};

export const skillIds = Object.keys(skillNames) as SkillId[];

export const skillGroups = [
  { name: "FOUNDATIONS", skills: ["multiplication", "division"] },
  { name: "NEGATIVE NUMBERS", skills: ["negatives"] },
  { name: "FACTORS & MULTIPLES", skills: ["factors", "primeFactors", "gcf", "lcm"] },
  { name: "FRACTIONS", skills: ["fractions", "commonDenominators"] },
  { name: "EXPONENTS & ROOTS", skills: ["exponents", "squareRoots"] },
  { name: "ORDER OF OPERATIONS", skills: ["orderOfOperations"] },
] satisfies Array<{ name: string; skills: SkillId[] }>;

export function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const pick = <T,>(items: readonly T[], random: () => number) => items[Math.floor(random() * items.length)];
const between = (min: number, max: number, random: () => number) => min + Math.floor(random() * (max - min + 1));
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : Math.abs(a);
const lcm = (a: number, b: number) => Math.abs(a * b) / gcd(a, b);
const isPrime = (n: number) => n > 1 && Array.from({ length: Math.floor(Math.sqrt(n)) - 1 }, (_, i) => i + 2).every((d) => n % d !== 0);
const primeFactors = (n: number) => { const factors: number[] = []; for (let d = 2; d <= n; d += 1) while (n % d === 0) { factors.push(d); n /= d; } return factors; };

export function makeQuestion(skill: SkillId, random: () => number, sequence = 0): Question {
  const id = `${skill}-${sequence}-${Math.floor(random() * 1e9)}`;
  if (skill === "multiplication") { const a = between(3, 12, random), b = between(3, 12, random); return { id, skill, prompt: `${a} × ${b} = ?`, answer: a * b, shown: `${a} × ${b} = ${a * b}`, hint: `Think of ${b} groups of ${a}.`, input: "number" }; }
  if (skill === "division") { const b = between(3, 12, random), answer = between(3, 12, random); return { id, skill, prompt: `${b * answer} ÷ ${b} = ?`, answer, shown: `${b * answer} ÷ ${b} = ${answer}`, hint: `What number times ${b} makes ${b * answer}?`, input: "number" }; }
  if (skill === "factors") { const n = pick([12, 18, 20, 24, 28, 30, 36], random), factors = Array.from({ length: n - 3 }, (_, i) => i + 2).filter((value) => n % value === 0); return { id, skill, prompt: `Give one factor of ${n} other than 1 and ${n}.`, answer: factors, shown: `Possible answers: ${factors.join(", ")}. Each divides ${n} with no remainder.`, hint: "A factor divides a number evenly.", input: "oneOf" }; }
  if (skill === "primeFactors") { const n = pick([12, 18, 20, 24, 28, 30, 36, 42, 45, 50], random), answer = primeFactors(n); return { id, skill, prompt: `List the prime factors of ${n}.`, answer, shown: `${n} = ${answer.join(" × ")}`, hint: "Keep breaking composite numbers into primes.", input: "factors" }; }
  if (skill === "gcf") { const base = between(2, 8, random), a = base * between(2, 5, random), b = base * between(2, 5, random); return { id, skill, prompt: `What is the greatest common factor of ${a} and ${b}?`, answer: gcd(a, b), shown: `GCF(${a}, ${b}) = ${gcd(a, b)}`, hint: "Look for the largest factor the numbers share.", input: "number" }; }
  if (skill === "lcm") { const a = pick([3, 4, 5, 6, 8, 9, 10], random), b = pick([3, 4, 5, 6, 8, 9, 10].filter((n) => n !== a), random); return { id, skill, prompt: `What is the least common multiple of ${a} and ${b}?`, answer: lcm(a, b), shown: `LCM(${a}, ${b}) = ${lcm(a, b)}`, hint: "List multiples until the two lists meet.", input: "number" }; }
  if (skill === "negatives") { const a = between(3, 12, random), b = between(2, 10, random), subtract = random() > .5; const answer = subtract ? a + b : -a - b; return { id, skill, prompt: subtract ? `${a} − (−${b}) = ?` : `−${a} + (−${b}) = ?`, answer, shown: `${subtract ? `${a} − (−${b})` : `−${a} + (−${b})`} = ${answer}`, hint: subtract ? "Subtracting a negative becomes addition." : "Both numbers move left on the number line.", input: "number" }; }
  if (skill === "commonDenominators") { const a = pick([2, 3, 4, 5, 6], random), b = pick([3, 4, 5, 6, 8].filter((n) => n !== a), random); return { id, skill, prompt: `What is the least common denominator for 1/${a} and 1/${b}?`, answer: lcm(a, b), shown: `The least common denominator is ${lcm(a, b)}.`, hint: `Find the first multiple shared by ${a} and ${b}.`, input: "number" }; }
  if (skill === "fractions") { const denominator = pick([3, 4, 5, 6, 8], random), numerator = between(1, denominator - 1, random); return { id, skill, prompt: `In ${numerator}/${denominator}, how many equal parts make the whole?`, answer: denominator, shown: `The denominator ${denominator} names the equal parts in one whole.`, hint: "Look at the number below the fraction bar.", input: "number" }; }
  if (skill === "exponents") { const base = pick([2, 3, 4, 5, 10], random), power = pick([2, 3], random); return { id, skill, prompt: `${base}${power === 2 ? "²" : "³"} = ?`, answer: base ** power, shown: `${base}${power === 2 ? "²" : "³"} = ${Array(power).fill(base).join(" × ")} = ${base ** power}`, hint: `Multiply ${base} by itself ${power} times.`, input: "number" }; }
  if (skill === "squareRoots") { const root = between(2, 15, random), square = root * root; return { id, skill, prompt: `√${square} = ?`, answer: root, shown: `√${square} = ${root}`, hint: "Which whole number times itself makes this square?", input: "number" }; }
  const a = between(2, 9, random), b = between(2, 8, random), c = between(2, 12, random); return { id, skill: "orderOfOperations", prompt: `${a} + ${b} × ${c} = ?`, answer: a + b * c, shown: `${a} + (${b} × ${c}) = ${a + b * c}`, hint: "Multiply before you add.", input: "number" };
}

export const warmupSkills: SkillId[] = ["multiplication", "division"];

export function warmupFor(dateKey: string, serial: number, activeSkills: SkillId[] = skillIds) {
  const random = seededRandom(hash(`${dateKey}-warm-${serial}`));
  const eligible = warmupSkills.filter((skill) => activeSkills.includes(skill));
  if (!eligible.length) return [];
  return Array.from({ length: 8 }, (_, index) => makeQuestion(eligible[index % eligible.length], random, index));
}

export function hash(text: string) { return [...text].reduce((value, char) => ((value << 5) - value + char.charCodeAt(0)) | 0, 2166136261) >>> 0; }

export function validQuestion(question: Question) {
  if (question.input === "factors") return Array.isArray(question.answer) && question.answer.length > 1 && question.answer.every(isPrime);
  if (question.input === "oneOf") return Array.isArray(question.answer) && question.answer.length > 0 && question.answer.every(Number.isFinite);
  return typeof question.answer === "number" && Number.isFinite(question.answer);
}
