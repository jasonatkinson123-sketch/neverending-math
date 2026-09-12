import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { blankProgress } from "../app/progress.ts";
import { collectibles } from "../app/collectibles.ts";
import { representativeQuestions, fixtureProgress } from "../tests/playability-fixtures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, ".tmp/browser-fixtures.json");
const fixtureDate = "2032-06-14";

// Node 24 runs the same production TypeScript modules used by the unit suite.
// Keeping this process free of a Vite server makes fixture preparation finish
// deterministically before Playwright starts.
const ids = collectibles.map(([id]) => id);
const collection = ({ collected = 0, placed = [] } = {}) => ({
  ...blankProgress(),
  collectedIds: ids.slice(0, collected),
  placedIds: placed,
});
const challenges = Object.fromEntries(
  Object.entries(representativeQuestions).map(([skill, question]) => [
    skill,
    { question, progress: fixtureProgress({ skill, date: fixtureDate }) },
  ]),
);
const fixtures = {
  storageKey: "neverending-math-progress-v2",
  date: fixtureDate,
  collectibles: ids,
  challenges,
  collections: {
    empty: collection(),
    small: collection({ collected: 3 }),
    bellUnplacedWithThirty: collection({ collected: 30, placed: ["pen", "compass"] }),
    lampUnplacedWithThirty: collection({ collected: 30, placed: ids.slice(0, -1) }),
    bellAlreadyPlaced: collection({ collected: 30, placed: ["bell"] }),
  },
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(fixtures, null, 2)}\n`);
console.log(`Prepared ${Object.keys(challenges).length} challenge fixtures and ${ids.length} collectible IDs at ${output}`);
