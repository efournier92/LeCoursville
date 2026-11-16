# Engineer Prompt: Implement And Redteam The 2026-11-08 UI Review Batch

Hand this file to a fresh autonomous implementation-and-redteam agent. It is self-contained. It implements every open UI review item on the branch `2026-11-08_UxReview`, verifies with the repository gate, and runs a redteam pass after each workstream. It does not deploy.

## Role And Mission

You are the build-and-redteam engineer for the LeCoursville 2026-11-08 UI review batch. Work autonomously. Implement every open item UI-001 through UI-031 in workstream order, ship e2e coverage in the same commit as every user-visible behavior, and redteam each workstream before moving on. Do not invent decisions. The plan's Resolved Answers and the specs are binding.

## Workspace And Branch

- Repository root: `/Users/e/mnt/bnk/cs/lecoursville`.
- Branch: `2026-11-08_UxReview`. Create it off the current default branch if it does not exist, and confirm the tree is clean before you start.
- One branch for the whole batch, one commit series per workstream. This supersedes the per-workstream branch strategy in the plan for this run.
- Never force-push, never rewrite history, never merge to the default branch.
- Committing on the branch is in scope. Pushing, merging, and deploying are not. Leave those to a human.

## Reading Order

1. `AGENTS.md`, for the mandatory e2e rule and the gate.
2. `docs/testing/TEST_POLICY.md`.
3. `docs/critique/2026-11-08_UiReviewPlan.md`, the dispositions, workstreams, Resolved Answers, and merge order.
4. The specs in `docs/specs/2026-11-08_*.md`, named per workstream below.
5. `docs/critique/2026-11-08_UiReviewInstructions.md`, for item context and IDs.
6. `src/styles.scss`, for the current palette and token block.
7. `docs/discovery/DISCOVERY.md`, for prior traps. Return new discovery candidates to the operator, do not write the index yourself.

## Do Not Redo Already-True Work

These were verified and must not be re-implemented. Treat them as constraints.

- Brand primary is already `#27744A`, and `--color-brand-solid` is already theme-invariant at the same value.
- Filled buttons and the admin nav badge already use `--color-brand-solid`.
- Role badges are already tokenized as `--role-*-bg/fg`, though still indigo and purple.
- Destructive dialogs already carry `[class.btn-destructive]` and `destructive?: boolean`.
- There is no `e2e/specs/theme.spec.ts` and no `dialogs.spec.ts`. Put theme and dialog assertions in `dark-mode.spec.ts` and `edge-cases.spec.ts`.

## Workstream Order And Specs

Run WS1 first. Then WS2, WS4, WS5, WS6, WS7. Run WS3 only after WS2 with UI-014 merged into the branch. Treat WS8 as two final independent cycles.

| WS | Items | Spec |
|---|---|---|
| WS1 | UI-001, 002, 009, 010, 017, 022, 025, 026, 031 | `docs/specs/2026-11-08_PaletteAndControlStandardization.md` |
| WS2 | UI-007, 014, 015, 016, 023, 027, 028, 029, 030 | `AdminShellAndNavigation.md`, `AdminPeopleBrowser.md`, `LoadingAndEmptyStatesAudit.md` |
| WS4 | UI-011, 012 | `AuthSignInAndSignUp.md` |
| WS5 | UI-003, 006, 018 | `CalendarPaletteTagsMobile.md` |
| WS6 | UI-020, 021, 024 | `MediaPlaybackAndActions.md` |
| WS7 | UI-004, 019 | `ResponsiveToolbarsAndNav.md` |
| WS3 | UI-013 | `LegacyContactRetirement.md` |
| WS8 | UI-005, 008 | `DataRightsFooter.md`, `DevSeedModule.md` |

Dependency gates are hard. Do not start UI-003 or UI-031 before the WS1 tokens land. Do not start UI-013 before the UI-014 People surface exists. UI-005 and UI-008 are independent cycles, not part of the core merge.

## Binding Decisions

- UI-005 uses a Realtime Database `dataRequests` queue, not Firestore. Removal is a hard delete after email verification and admin review, with a manual pre-delete export and a minimal non-PII audit entry. Legal copy stays short, safe, and human-reviewed.
- UI-008 downloads assets at seed time to a gitignored cache, clears the cache after the run, and adds one pinned-fixture Admin Media Upload e2e spec. Never fetch live during the gate.
- UI-012 signup is open, server approval required, 8-character minimum, no email-verification gate before approval.
- UI-013 migration runs dev then prod, dry-run by default, `--confirm` required, no legacy data preserved.
- UI-014 person detail reuses `person-detail-modal`. CSV import becomes a toolbar action.
- UI-029 uses a sibling `promotedRoutePending`. Allowed pending routes are `/photos`, `/media/video`, `/media/audio`, `/expressions`, `/account`, `/upload`. Default `/photos`.
- UI-026 converts all data-bound booleans to `mat-slide-toggle`. Future row-selection checkboxes stay checkboxes.
- UI-009 uses brand Yes and neutral No for benign confirms, error-solid on the destructive action and neutral Cancel for destructive confirms. Never paint No red.
- UI-027 bumps `package.json` in `deploy.sh` with `npm version --no-git-tag-version` and commits the bump with the release. This is deploy-affecting and needs human sign-off.
- UI-003 family color falls back to `var(--color-brand-primary)`.
- UI-019 keeps text labels, stacked and left-aligned on mobile.

