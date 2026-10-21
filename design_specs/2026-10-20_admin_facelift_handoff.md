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

- Unit: `CI=true npm test -- --watch=false` -> 78 files, 367 tests passed.
- Gate: `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home npm run e2e:gate`
  -> unit 367 passed, then chromium 134, webkit 134, firefox 134 passed. 402
  browser executions, 0 failed, 0 skipped, retries 0. The gate now runs the
  unit suite before the functions build.
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
- All eleven AFQ entries are resolved `CERTAIN`. The follow-up round converted
  feature flags to Material switches, tightened RTDB rules to super on
  `features`, `promotedRoute`, and the recovery reads, added a super-only
  `roleAudit` trail written on role changes, kept the retryable album cascade,
  and added the unit suite to the gate.

## Next Actions

1. Optional: enforce append-only `roleAudit` in rules (`!data.exists()` on
   write) and surface the trail in the admin UI. The record is written today;
   only the UI is missing.
2. Optional: move the album cascade to a functions callable if album volume
   grows.
3. Ship only on explicit request via the `ship-changes` skill.

## Open Risks

- Server rules now require super for the flags, promoted route, recovery reads,
  and `roleAudit`; other admin writes still key on `roles/admin`.
- Role grants and revokes write `roleAudit`, but there is no admin UI for it
  yet and the node is overwriteable by a super at the rules level.
- Album delete remains a non-atomic chunked cascade; failures are surfaced and
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
the full gate command from the handoff and report any divergence; the remaining
work is the optional append-only role-audit rules and an audit view, and the
optional album-cascade callable.
