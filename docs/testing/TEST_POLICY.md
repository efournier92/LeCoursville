# Test Policy

This file is the single test policy for the repository.
`AGENTS.md` points here; every behavior change follows it.

## Coverage Bar

- Coverage is risk-based. There is no numeric coverage threshold.
- Rank gaps by user-visible blast radius, not by file count.
- A critical path is a flow whose failure loses data, grants or denies access, publishes or deletes content, or blocks a core page.
- Every critical path has a test that fails when its behavior breaks.
- Cover trust boundaries and data integrity at the lowest layer that can prove them.
- Assert stored state and visible state, not the request that was sent.
- A create or edit flow that asserts only in-place text reloads before the assertion.
- A test that passes while the behavior it names is broken is a false green; rewrite it or delete it with evidence.

## Layer Routing

One behavior, one owner.
Rules and callable logic are tested once, at the lowest layer that can prove them.

| Layer | Owns | Does not own |
|---|---|---|
| Angular unit (`src/**/*.spec.ts`, vitest via `ng test`) | Pure transforms, guards, payload builders, path safety, RTDB shape, component template behavior with mocked services | Real RTDB, real callables, real Storage |
| Functions unit (`functions/src/*.spec.ts`, vitest) | Callable authorization, validation, stored state, audit rows, caps, alert fan-out | Browser UI, real AWS or email |
| E2E rules (`e2e/specs/rules.spec.ts`, once per gate) | RTDB rules enforcement through REST, callable denial that cannot be proven in unit mocks | Visual layout |
| E2E storage (`e2e/specs/storage-rules.spec.ts`, once per gate, prod rules config) | Deployed Storage rule boundaries | App UI |
| E2E browser (chromium, webkit, firefox) | User-visible flows, guards, routing, rendering, persistence through the real UI | Logic that a unit test can prove |
| Contract seam | Seed shape used by both functions and e2e | Production data |

## Red Proof

- A red proof breaks the protected behavior, observes the named test fail, restores the code, and observes the test pass again.
- Every high-risk test ships with a red proof; high-risk means the test guards a critical path.
- Record the focused test command and the observed failure in the commit body.

## No Skip, No Fixme, No Only, No Retries

- No `test.skip`, no `test.fixme`, and no `.only` in any spec.
- `retries` stays 0 in `playwright.config.ts`.
- A flake is diagnosed and fixed with evidence, never retried away.

## Deterministic Waits

- Wait on visible content, stored state, or network quiescence.
- No arbitrary sleeps or fixed timers; a timer that passes today can flake or hide a real failure under load.
- Replace a sleep only when the replacement assertion is at least as strong.

## State Restoration

- Every mutation of seed state is restored in a `finally` or `afterEach`, even when the test fails.
- The restore runs before anything that can throw; a failed assertion must not skip it.
- Restore feature flags especially; chat is seeded OFF.
- A test that changes a seeded auth password restores it.

## Seed Changes

- A spec that needs new fixtures extends `scripts/e2e/seed.mjs`.
- Never hand-edit the emulator database.
- Do not mutate a seeded record that another test in the same browser project depends on.
- The gate reseeds before each browser project.

## Console Collector

- Import `test` from `e2e/helpers/fixture.ts`, never from `@playwright/test`.
- The fixture registers a shared `afterEach` that asserts the collected errors are clean for every importing spec.
- Console errors, page errors, and request failures fail the test unless allowlisted.
- Allowlist entries live in `e2e/helpers/console.ts` and each carries a written reason.
- Add no entry until a run shows a legitimate expected failure; add it with a one-line reason.

## Test Deletion

- Delete a test only with evidence: it duplicates an owner that proves the same behavior, or it asserts no behavior.
- Name the replacement in the commit, or state the reason no replacement is needed.

## The Prod Rules Pass

- The gate executes `storage.rules.prod` exactly once, in a separate emulator pass before the browser runs.
- `scripts/e2e/prod-rules-config.mjs` writes a throwaway config in the OS temp directory; it never references a real project or credential.
- `e2e/specs/storage-rules.spec.ts` runs in that pass under the `storage-prod` project and pins the deployed member and stranger boundaries.
- The local `storage.rules` stays open so the gate can seed fixtures; deploys always select `storage.rules.prod`.
- A test that pins an accepted risk carries a header comment naming the risk and the ledger id; it records current policy, it does not endorse it.
- Changing the deployed rules posture is a policy decision with a ledger entry, not a test edit.

## The Pre-Deploy Gate

- `npm run e2e:gate` runs before every deploy: `scripts/deploy.sh` gates before any build, tag, or deploy step.
- A green gate still requires the human sign-off in `scripts/deploy.sh`: any input containing `deploy` or `yes` (any casing), or a bare `y`/`d`; Enter aborts.
- A red gate blocks the default path but prints the report paths and asks for the same confirmation, or `E2E_FORCE=1` non-interactively. The override is always a human decision.
- `SKIP_GATE=1` (`npm run deploy:dev:nogate`, `npm run deploy:prod:nogate`) skips the gate for a build whose gate already passed; sign-off and the bundle identity check still apply.
- The gate is emulator only; it never touches the Firebase console, real projects, or production or development databases.
- The gate runs the prod-rules pass and the rules suite once each, then each browser project with a fresh seed.
- The gate must be green on chromium, webkit, and firefox with 0 skipped, 0 unexpected, and 0 flaky.
- Java is required by the emulator suite: `export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`.

## Review Checklist

The checklist below is required in every behavior-change commit or PR body.

| Change Type | Required Tests | Evidence To Record |
|---|---|---|
| New behavior | E2E spec in the matching domain; unit or functions spec where the layer table assigns the logic | Spec path, the behavior assertion, and a red proof when the path is critical |
| Changed behavior | The owning spec updated to assert the new behavior; write flows assert after a reload | Spec path and the updated assertion |
| Bug fix | A spec that fails on the unfixed code and passes with the fix | Red proof command and the failure observed before the fix |
| Rules change | RTDB boundary in `e2e/specs/rules.spec.ts`; Storage boundary in `e2e/specs/storage-rules.spec.ts` | The rules spec and assertions covering the new boundary, plus a red proof against the old rule |
| Data migration | Unit or functions spec asserting the transformed stored state; e2e spec for any user-visible effect | Spec path and the stored-state assertion |
| UI-only change | E2E browser spec asserting the rendered behavior; no unit spec for pure layout | Spec path and the render assertion |

## Coverage Signal

- The coverage attempt is `CI=true npm test -- --watch=false --coverage` from the repository root, run 2026-10-23.
- It fails before any test runs; the provider error is `Code coverage requires either "@vitest/coverage-v8" or "@vitest/coverage-istanbul" to be installed.`
- The numeric signal is unavailable without a new runtime dependency, and none is added.
- The risk-ranked gap inventory in `docs/specs/2026-10-23_TestSuiteHardening.md` is the coverage signal.
- No numeric threshold exists and nothing gates on one.