## Commit Discipline

- One commit per workstream, or a small sequence within a workstream, each with its tests.
- Commit body records the spec path, the behavior assertion, and the red proof for any critical path, per `TEST_POLICY.md`.
- Never commit a red or skipped gate. Never commit secrets, emulator data, or a download cache.
- Stage only intended files. Do not commit `src/environments/build-info.ts`, the dev-seed cache, or generated emulator output.

## Mandatory E2E Rule

Every user-visible change ships with a Playwright spec under `e2e/specs/` in the same commit. No exception. In specs:

- Import `test` from `e2e/helpers/fixture.ts`, never from `@playwright/test`.
- No `test.skip`, no `test.fixme`, no `.only`.
- `retries` stays `0` in `playwright.config.ts`.
- Deterministic waits only. No arbitrary sleeps.
- Restore every mutated state in `afterEach`, especially feature flags. Chat is seeded off.
- Extend `scripts/e2e/seed.mjs` for new fixtures. Never hand-edit the emulator.
- A bug-fix spec must be shown red on the unfixed code, then green.

## Palette And Token Contract

- No raw hex or `rgba()` color literal outside `src/styles.scss`. Raw `rgba()` shadows are allowed only through a `--shadow-*` token.
- Every new semantic color gets a token in the light `html` block, and any color-bearing override is re-emitted in the `html[data-theme="dark"]` block. Dark parity is part of done.
- The one brand solid is theme-invariant `--color-brand-solid` `#27744A` with `--color-on-brand-solid` ink.
- Role badges use the brand family after UI-031, not the old indigo and purple.

## Done Checks

Per-workstream check is the one named in its spec. Every workstream also passes:

- `npm run e2e:gate` green on Chromium, WebKit, and Firefox with zero skipped, zero unexpected, zero flaky.
- `npm run test -- --watch=false` green.
- `npm run theme:check` green for palette or token changes.
- `npm run pii:check` green for people, contact, or seed changes.
- Markdown deliverables lint clean with no banned glyphs and no prose semicolons.
- `export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` before the emulator suite.

Record the exact command and result for each done claim. Intent is not evidence.

## Redteam Per Workstream

After a workstream is gate-green, redteam it before the next. Load the `redteam` skill if available. Write findings to a committed ledger at `docs/critique/2026-11-08_UiReviewRedteam.md` under a per-workstream heading. Do not fix during the redteam pass. Fix confirmed findings in a follow-up commit on the same branch.

Lenses for every pass:

- Privacy and PII.
- Security, auth, guards, and rules.
- Accessibility, keyboard, focus, ARIA, contrast, reduced motion.
- Dark patterns, confirm color, consent, and the footer request flow.
- Visual consistency, palette, radius, and control drift.
- Mobile at phone viewport.
- Regressions across every spec the change could break.
- Test quality, false greens, weak assertions, missing red proofs.

## WS8 Human Gates

- UI-005: build the RTDB queue, footer, and admin surface. Mark the final short legal copy as pending human review. Do not present placeholder copy as final.
- UI-008: build the module, manifest, license ledger, project guard, `--confirm`, `--clean`, and the pinned-fixture e2e spec. Do not run a dev seed or a dev deploy. Those are human-gated.
- UI-013: do not run the migration against any project. Provide the script, the dry-run, and the runbook only.

## Hard Stops

- Never deploy, and never run `deploy:prod` or `deploy:dev` without explicit human sign-off.
- Never touch the Firebase console, real projects, or production or development databases. The gate is emulator only.
- Never bypass or skip the gate.
- Never invent final legal copy.
- Never change a shared data contract or schema without the approving spec.
- Never run a destructive migration or hard delete without explicit human confirmation and a dry-run first.
- Never delete migration data in prod before the code that stops writes has shipped.

## Escalation

If a spec is ambiguous, if the gate cannot go green, or if a finding contradicts the plan, stop and report with the blocking item, the evidence, and the decision you need. Do not guess.

## Final Report

Return one report with:

1. What shipped, per workstream and per item ID.
2. The branch name and the commit list.
3. Gate evidence, the exact commands and results.
4. Redteam ledger path and findings resolved, deferred, or open.
5. Open items and the human decisions still needed, including UI-005 legal copy, UI-008 dev run, and UI-013 prod migration.
6. Any discovery candidates for the operator to log.
