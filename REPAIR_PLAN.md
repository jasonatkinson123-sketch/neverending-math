# Playability repair plan

## Baseline

- **Commit under test:** `7dc62c563f1f3735f8b5463752c58c797d0e1b61` — *Repair challenge fitting and Study placement*.
- **Working tree at baseline:** clean. This diagnostic adds only this plan and test-only fixtures; it does not change learner-facing behavior.
- **Product contract:** [PRODUCT_RULES.md](PRODUCT_RULES.md).

## Deterministic fixtures

`tests/playability-fixtures.mjs` supplies development/test-only fixtures. It uses the
production question generator and production `startSession`/`checkpointSession` functions.

- one longest generated prompt for each supported skill, found from the same seeded generator;
- Challenge states: answering, retry/hint, review/explanation, and prime-factor formatting;
- 30 collected objects with the Bell still unplaced; and
- 30 collected objects with the Bell already placed.

These fixtures are not exposed to learners and never write to ordinary user progress.

## Reproducible baseline failures

### 1. Challenge fitting is not a measured layout contract

**Reproduction:** Render each `representativeQuestions[skill]` in `fixtureProgress({ skill })`,
then inspect the Challenge at the target viewport with retry/review text visible.

**Observed code path:** `app/question-display.ts` classifies only by skill and prompt length.
`app/globals.css` positions the prompt, feedback, input, helper text, Check, and Skip using
independent percentages inside an `overflow:hidden` 4:3 artboard. The `sentence-long` rule
allows visible overflow rather than reserving space, so prompt text can paint into feedback or
controls. The jsdom test proves only that a class and buttons exist; it cannot measure clipping
or overlap.

**Next repair:** give Challenge one responsive content layout with a bounded question region,
normal document flow for feedback/actions, readable type minima, and a real-browser geometry gate.

### 2. The app has no working portrait-phone layout contract

**Reproduction:** Open a Challenge at 390 × 844. The game shell remains a width-constrained
4:3 stage, while `body`, `.game-shell`, and `.stage` hide overflow. The controls remain
percentage-positioned against the shortened stage.

**Suspected cause:** `app/globals.css` globally uses `overflow:hidden` and a fixed 4:3 stage;
the mobile media rule changes a few widths but does not turn Challenge or Study into a responsive
flow.

**Next repair:** preserve the art layer, but make the interactive layer use safe-area-aware,
portrait-capable layout with natural scrolling where content needs it.

### 3. Placement is state-correct but spatially unreliable after eight objects

**Reproduction:** Use `placementFixtures.earlyUnplacedWithThirty`, open Collection, choose Bell,
choose Place in the Study, then inspect Study. Repeat after placing enough objects to exceed eight.

**Observed code path:** `app/page.tsx` stores only `placedIds`; Study assigns the visual location
with `index % 8`, while CSS defines only eight `study-object-*` positions. The ninth placed object
reuses an earlier position. Existing tests prove the array changes but not reachability, occlusion,
or placement-button bounds.

**Next repair:** keep the full artistic Study redesign out of scope, but introduce a deterministic,
distinct and accessible fallback placement representation before locations repeat.

### 4. Transitions can apply after their screen/session is no longer current

**Reproduction:** Submit an answer, then navigate/reload/change Settings before the 650–1200 ms
feedback delay completes. Repeat Check/Enter rapidly while a successful answer is advancing.

**Observed code path:** `finishWarm()` and `advance()` in `app/page.tsx` schedule unowned
`setTimeout` callbacks. Only voice restart timers are cleared on navigation/unmount. The checkpoint
does not persist retry/review state, and display text (`"LET’S REVIEW IT"`) also controls behavior.

**Next repair:** explicit answer state, a single transition timer with cancellation/generation
guards, and durable retry/review checkpoint data.

## Commands and gates

| Gate | Command or procedure | Baseline status |
| --- | --- | --- |
| Fast logic/component checks | `node --test tests/*.test.mjs` | Passes with the fixture catalog. |
| Full build and test suite | `npm test` | **Passes: 38 tests.** |
| Adaptive/reward regression | `npm run diagnose:30-days` | **Passes:** 30 daily sessions, 30 distinct collectibles. The pre-existing LCM secure/not-due repetition diagnostic remains reported. |
| Challenge browser geometry | Fixture per skill × answering/retry/review × target viewports | Not yet available as an automated browser gate. |
| Collection/Study browser journey | 30-object early unplaced + already-placed fixture | Not yet available as an automated browser gate. |

