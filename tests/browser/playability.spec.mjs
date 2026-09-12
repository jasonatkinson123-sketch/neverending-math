import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const fixtures = JSON.parse(await readFile(resolve(".tmp/browser-fixtures.json"), "utf8"));

async function seed(page, progress) {
  await page.addInitScript(({ storageKey, value, date }) => {
    const seedMarker = `${storageKey}:playwright-seeded`;
    if (sessionStorage.getItem(seedMarker) !== "true") {
      localStorage.setItem(storageKey, JSON.stringify(value));
      sessionStorage.setItem(seedMarker, "true");
    }
    const NativeDate = Date;
    const fixedTime = new NativeDate(`${date}T12:00:00.000Z`).valueOf();
    // The app uses new Date() for its daily-session key. Fixing it makes resume
    // fixtures deterministic while leaving production code untouched.
    // eslint-disable-next-line no-global-assign
    Date = class TestDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixedTime])); }
      static now() { return fixedTime; }
    };
  }, { storageKey: fixtures.storageKey, value: progress, date: fixtures.date });
}

async function open(page, progress) {
  await seed(page, progress);
  await page.goto("/");
  await page.getByRole("button", { name: "Enter Neverending Math" }).click();
}

async function openChallenge(page, fixture) {
  await open(page, fixture.progress);
  await page.getByRole("button", { name: "Begin today’s mathematics" }).click();
  await expect(page.locator(".challenge-layout")).toBeVisible();
}

async function openCollection(page, progress) {
  await open(page, progress);
  await page.getByRole("button", { name: "Open objects collection" }).click();
  await expect(page.getByLabel("Objects collection")).toBeVisible();
}

async function bounds(page, locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const clippedBy = [];
    for (let node = element.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (/(hidden|clip)/.test(`${style.overflow}${style.overflowX}${style.overflowY}`)) {
        const parent = node.getBoundingClientRect();
        if (rect.left < parent.left || rect.right > parent.right || rect.top < parent.top || rect.bottom > parent.bottom) clippedBy.push(node.className || node.tagName);
      }
    }
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight, clippedBy };
  });
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function expectReachable(page, locator, { minHeight = 0 } = {}) {
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  const rect = await bounds(page, locator);
  expect(rect.width).toBeGreaterThan(0);
  expect(rect.height).toBeGreaterThanOrEqual(minHeight);
  expect(rect.left).toBeGreaterThanOrEqual(0);
  expect(rect.top).toBeGreaterThanOrEqual(0);
  expect(rect.right).toBeLessThanOrEqual(rect.viewportWidth);
  expect(rect.bottom).toBeLessThanOrEqual(rect.viewportHeight);
  expect(rect.clippedBy).toEqual([]);
  return rect;
}

test.describe("Challenge browser coverage", () => {
  for (const [skill, fixture] of Object.entries(fixtures.challenges)) {
    test(`${skill} representative prompt is visible and usable`, async ({ page }) => {
      await openChallenge(page, fixture);
      const prompt = page.locator(".challenge-question");
      await expect(prompt).toHaveText(fixture.question.prompt);
      await expectReachable(page, prompt);
      const input = page.getByLabel("YOUR ANSWER");
      const check = page.getByRole("button", { name: /check answer/i });
      const skip = page.getByRole("button", { name: "SKIP" });
      const feedback = page.locator(".challenge-feedback");
      const questionBox = await bounds(page, prompt);
      const feedbackBox = await expectReachable(page, feedback);
      const inputBox = await expectReachable(page, input, { minHeight: 44 });
      const checkBox = await expectReachable(page, check, { minHeight: 44 });
      await expectReachable(page, skip, { minHeight: 44 });
      expect(overlaps(questionBox, feedbackBox)).toBeFalsy();
      expect(overlaps(feedbackBox, inputBox)).toBeFalsy();
      expect(overlaps(inputBox, checkBox)).toBeFalsy();
    });
  }

  test("retry, review, format guidance, controls, and keyboard use are reachable", async ({ page }) => {
    await openChallenge(page, fixtures.challenges.primeFactors);
    await expect(page.getByText("FORMAT: 2 × 2 × 3")).toBeVisible();
    const input = page.getByLabel("YOUR ANSWER");
    await input.focus();
    await page.keyboard.type("999");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /check answer/i })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText("NOT QUITE — TRY ONCE MORE")).toBeVisible();
    await input.fill("999");
    await page.keyboard.press("Enter");
    await expect(page.getByText("LET’S REVIEW IT")).toBeVisible();
    const continueButton = page.getByRole("button", { name: /continue/i });
    await expectReachable(page, continueButton, { minHeight: 44 });
    await expect(input).toBeDisabled();
    await continueButton.press("Enter");
  });
});

