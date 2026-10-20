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

## Phase 2: Admin Shell

- Skip link (first tab stop, real focus move without a router navigation),
  grouped sidebar with `aria-current`, `aria-busy` skeleton until flags load.
- Mobile drawer: hidden from tab order when closed, focus moves to the first
  link on open, Tab wraps inside the drawer, Escape closes and returns focus to
  the toolbar toggle.
- Shell height is `calc(100vh - 64px)` so only the content region scrolls.
- 600px and 991.98px breakpoints verified; 44px rows at 390px.
- Unit: 67 files, 234 tests green. Chromium admin spec: 15 tests green.

## Phase 3: Page-By-Page Pass

- Shared primitives: `ConfirmDialogService` (cancel focused, destructive
  variant), `paginate()` helper, and `admin-data.scss` (responsive table that
  becomes `data-label` cards below 600px, pagination bar, skeleton rows).
- Users, Families, People import, Calendars, Media, Photo Albums, Uploads,
  Recovery, Features: toolbar, responsive tables/grids, pagination where lists
  grow, explicit loading/empty/error states, and shared confirmation on every
  destructive action.
- Missing unit specs added: families, calendars, people import, uploads,
  recovery, photo albums, album upload dialog.
- New e2e files: `admin-people.spec.ts`, `admin-content.spec.ts`,
  `admin-system.spec.ts`.
- `account-recovery.spec.ts` updated for the new remove-recipient confirmation.
- Unit: 76 files, 304 tests green. Chromium full suite: 122 tests green.

## Phase 4: Visual Critique Loop

- Three critique rounds plus a targeted fix-verification pass over full-page
  renders at 1440x900 and 390x844.
- Final verdict: CONVERGED, no high-severity findings; four leftover mediums
  fixed and re-verified.
- Ledger: `design_specs/2026-10-20_admin_facelift_critique.md`.
- Final render set: `/tmp/af-shots6/` (not committed).
