# Admin Facelift Handoff (2026-10-20)

## Current State

Done on branch `feat/admin-facelift`, cut from `master` at `aca0acb6`. Nothing
pushed, merged, or deployed. Commit range `d514aeae..HEAD`.

Phases 0 through 6 are complete and verified in the final session; Phase 7 is this handoff:

- Phase 0: baseline recorded in `design_specs/2026-10-20_admin_facelift_baseline.md`.
- Phase 1: every admin route is super-only; the sidebar and route paths derive
  from `src/app/admin/admin-nav.ts`; dead `/admin/calendar` navigation fixed;
  unused `AdminRoutingComponent` removed.
- Phase 2: shell skip target, drawer focus trap, aria-current, shell loading
  skeleton, responsive breakpoints.
- Phase 3: all nine pages rebuilt on shared states, confirmation, responsive
  tables, and pagination where lists grow.
- Phase 4: visual critique converged; ledger in
  `design_specs/2026-10-20_admin_facelift_critique.md`.
- Phase 5: redteam converged under the three-round cap; ledger in
  `docs/critique/2026-10-20_admin-facelift.md` (59 findings).
- Phase 6: loading contract extended to admin routes; full gate green.

Working tree: clean apart from this handoff commit.

## Final Verification

- Unit: `CI=true npm test -- --watch=false` -> 78 files, 363 tests passed.
- Gate: `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home npm run e2e:gate`
  -> chromium 131 passed, webkit 131 passed, firefox 131 passed. 393
  executions, 0 failed, 0 skipped, retries 0.
- Chromium-only iteration command:
  `npx ng build --configuration=e2e` then
  `firebase emulators:exec --project lecoursville-dev --only auth,database,storage,hosting,functions "node scripts/e2e/seed.mjs && npx playwright test --project=chromium"`
- Do not run `scripts/deploy.sh` or any Firebase deploy.

## Key Decisions

- Super-only everywhere (AFQ-01). Plain admins are redirected to the promoted
  route (AFQ-02). Super is sufficient and the editor pairs super with admin
  (AFQ-05).
- One shared `ConfirmDialogService` with cancel focused and a destructive
  variant (AFQ-03). Overlapping calls resolve false instead of sharing an
  answer.
- Responsive `.admin-table` (cards below 600px), pagination only where a list
  can grow (AFQ-04).
- Seed adds `staff@e2e.local` (admin, not super) for role-boundary tests.
- Playwright login now waits for the URL, the cached user, and the navbar to
  settle; this fixed WebKit navigation races.
- Five decisions remain `UNCERTAIN` with defaults applied: AFQ-06, AFQ-08,
  AFQ-09, AFQ-10, AFQ-11 in
  `design_specs/admin_facelift_questions.md`. They are the final human batch.

## Next Actions

1. Answer the five `UNCERTAIN` entries in
   `design_specs/admin_facelift_questions.md`. Each has a default already
   applied; only AFQ-08 (server rules) and AFQ-09 (audit trail) change behavior
   or schema.
2. If AFQ-08 is approved, change `database.rules.json` for `features`,
   `promotedRoute`, and recovery nodes to `roles/super`, then add an emulator
   rules test and rerun the gate.
3. If AFQ-11 is approved, add `CI=true npm test -- --watch=false` to
   `scripts/e2e/gate.sh` before the emulator block and rerun the gate.
4. Ship only on explicit request via the `ship-changes` skill.

## Open Risks

- Server rules still allow plain admins to write feature flags, the promoted
  route, and recovery nodes; the super-only model is UI-enforced only.
- Role grants and revokes have a confirmation but no audit record.
- Album delete is a non-atomic chunked cascade; failures are surfaced and
  retryable, but a mid-cascade failure can strand photos.
- The album/photos ZIP is capped at 500 files; the notice says so.
- Visual-review screenshots live in `/tmp/af-shots6/`, not the repo.

## Repo Notes

- This repo has `design_specs/` but no `docs/discovery/`; it could opt in to
  Progressive Discovery by creating `docs/discovery/DISCOVERY.md`. Do not
  create it without a human decision.

## Resume Prompt

Continue the admin facelift from
`/Users/e/mnt/bnk/cs/lecoursville/design_specs/2026-10-20_admin_facelift_handoff.md`.
Work on branch `feat/admin-facelift`, do not push, merge, or deploy. First run
`CI=true npm test -- --watch=false` and the full gate command from the handoff,
report any divergence, then present the five `UNCERTAIN` entries from
`design_specs/admin_facelift_questions.md` and apply the answers.