## Browser coverage

| Requested viewport | Status | Evidence/limitation |
| --- | --- | --- |
| 390 × 844 phone | **Unverified** | The available cloud-browser API does not expose supported viewport resizing. |
| 1366 × 768 Chromebook | **Partially observed** | The available browser is 1363 × 936, so it is close in width but not height. It cannot establish Chromebook coverage. |
| 1440 × 900 desktop | **Unverified** | The available browser cannot resize to this viewport. |

The live preview was opened at 1363 × 936. It confirms the baseline app serves and renders its
entry screen. It cannot safely inject the test-only localStorage fixtures, so it does not verify
the requested full Challenge or Collection-to-Study fixture paths. This limitation is deliberate:
browser evidence must not be fabricated from jsdom or force-clicks.

## Ordered repair stages

1. **Challenge layout:** use fixture prompts and states to replace percentage collision with a
   responsive content layout while keeping the art.
2. **Collection → Study:** make pending placement visible/reachable and provide an accessible
   fallback for placements beyond eight objects.
3. **Journey integrity:** own/cancel timers, make question state explicit, prevent duplicate
   submissions, and persist retry/review state.
4. **Persistence hardening:** validate saved checkpoints; reject obsolete/superseded session
   completion; decide and document date/cross-tab policy.
5. **Acceptance:** run actual fixed-viewport browser geometry tests, keyboard flow, and full
   learner journey before any deployment is considered.

## Verification still outstanding

- actual phone, Chromebook, and 1440 × 900 browser coverage;
- rendered bounds, font sizes, overlap, and touch target checks;
- real browser flow through every fixture rather than jsdom element existence;
- a 9th and later Study placement that stays accessible;
- rapid submission, reload during retry/review, and late-timer behavior;
- keyboard-only traversal and voice-failure fallback in the browser.

## Stage 1 update — Challenge layout repair

### Change made

The Challenge now has one `.challenge-layout` content surface above the unchanged board art.
It uses a grid to reserve distinct regions for the session label, question, feedback, answer
controls, optional factor-format instruction, and Skip action. The old percentage-positioned
Challenge elements are no longer rendered. The question uses container-query sizing: compact
expressions retain a large presentation, while sentence prompts wrap in their bounded region.
The surface can scroll rather than clip when a short viewport or on-screen keyboard reduces
available height. Portrait Challenge mode expands the interactive stage to the dynamic viewport
and switches answer controls to one column.

Every answer action has a `min-height` of `2.75rem` (44 CSS pixels), and feedback is a normal
grid row rather than an element that can paint over the form.

### Automated coverage added

- `tests/product-flows.test.mjs` mounts the real Challenge for the deterministic representative
  prompt of every supported skill, verifies the contained question surface and the actual input,
  Check, and Skip controls, and tests review feedback plus the prime-factor format instruction.
- The fixtures still use production question/session functions and remain test-only.

### Actual browser evidence

At the available browser viewport of **1363 × 936**, a normal live session was taken through all
eight warm-up facts and into the Challenge. The generated GCF sentence prompt, retry hint, and
review explanation were measured in the rendered page:

- question: `top 372.34`, `bottom 465.56`;
- feedback: `top 678.84`, `bottom 730.84`;
- answer form: `top 742.06`, `bottom 828.13`;
- Skip: `top 839.34`, `bottom 883.34`, `height 44`.

Those regions do not overlap; the input and submit controls measured 58.88 px high. This is
real-browser evidence for a desktop-width viewport, not a substitute for the requested fixed
phone, Chromebook, and desktop sizes.

### Verification status after this stage

