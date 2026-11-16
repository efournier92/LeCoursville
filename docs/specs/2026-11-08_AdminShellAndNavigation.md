# Admin Shell And Navigation

Spec for UI-007, UI-015, UI-016, UI-027, UI-028, UI-029, and UI-030. Workstream WS2. Depends on WS1.

## Goal

Make the admin shell read as one ordered system, give Features two promoted routes (approved and pending), count every outstanding recovery request, and show a version that tracks the deployed build.

## Non-Goals

- No new admin permissions or guards.
- No redesign of admin page interiors beyond the named tabs and labels.
- No rewrite of the Photo Albums component. It is embedded, not rebuilt.

## Current State

- `ADMIN_NAV_GROUPS` is `['People', 'Content', 'System']` (`src/app/admin/admin-nav.ts:36`). The sidebar renders groups in that order (`admin.component.ts:140-148`).
- Content order is Family Explorer, Expressions, Media, Photo Albums, Songs, Uploads (`admin-nav.ts:43-48`). Photo Albums is a separate nav item and route.
- System order is Users, Features, Recovery, Analytics (`admin-nav.ts:49-52`).
- Media already has a video and audio section switcher rendered as segmented buttons (`admin-media.component.html:8-34`, `admin-media.component.ts:19`).
- `admin.component.html:40-42` renders `v{{ version }}` in `.sidebar-footer` with no alignment (`admin.component.scss:158-166`). `VersionService` imports `package.json` at build time (`version.service.ts:16-19`). `package.json:3` is `24.3.17`. `deploy.sh` only tags with `date +%y.%m.%d` and never writes `package.json`.
- `userRoles()` returns `Content Admin, Super, Member` (`admin-users.component.ts:141-148`). The editor renders User, Content Admin, Super (`user-edit.component.html:99-119`). `user-view` renders `User` (`user-view.component.html:6-17`).
- One promoted route exists as `{route, updatedAt}` (`feature-flags.service.ts:81-93`). `routing.service.ts:24-68` rejects `/admin` and `/`. The root bounce uses it for any signed-in user (`app.component.ts:120-122`). `promotedRoutePending` does not exist.
- `AdminBadgeService.openRecoveryRequests()` counts `status === 'open'` only (`admin-badge.service.ts:20-22`). Server states are `open`, `pending`, `resolved`, `closed` (`functions/src/submit-recovery-request.ts:205`, `functions/src/admin-generate-reset-link.ts:117`, `admin-recovery.component.ts:336-345`).

## Behavior And Acceptance Criteria

### UI-007 Group Order

- `ADMIN_NAV_GROUPS` and the `AdminNavGroup` union read `System`, `People`, `Content`.
- A super admin sees System first. A regular admin sees People first because System renders empty and is skipped.

### UI-015 Content Order And Media Tabs

- Content order is Uploads, Media, Expressions, Songs, Family Explorer.
- Photo Albums stops rendering as a sidebar item and becomes a third section inside Media, embedding `AdminPhotoAlbumsComponent`.
- The Photo Albums tab hides when `enablePhotoAlbums` is off. The Media page stays.
- `/admin/photo-albums` still resolves and opens Media with the Photo Albums tab selected.
- The active section is deep-linkable by query param or child route.

### UI-016 System Order

- System order is Features, Analytics, Users, Recovery.

### UI-027 Version

- `.sidebar-footer` right-aligns the version with `display: flex` and `justify-content: flex-end`.
- `deploy.sh` computes a date version with no leading zeros, for example `26.11.8`, and runs `npm version <v> --no-git-tag-version` before `ng build` for dev and prod. `VersionService` keeps reading `package.json`, so no code change is needed there.
- The release process commits the `package.json` and `package-lock.json` bump so the tree is clean and the displayed number matches the git tag. A second deploy on the same day is idempotent.
- This is deploy-affecting and needs explicit human sign-off. Never bypass the gate to run a version bump.
- The displayed string is the deploy tag token and stays semver-shaped for `admin.spec.ts:217-223`.

