# Admin Facelift Baseline (2026-10-20)

Phase 0 record for `feat/admin-facelift`, cut from `master` at `aca0acb6`.
Everything below was observed on that commit, before any change.

## Scope

The admin shell plus every admin route: shell, nine surfaces, guards, routing,
seed data, unit specs, e2e specs. `functions/` and `database.rules.json` are out
of bounds; needs there go to the question ledger.

## Access Model As Found

- `AuthAdminGuardService` (`src/app/services/auth-admin-guard.service.ts:20`)
  waits for the RTDB-backed user, 5s timeout, then admits `roles.admin === true`
  and otherwise navigates to sign-in.
- `users` is the only super-only page in intent, but it has no guard
  (`src/app/app-routing.module.ts:127`). The page hides its controls for
  non-supers and leaves an unbounded `mat-spinner` on screen.
- `photo-albums` is flag-gated by `PhotoAlbumsFeatureGuard` with
  `fallbackUrl: '/admin'`.
- No `SuperAdminGuard` exists. `Roles` is `{user, admin?, super?}` from the RTDB
  user record (`src/app/models/user.ts:1`); auth custom claims are not used.
- Seed: `admin@e2e.local` is `{user, admin, super}` in RTDB
  (`scripts/e2e/seed.mjs:298`). No non-super admin account is seeded.
- Decision applied: every admin surface requires `super`. Non-super admins are
  redirected to the promoted route, the same target as the root route.

## Route Table As Found

| Route | Component | Required role | Flag | Fallback | Data source |
|---|---|---|---|---|---|
| `/admin` | `AdminComponent` | admin | none | sign-in | RTDB user, flags, version |
| `/admin/media` | `AdminMediaComponent` | admin | none | n/a | `JsonService`, upload children |
| `/admin/photo-albums` | `AdminPhotoAlbumsComponent` | admin | `enablePhotoAlbums` | `/admin` | `PhotoAlbumsService`, `PhotosService` |
| `/admin/users` | `AdminUsersComponent` | super (unguarded) | none | n/a | `AuthService`, `AdminService` |
| `/admin/features` | `AdminFeaturesComponent` | admin | none | n/a | `FeatureFlagsService` |
| `/admin/people` | `AdminPeopleImportComponent` | admin | none | n/a | `PeopleService`, `ClanService` |
| `/admin/families` | `AdminFamiliesComponent` | admin | none | n/a | `FamilyService` |
| `/admin/calendars` | `AdminCalendarsComponent` | admin | none | n/a | `RtdbService` |
| `/admin/uploads` | `AdminUserUploadsComponent` | admin | `enablePhotoAlbums` (folder mode only) | n/a | `UserUploadService`, `FeatureFlagsService` |
| `/admin/recovery` | `AdminRecoveryComponent` | admin | none | n/a | `RtdbService`, `CloudFunctionsService` |
| `/admin` index | redirect | n/a | n/a | `users` | n/a |

Dead navigation found: `RoutingService.NavigateToAdminCalendar`
(`src/app/services/routing.service.ts:118`) targets `/admin/calendar`, but the
route is `/admin/calendars`. No caller was found, so it is latent but wrong.

## State Coverage As Found

| Page | Loading | Empty | Error | Notes |
|---|---|---|---|---|
| Users | spinner, unbounded for non-super | none | none | super check inside the page |
| Features | none | none | none | 9 toggles |
| Families | none | inline `.empty-state` | inline `.form-error` | plain table preview |
| People import | none | n/a | error/warning/result cards | 484-line component |
| Calendars | none | inline `.empty-state` | inline `.form-error` | |
| Media | none | n/a | upload error list | nested tab uploaders |
| Photo albums | progress bar | shared `no-results-message` | none | confirms photo and album deletes |
| Uploads | folder spinner | inline `.empty-state` | inline error | approve/reject have no confirm |
| Recovery | none | none | none | remove recipient has no confirm |

Destructive sites: 5 confirmed, 6 unconfirmed. Two plain tables (families,
people preview); no `mat-table` anywhere.

## Component And Spec Inventory

14 admin component directories. Unit specs exist for 7: admin, admin-features,
admin-media, admin-media-upload-audio-album, admin-media-upload-video,
admin-routing, admin-users. Missing: admin-families, admin-calendars,
admin-people-import, admin-user-uploads, admin-recovery, admin-photo-albums,
admin-photo-album-upload-dialog.

`AdminRoutingComponent` is declared in `src/app/app.module.ts:55` but has no
template reference; only its own spec and one SCSS selector mention it.

## E2E As Found

- `e2e/specs/admin.spec.ts`: 8 tests (users, features twice, families,
  calendars, uploads, people import, regular-user denial).
- `e2e/specs/loading.spec.ts:8`: covers 10 non-admin routes; admin routes are
  outside the contract (`design_specs/loading-contract.md:12`).
- `e2e/specs/security.spec.ts`: guard bypass, non-admin recovery denial, rules
  checks, callable checks.
- No screenshot or visual regression tooling in the repo.

## Baseline Gate

Command: `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home npm run e2e:gate`

Result: 101 tests per browser project, 303 executions, all passed. Chromium,
webkit, and firefox each reported `101 passed` with 0 failed, 0 flaky, 0
skipped, retries 0.

Unit baseline: `CI=true npm test -- --watch=false` reported 66 files and 224
tests passed.

## Baseline Screenshots

Rendered at 1440x900 and 390x844 for all nine admin routes plus the `/admin`
index, for the super admin. Stored outside the repo at `/tmp/af-shots/`, per the
no-screenshots-in-repo rule. Desktop and mobile sets both captured after the
baseline build.