| Gate | Status |
| --- | --- |
| `npm test` | **Passes: 39 tests.** Build, component/flow tests, fixtures, and existing regression tests pass. |
| `npm run diagnose:30-days` | **Passes:** 30 daily sessions, 30 distinct collectibles. The pre-existing LCM secure/not-due repetition diagnostic remains reported; this layout-only stage did not alter adaptive behavior. |
| 390 × 844 phone / portrait and landscape | Unverified: the cloud browser API cannot set a viewport. The responsive CSS path is covered structurally but needs a browser capable of fixed viewport emulation. |
| 1366 × 768 Chromebook | Partially observed only at 1363 × 936; height-specific verification remains outstanding. |
| 1440 × 900 desktop | Unverified: the cloud browser API cannot resize. |
| Browser keyboard navigation | **Verified at 1363 × 936 only:** input, Tab, Check, retry, review, and Continue worked; requested device sizes remain unverified. |

## Independent verification — 2026-09-11

**Verdict: FAIL.** The structural repair improves separation at the one available browser size,
but it does not meet the requested acceptance gate. One concrete readability failure is present,
and most of the required viewport/fixture matrix remains unavailable rather than verified.

### Diff review

- Production changes are limited to Challenge markup/classification in `app/page.tsx` and
  Challenge CSS in `app/globals.css`.
- `app/math-system.ts`, `app/progress.ts`, `app/math-input.ts`, `app/voice-policy.ts`, and
  `app/collectibles.ts` are unchanged by commit `3948054`.
- `npm test` passes all 39 tests and `npm run diagnose:30-days` completes with the same 30-session,
  30-collectible result. The existing LCM secure/not-due diagnostic remains unchanged.
- The new component tests enumerate representative prompts, but jsdom cannot measure their
  rendered geometry. They are useful structural checks, not visual acceptance evidence.

### Browser evidence actually obtained

The supervised browser is fixed at **1363 × 936**. A fresh learner was taken through the real
eight-question Warm-Up and into a normal Daily Challenge without fixture injection or forced
clicks.

At this viewport:

- an exponent expression (`10³ = ?`) rendered at 70.61 px and remained inside its question row;
- question, feedback, answer form, and Skip occupied separate non-overlapping vertical bands;
- input and Check measured 58.88 px high; Skip measured exactly 44 px high;
- incorrect submission exposed the retry hint without overlap;
- a second incorrect submission exposed the review explanation without overlap;
- keyboard-only interaction worked for input → Tab → Check → Enter, retry via Enter, then
  Tab → Continue → Enter, with focus returning to the next answer input;
- the Check/Continue label rendered at only **13.68 px**, and Skip at only **12.16 px**. These are
  below the intended readable control-text minimum, so the available viewport itself fails the
  comfortable-readability requirement even though the controls are large enough to target.

### Required coverage still missing

| Requested evidence | Status | Reason |
| --- | --- | --- |
| Every skill's deterministic representative prompt | **Unverified** | Fixtures are test-only and the production UI exposes no safe fixture-loading seam; the browser's evaluation API is read-only. |
| Widest expression and longest sentence | **Unverified in browser** | Enumerated only by jsdom tests; no rendered bounds were measured for those exact fixtures. |
| Prime-factor format instruction | **Unverified in browser** | Verified only as DOM content in jsdom. |
| 390 × 844 phone, portrait/landscape | **Unverified** | The browser API exposes no viewport resizing or emulation. |
| 1366 × 768 Chromebook | **Unverified** | The available 1363 × 936 viewport does not exercise the substantially shorter height. |
| 1440 × 900 desktop | **Unverified** | The browser API exposes no viewport resizing. |

### Reproduction and likely cause

1. Start a fresh session and complete Warm-Up.
2. Enter Daily Challenge at a desktop-width viewport.
3. Inspect the computed type size of `.challenge-answer-form button` and `.challenge-skip`.
4. Observe approximately 13.68 px and 12.16 px respectively at 1363 × 936.

The cause is the container-relative minima in `app/globals.css`:
`clamp(.8rem,1.55cqw,1.12rem)` for Check/Continue and
`clamp(.76rem,1.35cqw,.95rem)` for Skip. Their lower bounds permit control text below 14 px.
The exact cross-viewport fitting gap is additionally caused by the lack of a browser-reachable,
development-only fixture seam and a fixed-viewport browser runner; current tests cannot establish
layout bounds at the required sizes.