### UI-028 Role Order And Naming

- Badge order is Member, Content Admin, Super.
- Editor order is Member, Content Admin, Super. The bound key stays `roles.user`.
- `user-view` renders `Member`.
- Privilege rules stay intact after the UI-026 switch conversion.

### UI-029 Approved And Pending Promoted Routes

- Add sibling `promotedRoutePending` with `{route, updatedAt}` shape. Keep `promotedRoute` unchanged.
- `FeatureFlagsService` gets `getPendingPromotedRoute` and `setPendingPromotedRoute`. The audit field union gains `promotedRoutePending`.
- `RoutingService.getPromotedRoute(approved: boolean)` returns the matching route. The root bounce passes `isApproved()`. The sign-in redirect passes `isApprovedUser(user)`.
- Pending route validation rejects approved-only routes: `/people`, `/contacts`, `/calendar`, `/admin`. Fall back to the environment default with a visible warning.
- Add `promotedRoutePending` to `environment.ts`, `environment.prod.ts`, and `environment.e2e.ts`. Default `/photos`.
- Admin Features shows two selects, approved first and pending directly below, with a caption that pending users cannot view PII.

### UI-030 Recovery Badge

- Rename the method to `outstandingRecoveryRequests()` and count `open` plus `pending` with two indexed queries combined client-side.
- Accessible label reads outstanding. Zero hides the badge. Error keeps the `!` state.
- A `resolved` or `closed` request contributes zero.

## Data Model And Rollout

- New RTDB sibling `promotedRoutePending`. No migration.
- `deploy.sh` bumps `package.json` before build, and the release commits the bump. No build-stamp file.
- Recovery counting is client-side over existing indexed fields. No rules change.
- Roll back by reverting the branch. The extra RTDB node is inert if the code is reverted.

## Light, Dark, And Print

- The version label keeps its muted token. Badge tones follow WS1.
- The Media tab switcher reads in both modes. Print is not affected.

## Accessibility

- Sidebar groups keep landmark and list semantics.
- The two promoted-route selects have visible labels and a describedby caption.
- The badge keeps its count and accessible label.

## E2E Coverage Matrix

| Change | Spec file | Assertion |
|---|---|---|
| Group order | `e2e/specs/admin.spec.ts` | Rendered order System, People, Content for super admin |
| Content order and media tabs | `e2e/specs/admin-content.spec.ts` | Sidebar order, Photo Albums tab loads the album manager, legacy route opens the tab |
| System order | `e2e/specs/nav.spec.ts` | Features, Analytics, Users, Recovery |
| Version right-aligned and bumped | `e2e/specs/admin.spec.ts` | Footer right edge and version matches the bumped package.json |
| Role order and naming | `e2e/specs/admin-roles.spec.ts` | Badge order Member, Content Admin, Super and editor order |
| Pending promoted route | `e2e/specs/feature-flags.spec.ts` | Pending user redirects to the pending route, approved user to the approved route |
| Recovery badge | `e2e/specs/admin.spec.ts` | Badge shows for open and pending, hides for resolved |

## Seed And Test Updates

- Extend `scripts/e2e/seed.mjs` with one recovery request per status and a pending user.
- Update `admin-users.component.spec.ts:146,173-181,408`, `admin-roles.spec.ts:141,155`, and `user-view.component.spec.ts:85-110` for the new order and Member label.

## Resolved Decisions And Open Questions

- Resolved: pending node is a sibling, not a nested object with a migration.
- Resolved: allowed pending routes are `/photos`, `/media/video`, `/media/audio`, `/expressions`, `/account`, `/upload`.
- Resolved: the version comes from a `package.json` bump in `deploy.sh`, not a build-stamp file.
- Open: confirm whether pending users get a dedicated waiting page. Default is no.
