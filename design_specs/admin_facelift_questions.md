# Admin Facelift Questions

Decision ledger for `feat/admin-facelift`. One entry per contested call. User
answers are recorded as `CERTAIN` with verdict `user decision`. Redteam-derived
entries record the lenses run, the convergence, and the applied default.

Status values: `CERTAIN` (converged or user-decided), `UNCERTAIN` (default
applied, needs a human answer). The batch of `UNCERTAIN` entries is presented at
the end of the run.

## AFQ-01: Which admin surfaces require super

- Options: Users only; Users + Features; Users + Recovery; Users + Features +
  Recovery; every admin surface.
- Decision: every admin surface requires `roles.super === true`.
- Verdict: `CERTAIN`, user decision.
- Applied: parent route guard chain `AuthAdminGuardService` then
  `SuperAdminGuard`; plain admins are redirected to the promoted route.
- Files: `src/app/app-routing.module.ts`, `src/app/services/super-admin.guard.ts`,
  `src/app/admin/admin-nav.ts`, `src/app/app.component.ts`.
- Revisit cost: low. Changing the required role per route means adding a role
  field to `ADMIN_NAV`, splitting the parent guard, and updating two e2e tests.

## AFQ-02: Where a non-super admin lands

- Options: Media; Calendars; Families; Uploads.
- Decision: the promoted route, the same target root sends a signed-in member
  to.
- Verdict: `CERTAIN`, user decision.
- Applied: `SuperAdminGuard` returns a `UrlTree` from
  `RoutingService.getPromotedRoute()`; timeout falls back to `/`.
- Files: `src/app/services/super-admin.guard.ts`,
  `src/app/services/routing.service.ts`.
- Revisit cost: low, one guard constant.

## AFQ-03: Destructive confirmation

- Options: shared dialog; inline two-step; undo snackbar; keep per-page.
- Decision: one shared confirm dialog, cancel focused, destructive styling.
- Verdict: `CERTAIN`, user decision.
- Applied: see AFQ-05 for the component shape and adoption order.
- Files: the shared dialog plus every admin component with a destructive action.
- Revisit cost: medium if the pattern changes after adoption; per-page call
  sites would need edits.

## AFQ-04: List density and pagination

- Options: responsive table + cards; compact cards everywhere; dense table;
  polish current shapes.
- Decision: responsive table at 600px and up, card rows below 600px, higher
  information density, pagination where a list can grow without bound.
- Verdict: `CERTAIN`, user decision.
- Applied: shared admin data-surface pattern; per-page adoption in Phase 3.
- Files: new shared table/list styles, admin list components.
- Revisit cost: medium; the pattern is centralized so a change is one component
  plus per-page markup.