## Stage 2 update — Challenge blocker and Collection → Study repair

### Changes made

- Challenge Check/Continue and Skip now have a 14 px minimum font size inside the responsive
  Challenge layout, resolving the concrete desktop readability failure recorded above.
- Study now renders a single `study-placement-panel` for the inspected object. Its details,
  description, placed state, and—only while the exact selected object is pending—its placement
  action occupy one stable, high-z-index surface above the artwork.
- The placement action has a 44 px minimum height, an object-specific accessible name, and is
  removed immediately after placement. Inspecting an already-placed object shows `IN THE STUDY`
  but no placement action.
- Existing `pendingPlacementId` and `placedIds` semantics are preserved. The state updater remains
  idempotent, so repeated clicks cannot add the same object twice. Returning to Collection clears
  pending placement without changing `placedIds`.

The eight visual Study positions remain intentionally unchanged. A 9th and later placed object
can still share a room position, but that does not obstruct the independent placement panel or
make an older collection object unreachable. A full 30-object artistic room layout remains a
separate, documented future stage.

### Tests and regression checks

- Added a 30-object late-discovery flow: select LAMP PULL, cancel, confirm no placement, place it,
  reload, then inspect it without a misleading placement affordance.
- Existing early-object, persistence, duplicate-prevention, empty-collection, and full-collection
  tests remain in place.
- `npm test` passes: **40 tests**.
- `npm run diagnose:30-days` passes unchanged: 30 daily sessions and 30 distinct collectibles.

### Browser verification limitation

The supervised browser still cannot set phone, Chromebook, or desktop target viewports, and its
session runner timed out while completing the 12-question path required to earn a fresh live Bell.
No browser evidence has been claimed for a completed Collection → Study flow in this stage.
The interaction is covered through the real React component and persistence functions in the
automated flow tests; browser verification of the exact requested device matrix remains
**unverified** and must be completed in an environment that supports fixed viewport emulation and
a stable longer-running session.

## Independent Collection → Study verification — 2026-09-11

**Verdict: BLOCKED.** The repaired flow passes a real-browser small-collection journey at the
one available viewport, but this environment cannot establish the required 30-object, early/late,
phone, Chromebook, and desktop matrix. Component tests are reported separately and are not being
treated as browser evidence.

### Browser evidence obtained

The supervised browser ran the real application at **1363 × 936**. Starting from its ordinary
persisted session, the learner journey was completed without fixture injection or force-clicks,
earning the first object through the normal Results and Reward screens.

For the one-object collection:

- Collection showed exactly `1 FOUND` and only `01 · OLD BRASS SCHOOL BELL`; no future object was
  exposed.
- Selecting the Bell exposed `PLACE IN THE STUDY →`. Keyboard Tab moved focus from the selected
  Bell to that action, and Enter opened the Study with the Bell still selected.
- Study showed the Bell name, `Found on Day 1`, and the object-specific action
  `Place OLD BRASS SCHOOL BELL in the Study` together in the placement panel.
- The action measured **471.63 × 44 px**, rendered at **15.2 px**, and its center hit-test resolved
  to the action itself. It was activated with Enter, not a forced click.
- The panel occupied `x 433.5–929.5, y 714.63–842.41`. The return control began at `y 851.77` and
  Go Home at `y 853.66`, so the panel and navigation did not overlap at this viewport.
- After placement, the action disappeared and `IN THE STUDY` appeared. After a full page reload,
  Collection still marked the Bell `IN THE STUDY`; opening `VIEW IN THE STUDY →` showed inspection
  details with no placement action. This is direct browser evidence for persistence and absence of
  a duplicate/misleading action in the small-collection case.

### Browser coverage not obtained

| Requested case | Status | Blocking reason |
| --- | --- | --- |
| 30 earned objects, early object unplaced | **Unverified in browser** | The production UI has no safe test-state loading seam, and the browser evaluation surface is read-only. Creating 30 daily rewards through ordinary interaction is not a practical fixture mechanism. |
| 30 earned objects, late object | **Unverified in browser** | Same limitation; no test-only state can be loaded through normal learner controls. |
| Small collection | **Verified at 1363 × 936** | Normal Day 1 completion, Bell placement, reload, and inspection succeeded. |
| 390 × 844 phone | **Unverified** | The supervised browser exposes no viewport resizing or emulation. |
| 1366 × 768 Chromebook | **Unverified** | Available viewport is 1363 × 936; its shorter-height behavior was not exercised. |
| 1440 × 900 desktop | **Unverified** | The supervised browser exposes no viewport resizing. |

