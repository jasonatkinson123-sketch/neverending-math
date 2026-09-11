import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, ".tmp/browser-fixtures.json");
const fixtureDate = "2032-06-14";

// Fixtures are generated from the real TypeScript production functions. The
// resulting JSON is consumed only by Playwright's isolated browser contexts.
const vite = await createServer({
  root,
  configFile: false,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const { blankProgress } = await vite.ssrLoadModule("/app/progress.ts");
  const { collectibles } = await vite.ssrLoadModule("/app/collectibles.ts");
  const { representativeQuestions, fixtureProgress } = await vite.ssrLoadModule("/tests/playability-fixtures.mjs");
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
  console.log(`Prepared browser fixtures at ${output}`);
} finally {
  await vite.close();
}
