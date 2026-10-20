# Admin Facelift Run Log

Phase checkpoints for `feat/admin-facelift`. Newest phase at the bottom.

## Phase 0: Branch And Baseline (commit d514aeae)

- Branch cut from `master` at `aca0acb6`.
- Baseline note: `design_specs/2026-10-20_admin_facelift_baseline.md`.
- Gate: 101 tests per browser, 303 executions, all green, retries 0.
- Unit: 66 files, 224 tests green.
- Screenshots: 20 renders at 1440x900 and 390x844 in `/tmp/af-shots/`.

## Phase 1: Access And Routing Truth

- All admin routes are super-only. Parent chain is `AuthAdminGuardService` then
  `SuperAdminGuard`; plain admins redirect to the promoted route.
- `src/app/admin/admin-nav.ts` is the single route/sidebar table, grouped into
  People, Content, System. The sidebar renders from it and filters by flag.
- Dead `/admin/calendar` navigation fixed to `/admin/calendars`.
- Unused `AdminRoutingComponent` removed.
- Seed adds `staff@e2e.local` (admin, not super). E2E proves the grouped nav,
  the index redirect, the staff redirect, and a full direct-URL sweep.
- Unit: 67 files, 231 tests green. Chromium: 106 tests green.
