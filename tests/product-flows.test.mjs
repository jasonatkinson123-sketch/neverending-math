import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { collectibles } from "../app/collectibles.ts";
import { blankProgress, completeSession, parseProgress, startSession } from "../app/progress.ts";

const storageKey = "neverending-math-progress-v2";
let vite;
let Home;

before(async () => {
  vite = await createServer({
    configFile: false,
    root: new URL("..", import.meta.url).pathname,
    appType: "custom",
    plugins: [react()],
    server: { middlewareMode: true },
    logLevel: "silent",
  });
  Home = (await vite.ssrLoadModule("/app/page.tsx")).default;
});

after(async () => {
  await vite?.close();
});

function installDom(savedProgress) {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    history: dom.window.history,
    localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  dom.window.HTMLElement.prototype.attachEvent = () => {};
  dom.window.HTMLElement.prototype.detachEvent = () => {};
  if (savedProgress) dom.window.localStorage.setItem(storageKey, savedProgress);
  return dom;
}

async function renderApp(savedProgress) {
  const dom = installDom(savedProgress);
  const root = createRoot(document.getElementById("root"));
  await act(async () => { root.render(React.createElement(Home)); });
  return { dom, root };
}

async function click(element) {
  assert.ok(element, "expected an interactive element");
  await act(async () => { element.click(); });
}

const button = (name) => document.querySelector(`button[aria-label="${name}"]`) ?? [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === name);
const checkbox = (name) => [...document.querySelectorAll("label")].find((label) => label.textContent.trim() === name)?.querySelector("input[type=checkbox]");
const stored = () => window.localStorage.getItem(storageKey);

async function openSettings() {
  await click(button("Enter Neverending Math"));
  await click(button("Open settings"));
}

async function openCollection(savedProgress) {
  const mounted = await renderApp(savedProgress);
  await click(button("Enter Neverending Math"));
  await click(button("Open objects collection"));
  return mounted;
}

function collectionProgress(count, placedIds = []) {
  return JSON.stringify({ ...blankProgress(), collectedIds: collectibles.slice(0, count).map(([id]) => id), placedIds });
}

test("Settings selection persists through navigation and reload and controls sessions", async () => {
  let mounted = await renderApp();
  await openSettings();
  await click(checkbox("square roots"));
  assert.equal(checkbox("square roots").checked, false);
  await click(button("Save settings"));
  await click(button("Open settings"));
  assert.equal(checkbox("square roots").checked, false);

  const persisted = stored();
  await act(async () => { mounted.root.unmount(); });
  mounted = await renderApp(persisted);
  await openSettings();
  assert.equal(checkbox("square roots").checked, false);
  await click(button("Save settings"));
  await click(button("Begin today’s mathematics"));
  let progress = parseProgress(stored());
  assert.ok(progress.sessions.at(-1).questions.every((question) => question.skill !== "squareRoots"));

  const unfinishedId = progress.sessions.at(-1).id;
  const withUnfinished = stored();
  await act(async () => { mounted.root.unmount(); });
  mounted = await renderApp(withUnfinished);
  await openSettings();
  await click(checkbox("square roots"));
  for (const input of [...document.querySelectorAll("input[type=checkbox]")]) {
    if (input !== checkbox("square roots") && input.checked) await click(input);
  }
  await click(button("Save settings"));
  await click(button("Begin today’s mathematics"));
  progress = parseProgress(stored());
  const replacement = progress.sessions.at(-1);
  assert.notEqual(replacement.id, unfinishedId);
  assert.equal(progress.sessions.find((session) => session.id === unfinishedId).superseded, true);
  assert.ok(replacement.questions.every((question) => question.skill === "squareRoots"));
  assert.deepEqual(replacement.warmups, []);
  await act(async () => { mounted.root.unmount(); });
});