The browser runner also timed out twice while advancing the existing twelve-question challenge;
the checkpoint survived and the session was eventually completed in shorter ordinary-interaction
steps. This did not corrupt the Day 1 reward or placement, but it prevents treating the runner as
a reliable long-sequence fixture mechanism.

### Component-test evidence (not browser evidence)

`tests/product-flows.test.mjs` mounts the production React component and production persistence
functions. It covers a 20-object collection with an early unplaced Bell and a 30-object collection
with the late LAMP PULL, including cancel/return, single placement, reload, placed inspection, and
duplicate prevention. Other component tests confirm all 30 earned IDs appear once in discovery
order and no unearned IDs are rendered. These checks establish state/DOM behavior, but jsdom does
not establish viewport geometry, overlap, scrolling reachability, or tap behavior.

### Reproduction required to close the block

In a browser runner that supports preloading an isolated test profile and fixed viewport sizes:

1. Load the existing `earlyUnplacedWithThirty` progress fixture into the isolated profile before
   application startup.
2. At 390 × 844, 1366 × 768, and 1440 × 900, open Collection and scroll from the first to the
   thirtieth earned object using ordinary wheel/touch/keyboard interaction.
3. Place the early Bell, reload, and inspect it; then repeat with the late LAMP PULL.
4. Record bounds and center hit-tests for the selected collection item, Collection action, Study
   panel/action, Return, and Go Home controls, and verify no pair overlaps.
5. Repeat with the small-collection fixture and an already-placed fixture. PASS requires all three
   viewport journeys to succeed without forced clicks and without exposing unearned objects.

## Stage 0 — Browser-test infrastructure capability check — 2026-09-11

**Baseline commit:** `c7b65dbcfeff701e4c1badb1615489db99ee59da` — *Record Collection placement verification*.

**Verdict: BLOCKED before implementation.** No production or learner-facing test-hook change was
made. The requested browser harness cannot be built or executed within the permitted capabilities
of this checkout and execution environment.

### What was checked

- The checkout contains deterministic, test-only fixtures in `tests/playability-fixtures.mjs` and
  component-flow coverage in `tests/product-flows.test.mjs`.
- `package.json` has no Playwright, Puppeteer, WebDriver, or other browser-runner dependency or
  script. `@playwright/test` appears only as an unresolved optional transitive entry in
  `package-lock.json`; it is not installed or resolvable in `node_modules`.
- No local Chromium, Chrome, Firefox, or Playwright browser executable is available in the runtime.
- The permitted supervised cloud-browser API supports ordinary navigation, click, keyboard, scroll,
  and read-only DOM/bounds inspection, but does **not** expose viewport creation/resizing/emulation
  or writable pre-start storage. Its page evaluation API is explicitly read-only.

### Consequence

The environment can still prove a normal small-collection journey at its fixed **1363 × 936**
viewport, as recorded above. It cannot safely or reproducibly do any of the required work below:

- open the real app at 390 × 844, 1366 × 768, and 1440 × 900;
- pre-load the existing 30-object fixture before application startup;
- reload that isolated fixture after an interaction; or
- run the 30-object early/late placement smoke test without attempting to manufacture thirty real
  daily completions through the UI.

Adding a learner-reachable storage override, writing through the cloud browser's read-only page
evaluation API, or replacing geometry evidence with jsdom would violate this repair stage's
boundaries. None was attempted.

### Required handoff to unblock Stage 1

Run the following in a trusted development/CI environment that provides a local browser executable
and allows a conventional browser runner (for example Playwright with its managed Chromium):

1. Add the runner as a **development-only** dependency and install its managed browser.
2. Start the existing application normally for test runs.
3. Use an isolated browser context per test. Add the existing
   `neverending-math-progress-v2` fixture to that context's localStorage **before** page navigation,
   then navigate to the ordinary application entry point.
