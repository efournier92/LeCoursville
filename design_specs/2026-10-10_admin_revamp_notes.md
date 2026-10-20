# Admin Revamp Notes (2026-10-10)

Running notes for a future Admin-Revamp spec. This is a scratchpad, not a spec. Capture findings as they surface, then promote them into an Agent Design Spec on a dedicated `feat/admin-revamp` branch.

## How To Use

- One entry per finding, newest at the bottom of its section.
- Each entry: what, where, why it matters, evidence, suggested fix shape.
- Do not fix here. This branch is for account recovery and the Firebase config runbook.

---

## Access And Visibility

### AV-1: Non-super admins see a broken Users link

- What: The admin sidebar renders the `/admin/users` link for every admin, but the page is super-only. A non-super admin clicks it and gets a dead page.
- Where: `src/app/components/admin/admin.component.html` lines 9-10 (unconditional `routerLink="/admin/users"`).
- Why it matters: A visible control that cannot work reads as a broken app, not a permission boundary.
- Evidence: Dev DB `users` node, `efournier92@gmail.com` is `{ admin: true, super: false }`; super account is `admin@test.com`. Confirmed live 2026-10-10 during the rules runbook.
- Suggested fix: Hide the sidebar item entirely unless `user.roles.super` is true.

### AV-2: Super-only page spins forever instead of blocking

- What: `/admin/users` shows an infinite `<mat-spinner>` for a non-super admin. No error, no empty state, never resolves.
- Where: `src/app/components/admin-users/admin-users.component.html` lines 80-83; `shouldDisplayUserCards()` in `admin-users.component.ts` line 59.
- Why it matters: Violates the branch's own loading contract (`design_specs/2026-10-02_loading_contract_handoff.md`): a hung state is the exact anti-pattern the contract exists to kill.
- Evidence: Reproduced live 2026-10-10, signed in as `efournier92@gmail.com`.
- Suggested fix: Route guard plus an explicit not-authorized or empty state. Never an unbounded spinner.

### AV-3: Super-only routes have no guard

- What: `/admin/users` has no super guard, so direct URL entry bypasses the (missing) gate and lands in the spinner.
- Where: `src/app/app-routing.module.ts` line 126-129 (`users` child route, no `canActivate`).
- Why it matters: The parent `AuthAdminGuardService` only checks `admin`. Peer surfaces already do better: `/admin/photo-albums` uses `PhotoAlbumsFeatureGuard` with `data: { fallbackUrl: '/admin' }`.
- Suggested fix: Add a `SuperAdminGuard` mirroring `AuthAdminGuardService`, wired on every super-only route.

### AV-4: Redirect interlock if a super guard is added

- What: The last admin child route redirects `''` to `users`, so bare `/admin` goes to `/admin/users`. A super guard that falls back to `/admin` would create a redirect loop for non-super admins.
- Where: `src/app/app-routing.module.ts` lines 154-158.
- Why it matters: Naively adding `fallbackUrl: '/admin'` breaks the router for non-super admins.
- Suggested fix: Make the index redirect role-aware, or point the fallback at a page all admins can see (for example `/admin/calendars`).

### AV-5: Super-gate the whole admin surface, not just Users

- What: After AV-1 to AV-4, audit every admin route and sidebar item for its true required role (`admin` vs `super` vs feature flag) and render only what the viewer can use.
- Where: `src/app/app-routing.module.ts` admin children; `src/app/components/admin/admin.component.html` sidebar; per-component role checks such as `admin-users.component.ts`.
- Why it matters: One dead link implies the sidebar was never audited against the privilege model. Treat the whole surface as suspect.
- Suggested fix: One table: route, required role, flag, fallback. Derive both the guards and the sidebar from it.

---

## Process Notes

- Any Admin-Revamp change touches user-visible behavior, so it ships with Playwright coverage: `e2e/specs/admin.spec.ts` for nav and route behavior, `e2e/specs/security.spec.ts` for guard bypass attempts. `npm run e2e:gate` must stay green.
- Seed data: the emulator admin (`admin@e2e.local`) carries `super: true` in its DB record but only `{ user: true, admin: true }` in Firebase Auth custom claims (`scripts/e2e/seed.mjs`). Confirm which source the app trusts before writing guard tests.