test("a fresh collection is empty and displays the first earned Bell", async () => {
  let mounted = await renderApp();
  await click(button("Enter Neverending Math"));
  await click(button("Open objects collection"));
  assert.match(document.body.textContent, /0 FOUND/);
  assert.match(document.body.textContent, /THE SHELVES ARE QUIET/);
  assert.equal(document.querySelectorAll(".collection-item").length, 0);
  assert.doesNotMatch(document.body.textContent, /OLD BRASS SCHOOL BELL/);

  const first = startSession(parseProgress(null), "2026-09-20");
  const completed = completeSession(first.progress, first.session.id, first.session.questions.map(() => "first"));
  await act(async () => { mounted.root.unmount(); });
  mounted = await renderApp(JSON.stringify(completed));
  await click(button("Enter Neverending Math"));
  await click(button("Open objects collection"));
  assert.match(document.body.textContent, /1 FOUND/);
  assert.match(document.body.textContent, /OLD BRASS SCHOOL BELL/);
  assert.equal(document.querySelectorAll(".collection-item").length, 1);
  assert.doesNotMatch(document.body.textContent, /FOUNTAIN PEN/);
  await act(async () => { mounted.root.unmount(); });
});

test("a partial collection keeps all ten discoveries in chronological order and reveals no future objects", async () => {
  const mounted = await openCollection(collectionProgress(10));
  const items = [...document.querySelectorAll(".collection-item")];
  assert.equal(items.length, 10);
  assert.deepEqual(items.map(item => item.dataset.collectibleId), collectibles.slice(0, 10).map(([id]) => id));
  assert.match(items[0].textContent, /OLD BRASS SCHOOL BELL/);
  assert.match(items[9].textContent, /BRASS PROTRACTOR/);
  assert.doesNotMatch(document.body.textContent, /POCKET WATCH/);
  await act(async () => { mounted.root.unmount(); });
});

test("the full collection exposes every discovery exactly once, including first and thirtieth", async () => {
  const mounted = await openCollection(collectionProgress(30));
  const items = [...document.querySelectorAll(".collection-item")];
  const ids = items.map(item => item.dataset.collectibleId);
  assert.equal(items.length, 30);
  assert.equal(new Set(ids).size, 30);
  assert.deepEqual(ids, collectibles.map(([id]) => id));
  assert.ok(button("Inspect OLD BRASS SCHOOL BELL"));
  assert.ok(button("Inspect LAMP PULL"));
  await act(async () => { mounted.root.unmount(); });
});

test("an early unplaced object remains selectable and placeable after later discoveries", async () => {
  const mounted = await openCollection(collectionProgress(20, ["pen"]));
  await click(button("Inspect OLD BRASS SCHOOL BELL"));
  await click(button("PLACE IN THE STUDY →"));
  assert.match(document.body.textContent, /OLD BRASS SCHOOL BELL/);
  await click(button("PLACE THIS IN THE STUDY →"));
  const saved = parseProgress(stored());
  assert.ok(saved.placedIds.includes("bell"));
  assert.equal(saved.placedIds.filter(id => id === "bell").length, 1);
  await click(button("Return to collection"));
  assert.ok(button("Inspect OLD BRASS SCHOOL BELL"));
  assert.match(button("Inspect OLD BRASS SCHOOL BELL").textContent, /IN THE STUDY/);
  await act(async () => { mounted.root.unmount(); });
});

test("an interrupted session resumes its stored content and checkpoint", async () => {
  let mounted = await renderApp();
  await click(button("Enter Neverending Math"));
  await click(button("Begin today’s mathematics"));
  await click(button("BEGIN →"));
  const interrupted = parseProgress(stored());
  const original = interrupted.sessions.at(-1);
  assert.equal(original.checkpoint.phase, "warmup");

  await act(async () => { mounted.root.unmount(); });
  mounted = await renderApp(JSON.stringify(interrupted));
  await click(button("Enter Neverending Math"));
  await click(button("Begin today’s mathematics"));
  assert.match(document.body.textContent, /1 OF 8/);
  const resumed = parseProgress(stored()).sessions.at(-1);
  assert.equal(resumed.id, original.id);
  assert.deepEqual(resumed.warmups, original.warmups);
  assert.deepEqual(resumed.questions, original.questions);
  await act(async () => { mounted.root.unmount(); });
});
