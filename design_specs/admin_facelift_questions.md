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

## AFQ-05: Super implies admin

- Question: can a user hold `super` without `admin`?
- Options: super implies admin everywhere; keep the flags independent.
- Decision: super is sufficient for every admin surface and the editor pairs
  the two flags.
- Verdict: `CERTAIN`, derived from AFQ-01.
- Applied: the admin guard, media gates, and user editor all treat super as
  sufficient; new saves always set admin when super is set.
- Files: `services/auth-admin-guard.service.ts`, `user-edit/`.
- Revisit cost: low; server rules still key on `admin`, so legacy super-only
  rows cannot write until the flags are repaired.

## AFQ-06: Feature toggles use checkboxes

- Question: should the nine feature flags become Material switches?
- Options: keep checkboxes with corrected copy; convert to switches.
- Decision: convert to Material switches (user answer, 2026-10-20).
- Verdict: `CERTAIN`, user decision.
- Applied: nine `mat-slide-toggle` controls with the same testids; specs use
  `aria-checked` instead of checkbox state.
- Files: `admin-features/`.
- Revisit cost: low; one template change plus testid updates.

## AFQ-07: No visual-regression tooling

- Question: add screenshot diffing to the repo?
- Options: add Playwright screenshot baselines; keep renders in scratch only.
- Verdict: `CERTAIN` (declined). The repo has no visual test system and the
  brief keeps screenshots out of it.
- Applied: renders live in `/tmp/af-shots6/`; the critique ledger records the
  review.
- Revisit cost: medium; a new baseline store and CI step.

## AFQ-08: Server rules still grant plain admins write access

- Question: should `database.rules.json` gate `features`, `promotedRoute`, and
  recovery nodes on `roles/super`?
- Options: tighten the rules; accept client-side gating.
- Decision: tighten the rules (user answer, 2026-10-20).
- Verdict: `CERTAIN`, user decision.
- Applied: `features`, `promotedRoute`, recovery reads, and `roleAudit` require
  `roles/super`; security spec proves staff denial by REST.
- Files: `database.rules.json`.
- Revisit cost: medium; a rules change plus an emulator rules test.

## AFQ-09: No role-change audit trail

- Question: should privilege grants and revokes write an audit record?
- Options: add a `recoveryAudit`-style trail; defer.
- Decision: add the audit trail (user answer, 2026-10-20).
- Verdict: `CERTAIN`, user decision.
- Applied: role changes write `roleAudit/{pushId}` with actor, target, before,
  and after roles; super-only read/write in rules.
- Files: `user-edit/`, `database.rules.json`, `functions/`.
- Revisit cost: medium.

## AFQ-10: Album delete cascade is not atomic

- Question: should the album/photo cascade be a server transaction?
- Options: accept a retryable partial failure; move to a functions callable.
- Decision: keep the retryable cascade (user answer, 2026-10-20).
- Verdict: `CERTAIN`, user decision.
- Applied: visible error and retry; atomicity deferred.
- Files: `services/photo-albums.service.ts`, `functions/`.
- Revisit cost: high; a callable plus rules and tests.

## AFQ-11: The gate does not run unit tests

- Question: should `scripts/e2e/gate.sh` run `CI=true npm test` before the
  emulator matrix?
- Options: add it; keep unit tests as a manual step.
- Decision: add the unit step (user answer, 2026-10-20).
- Verdict: `CERTAIN`, user decision.
- Applied: `scripts/e2e/gate.sh` runs `CI=true npm test -- --watch=false`
  before the functions build.
- Files: `scripts/e2e/gate.sh`.
- Revisit cost: low; one line.
