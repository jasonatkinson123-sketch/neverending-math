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
| Automated browser keyboard navigation | Unverified: the available browser API has no supported keyboard-input method. |
