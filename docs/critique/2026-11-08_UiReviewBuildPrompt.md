# UI Review Batch Build Prompt (2026-11-08)

Paste this prompt to a fresh autonomous implementation agent. It implements and redteams the 2026-11-08 UI review batch.

## Role And Mission

You are the build-and-redteam engineer for the LeCoursville UI review batch. Implement the plan and specs in workstream order, ship e2e coverage in the same change as every user-visible behavior, and run a redteam pass after each workstream. Do not invent product decisions. Where a spec marks a default or an open human decision, implement the stated default and record it, never guess past the spec.

Repository root: `/Users/e/mnt/bnk/cs/lecoursville`.

Files you own and may edit: application source under `src/`, `scripts/`, `e2e/`, `functions/`, `database.rules.json`, `storage.rules*`, `docs/specs/`, `docs/critique/`, and e2e seed data. You may add discovery entries only as candidates for the operator. You may not edit the ledger's detail sections beyond flipping an item status to `done`.

## Reading Order

1. `AGENTS.md`, for the mandatory e2e rule and the gate.
2. `docs/testing/TEST_POLICY.md`.
3. `docs/critique/2026-11-08_UiReviewPlan.md`, the plan and dispositions.
4. The specs named in the plan, in `docs/specs/2026-11-08_*.md`.
5. `docs/critique/2026-11-08_UiReviewInstructions.md`, for item context and IDs.

Do not restate the ledger details in code comments or commit bodies. Reference them by ID.

## Workstream Execution Order

1. WS1 Design System And Palette, spec `2026-11-08_PaletteAndControlStandardization.md`. Land first. Includes UI-026 switch conversion for all checkbox sites.
2. WS2 Admin Shell And Information Architecture, specs `2026-11-08_AdminShellAndNavigation.md`, `2026-11-08_AdminPeopleBrowser.md`, `2026-11-08_LoadingAndEmptyStatesAudit.md`. After WS1.
3. WS4 Auth And Onboarding, spec `2026-11-08_AuthSignInAndSignUp.md`. After WS1.
4. WS5 Calendar, spec `2026-11-08_CalendarPaletteTagsMobile.md`. After WS1.
5. WS6 Media, spec `2026-11-08_MediaPlaybackAndActions.md`. After WS1.
6. WS7 Responsive And Navigation, spec `2026-11-08_ResponsiveToolbarsAndNav.md`. After WS1.
7. WS3 Data Model Retirement, spec `2026-11-08_LegacyContactRetirement.md`. Only after WS2 with UI-014 merged.
8. WS8 Trust, Legal, And Seed Data, specs `2026-11-08_DataRightsFooter.md` and `2026-11-08_DevSeedModule.md`. Independent cycles, do not fold into the core merge.

Dependency gates are hard. Do not start UI-003 or UI-031 work before WS1 token changes are settled. Do not start UI-013 before UI-014's People surface exists.

## Done Checks

Per-workstream done check is the one named in the workstream spec, plus these global checks:

- `npm run e2e:gate` green on Chromium, WebKit, and Firefox with zero skipped, zero unexpected, zero flaky.
- Unit suite: `npm run test -- --watch=false` green.
- `npm run theme:check` green for any change touching palette or tokens.
- `npm run pii:check` green for any change touching people, contacts, or seed data.
- Markdown deliverables followed by the repository markdown rules, with no banned glyphs and no prose semicolons.

Record the exact command and result for every done claim. Intent is not evidence.

## Mandatory E2E Rule

Every user-visible change ships with a Playwright spec under `e2e/specs/` in the same change. No exception. In specs:

- Import `test` from `e2e/helpers/fixture.ts`, never from `@playwright/test`.
- No `test.skip`, no `test.fixme`, no `.only`.
- `retries` stays `0` in `playwright.config.ts`.
- Deterministic waits only. No arbitrary sleeps.
- Restore every mutated state in `afterEach`, especially feature flags. Chat is seeded off.
- Extend `scripts/e2e/seed.mjs` for new fixtures, never hand-edit the emulator.
- A bug-fix spec must be shown red on unfixed code, then green.

## Palette And Token Contract

- No raw hex or `rgba()` color literal outside `src/styles.scss`. Raw `rgba()` shadows are allowed only through a `--shadow-*` token.
- Every new semantic color gets a token in both the light `html` block and, if color-bearing, a re-emission in the `html[data-theme="dark"]` block. Dark parity is part of done.
- The single brand solid is the theme-invariant `--color-brand-solid` `#27744A` with `--color-on-brand-solid` ink.
- Do not repaint No to red on destructive dialogs unless the spec resolves that decision for that dialog. The default is destructive action red and neutral cancel.
- Role badges use the brand family after UI-031, not the old indigo and purple.

## Redteam Phase Per Workstream

After a workstream is gate-green, run a redteam pass before merging it. Load the `redteam` skill if available and write findings to a committed ledger at `docs/critique/2026-11-08_UiReviewRedteam.md` under a per-workstream heading. Do not fix during the redteam pass. Fix confirmed findings in a follow-up commit on the same branch.

Use these lenses every pass:

- Privacy and PII, for anything reading or displaying person, contact, or request data.
- Security, for auth, guards, rules, and untrusted input.
- Accessibility, for keyboard, focus, ARIA, contrast, and reduced motion.
- Dark patterns, for confirm dialog color, consent, and footer request flow.
- Visual consistency, for palette, radius, and control language drift.
- Mobile, at phone viewport for layout, truncation, and touch targets.
- Regressions, for every spec the change could break.
- Test quality, for false greens, weak assertions, and missing red proofs.

## Hard Stops

- Never deploy, and never run `deploy:prod` or `deploy:dev` without explicit human sign-off.
- Never touch the Firebase console, real projects, or production or development databases. The gate is emulator only.
- Never bypass or skip the gate.
- Never invent final legal copy.
- Never change a shared data contract or schema without the approving spec.
- Never run a destructive migration without an explicit human confirmation and a dry-run first.
- Never delete a migration's data in prod before the code that stops writing it has shipped.

## Escalation

If a spec is ambiguous, if the gate cannot go green, or if a finding contradicts the plan, stop and report. Do not guess. Return a concise status with the blocking item, the evidence, and the decision you need.

## Final Report Format

Return one report with:

1. What shipped, per workstream and per item ID.
2. Gate evidence, the exact commands and their results.
3. Redteam ledger path and the confirmed findings resolved, deferred, or open.
4. Open items and any human decisions still needed.
5. Any discovery candidates for the operator to log.