4. Drive only ordinary visible controls; use no forced clicks. Run at 390 × 844, 1366 × 768, and
   1440 × 900.
5. Reuse `tests/playability-fixtures.mjs` for representative Challenge states, empty/small
   collection, 30-object early Bell, 30-object late LAMP PULL, and already-placed inspection.
6. Assert visible controls, scroll reachability, keyboard focus, bounds containment, non-overlap,
   44 px targets, reload persistence, exactly-once placement, and no unearned objects.

The fixture belongs solely to the browser context created by each test, never to ordinary learner
storage. This gives the needed test isolation without any production fixture loader or reward seed.

### Next stage once the handoff environment exists

Implement only the conventional browser-runner configuration and smoke tests described above.
Do not repair any learner-facing layout or placement behavior in that stage. Preserve any failing
browser assertion as the evidence for the following, narrowly scoped production repair.
## Stage 0.5 — Browser-test infrastructure (in progress)

**Baseline:** `7f26caa41bc267b5220a941b05f6149085911080` (`Record browser test infrastructure blocker`)

### Test-only architecture

- `npm run test:browser` first runs `scripts/prepare-browser-fixtures.mjs`. It
  loads the existing TypeScript fixture module through Vite SSR and writes only
  transient JSON to `.tmp/browser-fixtures.json`.
- Playwright reads that JSON in a fresh browser context for each scenario. An
  init script writes the real production key, `neverending-math-progress-v2`,
  before the application loads and fixes the session date to `2032-06-14`.
  Reloads retain changes made by the application because the seed runs only at
  context setup, never on navigation.
- The suite drives the application root and its normal UI. There are no fixture
  routes, learner-visible controls, or changes to production persistence.
- Chromium projects cover 390×844 phone viewport, 1366×768 Chromebook viewport,
  and 1440×900 desktop viewport. Phone Chromium checks responsive viewport
  behavior; it does not verify iPhone Safari or a physical mobile keyboard.

### Commands and CI

```sh
npm ci
npx playwright install --with-deps chromium
npm test
npm run diagnose:30-days
npm run test:browser
```

The manually triggered **Browser tests** workflow is in
`.github/workflows/browser-tests.yml`. It uses Node 22.13.0, installs Chromium
on GitHub-hosted Linux, runs the three commands above, and always uploads
`playwright-report/`, `test-results/`, generated fixture JSON, and Wrangler
logs. It has read-only contents permission and no deployment step.

### Fixture and scenario coverage

- One widest deterministic generated challenge prompt for each of the 12 skills.
- Retry/review reached through ordinary wrong answer submission, plus the real
  prime-factor format guidance and keyboard activation.
- Empty, three-object, and full 30-object collections.
- A Bell and LAMP PULL each unplaced in separate 30-object states, including
  normal scrolling, placement, reload, placed inspection, and duplicate checks.
- Real rendered geometry for containment/clipping, feedback/input/action
  separation, 44px controls, and ordinary click/keyboard reachability.

### Verification status and next step

- Fixture preparation succeeded locally: 12 supported skills and 30 collectible
  IDs were generated from production modules.
- `npm run start -- --hostname 127.0.0.1 --port 4173` starts a normal production
  Vinext server locally.
- This Work environment still has no installed Chromium; browser assertions are
  deliberately unverified locally. The GitHub Actions run is the authoritative
  browser execution. Its report, trace, screenshots, and videos will identify
  either test-infrastructure faults or real application failures.
- The committed test branch is `test/browser-infra` at
  `f8a4f3dbc5146ac3739ed9c2895c39331fff5f3e`.
- The configured GitHub connection can push commits and read Actions runs, logs,
  and artifacts, but it exposes no workflow-dispatch operation. It therefore
  could not start the required manual run. To run it, open
  `https://github.com/jasonatkinson123-sketch/neverending-math/actions/workflows/browser-tests.yml`,
  choose **Run workflow**, select `test/browser-infra`, and run **Browser tests**.
  Then record the resulting run URL, jobs, logs, report, traces, screenshots,
  and videos here.
- The next production repair is determined only by an executing browser failure;
  no production behavior changed in this stage.