test.describe("Objects Collection and Study browser coverage", () => {
  test("empty and small collections reveal only earned objects", async ({ page }) => {
    await openCollection(page, fixtures.collections.empty);
    await expect(page.getByText("THE SHELVES ARE QUIET")).toBeVisible();
    await expect(page.locator("[data-collectible-id]")).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: "Enter Neverending Math" }).click();
    await page.getByRole("button", { name: "Open objects collection" }).click();
    await expect(page.getByText("THE SHELVES ARE QUIET")).toBeVisible();

    const smallPage = await page.context().newPage();
    await openCollection(smallPage, fixtures.collections.small);
    await expect(smallPage.locator("[data-collectible-id]")).toHaveCount(3);
    await expect(smallPage.locator('[data-collectible-id="lamp"]')).toHaveCount(0);
    await smallPage.close();
  });

  for (const [name, id, label] of [
    ["early", "bell", "OLD BRASS SCHOOL BELL"],
    ["late", "lamp", "LAMP PULL"],
  ]) {
    test(`${name} unplaced object can be placed once and survives reload`, async ({ page }) => {
      const progress = name === "early" ? fixtures.collections.bellUnplacedWithThirty : fixtures.collections.lampUnplacedWithThirty;
      await openCollection(page, progress);
      const ids = await page.locator("[data-collectible-id]").evaluateAll((items) => items.map((item) => item.dataset.collectibleId));
      expect(ids).toEqual(fixtures.collectibles);
      const inspect = page.getByRole("button", { name: `Inspect ${label}` });
      await inspect.scrollIntoViewIfNeeded();
      await inspect.click();
      const enterStudy = page.getByRole("button", { name: /place in the study/i });
      await expectReachable(page, enterStudy, { minHeight: 44 });
      await enterStudy.click();
      await expect(page.getByRole("region", { name: "The Study", exact: true })).toBeVisible();
      await expect(page.locator(".study-placement-details")).toContainText(label);
      const place = page.getByRole("button", { name: `Place ${label} in the Study` });
      await expectReachable(page, place, { minHeight: 44 });
      await place.click();
      await expect(page.getByText("IN THE STUDY")).toBeVisible();
      await expect(place).toHaveCount(0);
      await expect(page.locator(`[aria-label="Inspect ${label} in the Study"]`)).toHaveCount(1);
      const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), fixtures.storageKey);
      expect(saved.placedIds.filter((value) => value === id)).toHaveLength(1);

      await page.reload();
      await page.getByRole("button", { name: "Enter Neverending Math" }).click();
      await page.getByRole("button", { name: "Open objects collection" }).click();
      await page.getByRole("button", { name: `Inspect ${label}` }).scrollIntoViewIfNeeded();
      await page.getByRole("button", { name: `Inspect ${label}` }).click();
      await page.getByRole("button", { name: /view in the study/i }).click();
      await expect(page.locator(".study-placement-details")).toContainText(label);
      await expect(page.getByText("IN THE STUDY")).toBeVisible();
      await expect(page.getByRole("button", { name: `Place ${label} in the Study` })).toHaveCount(0);
    });
  }

  test("already placed object can be inspected without a misleading placement action", async ({ page }) => {
    await openCollection(page, fixtures.collections.bellAlreadyPlaced);
    await page.getByRole("button", { name: "Inspect OLD BRASS SCHOOL BELL" }).click();
    await page.getByRole("button", { name: /view in the study/i }).click();
    await expect(page.locator(".study-placement-details")).toContainText("OLD BRASS SCHOOL BELL");
    await expect(page.getByText("IN THE STUDY")).toBeVisible();
    await expect(page.getByRole("button", { name: /place old brass school bell/i })).toHaveCount(0);
  });
});
