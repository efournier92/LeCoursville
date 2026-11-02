# Admin Tier Split

Branch context: target branch `2026-11-01_AdminTierSplit`, off the current trunk. One PR. No data migration, no seed shape change, no Storage rules change, no new harness. The database rules and the Cloud Functions deploy with the normal release flow.

## Context And Motivation

LeCoursville has two privilege flags, `roles/admin` and `roles/super`. Today the two are not layered. Super is the key for `/admin`, the admin sidebar, the features and promoted-route nodes (`src/app/app.component.ts:134-142,158`, `src/app/services/super-admin.guard.ts:23-27`, `database.rules.json:170,174`). Most content nodes gate writes on `roles/admin` (`database.rules.json:12,16,20,140,145,149,178,182,186,190,194`). The `/admin` parent currently requires both guards (`src/app/app-routing.module.ts:94-98`), so a record with a real content flag cannot reach the content editor pages.

This spec keeps `roles/admin` as a real content editor tier. It splits the admin surface into content and system. A content admin reaches the content pages and keeps every existing inline content control and every existing content write rule. A super reaches everything, including the six system pages and the system callables. Only three database rule nodes move to super. The `messages` rules stay untouched because content admins still moderate chat.

## Glossary

The project glossary lives at `docs/GLOSSARY.md` and holds no role terms today. Definitions this spec depends on are inlined here so the spec stands alone.

**Approved member**: a signed-in user whose record has `roles/user` true (`src/app/models/user.ts:15-19`). Membership is what makes the app readable. It is not privilege.

**Content administrator**: a signed-in user whose record has `roles/admin` true. A content administrator gets the five content admin pages, the inline content edit controls, chat moderation, and every content write node. The user-facing label is `Content Admin`. The stored key stays `admin`.

**Super administrator**: a signed-in user whose record has `roles/super` true. A super also carries `roles/admin` because the grant path normalizes super to imply admin (`functions/src/change-user-role.ts:17-24`). Super gets every content capability plus the six system pages, the system data nodes, and the system callables. The user-facing label stays `Super` or `Super Admin` where that copy already exists.

**Viewer**: the signed-in user looking at a screen. Badge visibility is decided by the viewer and by the permission behind each badge.

**Legacy admin**: a user record with `roles/admin` true and `roles/super` false. This spec does not demote or migrate it. It is a content administrator.

## Current State

Anchored facts the design builds on. Line numbers were re-read on 2026-11-01.

- `database.rules.json` is 243 lines. Twelve content nodes grant write on `roles/admin` alone: `calendarEvents` (`:12`), `calendars` (`:16`), `contacts` (`:20`), `photos` (`:140`), `videos` (`:145`), `media` (`:149`), `clans` (`:178`), `families` (`:182`), `people` (`:186`), `addresses` (`:190`), `photoAlbums` (`:194`), `userUploads` (`:198`).
- Three read nodes still gate on `roles/admin`: the `familyExplorer` root at `:4`, `userUploads` at `:197`, and `rateLimits` at `:235`. The nested `familyExplorer/$familyId` published read at `:7` is a separate member-and-public path and is untouched.
- `messages` mixes the flag into 28 clauses across the top-level write at `:25`, the `$id` validate at `:26`, the `authorId` write at `:29`, the per-field writes at `:35` through `:124`, and the `$replyId` writes at `:75` through `:124`. Two authorName overrides have no disjunct and are admin-only: `messages/$id/authorName` at `:32` and `messages/$id/replies/$replyId/authorName` at `:81`. All of these stay unchanged.
- The `users/$uid` write at `:165` contains three `roles/admin` occurrences: the self-create guard and the two halves of the immutability pin. They stay unchanged.
- Already super-only in rules: `features` (`:170`), `promotedRoute` (`:174`), `users` root and child read (`:162`, `:164`), `recoveryRequests` (`:206`), `adminAlerts` (`:211`), `recoveryAudit` (`:215`), `config/adminAlertRecipients` (`:220`), `roleAudit` (`:225`), and `featureFlagAudit` (`:229`, `:231`).
- `functions/src/helpers.ts:101-104` exports `isAdmin(uid)` and reads `users/{uid}/roles/admin`. Because the grant path writes `admin: true` for every super, this predicate already returns true for supers. It is the content-admin predicate, not the system predicate.
- `functions/src/close-recovery-request.ts:7,26-27` and `functions/src/update-alert-recipients.ts:4,16-17` use `isAdmin` and the error copy `Admin access required.`. `functions/src/admin-generate-reset-link.ts:41-44` already reads `roles/super` inline and already uses `Super admin access required.`.
- `functions/src/admin-alert-created.ts:53-61` filters fallback alert recipients on `record?.roles?.admin === true` at `:59`. The typed record at `:55` only declares `roles.admin`.
- `functions/src/change-user-role.ts` is unchanged. `toRoles` at `:17-24` computes `admin: roles.admin === true || superRole`, `parseRoles` at `:28-45` validates the three boolean keys, the actor check reads `roles/super` at `:61-66`, and the multi-path write at `:104` stores `users/{uid}/roles` plus a `roleAudit` entry.
- `src/app/services/auth-admin-guard.service.ts:33` allows `roles.admin` or `roles.super`. `src/app/services/super-admin.guard.ts:23-27` allows `roles.super` only. `src/app/app-routing.module.ts:94-98` gates `/admin` with `[AuthAdminGuardService, SuperAdminGuard]`, so a content admin is blocked at the parent today.
- `src/app/components/admin/admin.module.ts:25-85` declares the child routes. Content children are `media` at `:30-35`, `photoAlbums` at `:36-41`, `people` at `:50-53`, `families` at `:54-57`, and `calendars` at `:58-61`. System children are `users` at `:42-45`, `features` at `:46-49`, `familyExplorer` at `:62-65`, `uploads` at `:66-69`, `recovery` at `:70-73`, and `analytics` at `:74-77`. The empty child route at `:78-82` redirects to `users`.
- `src/app/admin/admin-nav.ts:33-45` lists the eleven sidebar items with no viewer flag. `visibleAdminNav` at `:47-51` filters only on feature flags. `src/app/components/admin/admin.component.ts:44-47` builds the groups from flags alone, `:116-121` maps them into groups, and `:123-127` subscribes to the user without rebuilding the nav.
- `src/app/components/user-view/user-view.component.ts:27-33` gates chips on `isAdminUser()` reading `userOnCard.roles.admin`. The template at `src/app/components/user-view/user-view.component.html:6-18` renders `User`, `Admin`, and `Super`. The account card is rendered for the signed-in user at `src/app/components/auth/auth.component.html:73`.
- `src/app/components/admin-users/admin-users.component.ts:141-148` emits `Admin` and `Super` labels, and `:164-169` emits the same two labels for role history. The route is super-only, so the viewer is always a super there. The template renders the badge class from `role.toLowerCase()` at `src/app/components/admin-users/admin-users.component.html:116`.
- `src/app/components/user-edit/user-edit.component.ts:66-78` forces `admin = true` when super is set. `:203-209` builds the `Give X admin access?` and `Remove admin access from X?` confirmation strings. The checkbox label is `src/app/components/user-edit/user-edit.component.html:104-111`.
- Inline content controls already check `roles.admin` and need no predicate change: `src/app/components/chat-view/chat-view.component.html:72`, `src/app/components/expressions/expressions.component.html:42`, `src/app/components/expression-view/expression-view.component.html:28`, `src/app/components/contacts/contact-view/contact-view.component.html:72`, `src/app/components/contacts/contact-edit/contact-edit.component.html:232`, and `src/app/components/photos-legacy/photos-legacy.component.html:60,152,162`.
- `contact-view` and `contact-edit` are declared in `src/app/app.module.ts:60-61` but no template renders them. `photos-legacy` renders only when `features/enablePhotoAlbums` is off (`src/app/components/photo-shell/photo-shell.component.ts:13-21`), and the seed turns it on (`scripts/e2e/seed.mjs:441`).
- `src/app/services/auth.service.ts:279-282` exposes `isUserAdmin()` returning `roles.admin`. It has no non-test caller. `src/app/services/auth.service.spec.ts:44-50` asserts that content-admin semantics.
- Seeds: `scripts/e2e/seed.mjs:31` gives `admin@e2e.local` `{ user: true, admin: true }`, `:34` gives `staff@e2e.local` `{ user: true, admin: true }`, and the tree records at `:435` and `:438` promote admin to super and keep staff at `{ user: true, admin: true, super: false }`. `e2e/helpers/rules.ts:11-15` mirrors the three role records. `e2e/helpers/auth.ts:3-9` defines the logins.
- E2E specs that assert the current tier: `e2e/specs/security.spec.ts:171-190` (staff blocked from every admin route), `e2e/specs/admin.spec.ts:40-46,48-55,57-65,67-73,93-96` (logo destinations and user-edit copy), `e2e/specs/admin-system.spec.ts:71,137,140,159,162,407` (badge and copy), and `e2e/specs/rules.spec.ts:124-160,162-174`.
- E2E policy: `retries` is 0 (`playwright.config.ts:10`), every spec imports `test` from `e2e/helpers/fixture.ts:9,20`, and seed mutations are restored in `finally` (`docs/testing/TEST_POLICY.md:51-61`).

## Goals

1. Keep `roles/admin` as a real content editor tier across routes, nav, rules, and callables.
2. Let a content admin reach the five content admin pages and the admin shell.
3. Redirect a content admin away from the six system admin pages and the eleven system-only data nodes.
4. Keep every content write rule, every `messages` clause, every authorName override, and every inline content control on `roles.admin`.
5. Require super for the recovery, alert-recipient, and reset-link callables.
6. Rename the user-facing `Admin` label to `Content Admin` without changing the stored key.
7. Show each badge only to a viewer who holds the permission behind it.
8. Prove the split with one new browser spec, split rules probes, and updated unit and functions specs.

## User Stories

1. As a content administrator, I want to open the admin families page, so that I can manage families.
2. As a content administrator, I want the people, calendars, media, and photo album pages, so that I can edit content.
3. As a content administrator, I want to land on a content page at `/admin`, so that the admin shell is never empty.
4. As a content administrator, I want the sidebar to hide system items, so that I am not offered actions the rules will deny.
5. As a content administrator, I want a direct system URL to redirect me, so that I never see an empty system shell.
6. As a content administrator, I want to keep editing contacts, expressions, photos, and chat, so that content work does not regress.
7. As a content administrator, I want to moderate any member chat message, so that the community stays clean.
8. As a content administrator, I want my account card to say `Content Admin`, so that my scope is honest.
9. As a content administrator, I want no `Super` badge, so that the UI does not claim system power.
10. As a super administrator, I want every content capability a content admin has, so that I can still fix content.
11. As a super administrator, I want the six system pages, so that I can manage users, flags, recovery, analytics, the family explorer, and uploads.
12. As a super administrator, I want both badges, so that I can tell a super from a content admin.
13. As a super administrator, I want the role checkbox to say `Content Admin`, so that the grant copy matches the real scope.
14. As a member, I want no role badges, so that roles are not advertised to me.
15. As a member, I want my chat message to still be moderable by staff, so that moderation does not change.
16. As a developer, I want the rules diff to touch three nodes, so that review is tractable.
17. As a developer, I want the `messages` subtree untouched, so that moderation semantics cannot drift.
18. As a developer, I want one `isSuper` helper, so that server system checks cannot diverge.
19. As an operator, I want the system callables closed to content admins, so that recovery credentials stay super-only.

## Non-Goals

- No collapse of the admin tier and no demotion of any record.
- No data migration, backfill, or seed role change.
- No change to `AuthAdminGuardService`.
- No change to `functions/src/change-user-role.ts`.
- No change to any `messages` rule clause, authorName override, or validate expression.
- No change to the `users/$uid` write rule.
- No change to Storage rules or upload buckets.
- No new role key and no new feature flag.
- No change to the public or member read path under `familyExplorer/$familyId`.
- No rework of the global toolbar logo, navbar, or mobile sidenav toggle in this change. Those stay super-only and are recorded as a risk.

## Prerequisites

None. The seeded staff account is already a content admin, the seeded super is already a super, and the seeded member-authored chat message `msg-3` at `scripts/e2e/seed.mjs:355-362` is the moderation fixture.

## Design Principles

1. Two real tiers. Content authority reads `roles/admin`, system authority reads `roles/super`, and no check infers one from the other.
2. Smallest rules diff. Only the three nodes that expose system data move to super. Every content write stays put.
3. Guards follow route scope. The parent guard admits both tiers. Only the six system children add the super guard.
4. Navigation follows permission. The sidebar hides items the viewer cannot use, and the index route lands the viewer on a page they can use.
5. Labels follow scope. The stored key is `admin`, the visible label is `Content Admin`.
6. Presentation follows permission. Each badge is gated on the permission it describes.

## Backend Requirements

### Rules Delta

Change exactly three nodes and four expressions in `database.rules.json`. Every other `roles/admin` occurrence stays byte-identical.

| Node | Line | Current expression | New expression | Reason |
|---|---|---|---|---|
| `familyExplorer` `.read` | 4 | `roles/admin` | `roles/super` | The explorer admin surface is a system page |
| `userUploads` `.read` | 197 | `roles/admin` | `roles/super` | Upload review is a system page |
| `userUploads` `.write` | 198 | `roles/admin` | `roles/super` | Upload approval is a system page |
| `rateLimits` `.read` | 235 | `roles/admin` | `roles/super` | Rate-limit inspection is a system concern |

The content write nodes at `:12,16,20,140,145,149,178,182,186,190,194` keep `roles/admin`. The `messages` subtree at `:25-132` keeps every `roles/admin` occurrence. The `users/$uid` write at `:165` keeps its three occurrences. The super-only nodes listed in Current State do not change.

`familyExplorer` write at `:5` is already super. `familyExplorer/$familyId` read at `:7` stays open to members and signed-out visitors. `userUploads` has a child write `false` at `:201`, which stays.

### Server Helpers

Keep `functions/src/helpers.ts:101-104` as the content-admin predicate. Its semantics are already correct: it reads `users/{uid}/roles/admin` and returns true for a super because `toRoles` writes `admin: true` for every super. Add one comment line stating that `isAdmin` means content admin and that system checks use `isSuper`.

Add a sibling helper immediately after it:

```ts
export async function isSuper(uid: string): Promise<boolean> {
  const snap = await getDatabase().ref(`users/${uid}/roles/super`).get();
  return snap.val() === true;
}
```

### System Callables

Switch the three system callables to `isSuper` and keep the single system error copy `Super admin access required.`.

| File | Line | Change |
|---|---|---|
| `functions/src/close-recovery-request.ts` | 7, 26, 27 | Import `isSuper`, call `isSuper(uid)`, copy becomes `Super admin access required.` |
| `functions/src/update-alert-recipients.ts` | 4, 16, 17 | Import `isSuper`, call `isSuper(uid)`, copy becomes `Super admin access required.` |
| `functions/src/admin-generate-reset-link.ts` | 41-44 | Replace the inline `roles/super` read with `isSuper(uid)`, keep the existing copy |

Nothing else in those callables changes. The rate-limit, audit, compare-and-set, and rollback paths stay as they are.

### Alert Fallback Recipients

`functions/src/admin-alert-created.ts:53-61` must select supers only. Change the typed roles field at `:55` from `{ admin?: boolean }` to `{ super?: boolean }`, and change the filter at `:59` from `record?.roles?.admin === true && !!record?.email` to `record?.roles?.super === true && !!record?.email`. This fallback runs only when `config/adminAlertRecipients` is absent. The stored config path takes precedence and is unchanged.

The analytics callable `functions/src/admin-analytics-summary.ts:105-108` already reads `roles/super` and needs no change.

## Frontend Requirements

### Guards

`src/app/app-routing.module.ts:94-98`: remove `SuperAdminGuard` from the parent `canActivate`, leaving `canActivate: [AuthAdminGuardService]`. Remove the now-unused import at `src/app/app-routing.module.ts:19`. Do not change `AuthAdminGuardService`, whose predicate at `src/app/services/auth-admin-guard.service.ts:33` already admits both tiers.

Content admins pass the parent guard and reach the content children. A content admin who requests a system child passes the parent guard and is stopped by the child guard.

### System Route Guards

`src/app/components/admin/admin.module.ts` adds `SuperAdminGuard` to six child routes. Add the import next to the other service imports at the top of the file. Content children stay parent-guarded only.

| Child route | Block | Exact route |
|---|---|---|
| `users` | 42-45 | `{ path: ADMIN_ROUTE.users, component: AdminUsersComponent, canActivate: [SuperAdminGuard] }` |
| `features` | 46-49 | `{ path: ADMIN_ROUTE.features, component: AdminFeaturesComponent, canActivate: [SuperAdminGuard] }` |
| `familyExplorer` | 62-65 | `{ path: ADMIN_ROUTE.familyExplorer, component: AdminFamilyExplorerComponent, canActivate: [SuperAdminGuard] }` |
| `uploads` | 66-69 | `{ path: ADMIN_ROUTE.uploads, component: AdminUserUploadsComponent, canActivate: [SuperAdminGuard] }` |
| `recovery` | 70-73 | `{ path: ADMIN_ROUTE.recovery, component: AdminRecoveryComponent, canActivate: [SuperAdminGuard] }` |
| `analytics` | 74-77 | `{ path: ADMIN_ROUTE.analytics, component: AdminAnalyticsComponent, canActivate: [SuperAdminGuard] }` |

The content routes at `:30-41` and `:50-61` do not change. `photoAlbums` keeps `[PhotoAlbumsFeatureGuard]` and its `fallbackUrl`.

`SuperAdminGuard` redirects to the promoted route when `roles/super` is not true (`src/app/services/super-admin.guard.ts:23-27`). A content admin hitting a system URL therefore leaves `/admin` instead of seeing an empty shell.

### Admin Index Redirect

Replace the empty child route at `src/app/components/admin/admin.module.ts:78-82`. Its current `redirectTo: 'users'` sends every viewer to a system page that a content admin cannot use. Use `redirectTo: ADMIN_ROUTE.families` with `pathMatch: 'full'`. `families` is the first content item in `ADMIN_NAV`, it has no feature flag, and it is allowed for both tiers.

This makes `/admin` land on `/admin/families` for a content admin and for a super. The super default changes from `users` to `families` as a direct consequence. A super who wants `users` uses the sidebar item.

### Admin Sidebar

`src/app/admin/admin-nav.ts` gains a viewer-aware filter.

1. Add `superOnly?: boolean` to `AdminNavItem` at `:22-29`.
2. Add `superOnly: true` to the six system items: `familyExplorer` at `:37`, `uploads` at `:40`, `users` at `:41`, `features` at `:42`, `recovery` at `:43`, and `analytics` at `:44`. The content items `families` at `:34`, `people` at `:35`, `calendars` at `:36`, `media` at `:38`, and `photoAlbums` at `:39` do not get the flag.
3. Change `visibleAdminNav` at `:47-51` to accept the viewer and filter both conditions: `!item.featureFlag || flags?.[item.featureFlag]?.enabled === true` and `!item.superOnly || user?.roles?.super === true`.
4. Update the file header at `:1-2`, which currently claims every admin route requires super.

`src/app/components/admin/admin.component.ts` passes the viewer through.

1. Add a `latestFlags` field and initialize `navGroups` with `buildNavGroups(null, null)` at `:22`.
2. In the flags subscription at `:44-47`, store the flags and rebuild with `this.user`.
3. In the user subscription at `:123-127`, set `this.user` and rebuild with `latestFlags`.
4. Change `buildNavGroups` at `:116-121` to `buildNavGroups(flags, user)` and call `visibleAdminNav(flags, user)`.

A content admin sees five items when the photo album flag is on and four when it is off. A super sees the existing eleven or ten. The sidebar never renders a system item to a content admin.

### Role Badges

Each badge is gated on the permission it describes.

Account card, `src/app/components/user-view`:

- The account card renders the signed-in user (`src/app/components/auth/auth.component.html:73`), so the viewer and `userOnCard` are the same record.
- `isAdminUser()` at `user-view.component.ts:31-33` returns `this.userOnCard?.roles?.admin === true || this.userOnCard?.roles?.super === true`, which is the content-admin-or-super predicate.
- `isSuperUser()` at `:35-37` returns `this.userOnCard?.roles?.super === true`.
- `shouldDisplayRoles()` at `:27-29` returns `isAdminUser()`. A member sees no chip block.
- Add `shouldDisplayContentAdminBadge()` returning `isAdminUser()` and `shouldDisplaySuperBadge()` returning `isSuperUser()`.
- `shouldDisplayUserId()` at `:39-41` keeps `isAdminUser() || isSuperUser()`, which resolves to `isAdminUser()`.

Template `src/app/components/user-view/user-view.component.html`:

- Gate the chip block at `:6` on `shouldDisplayRoles()`.
- Gate the content chip at `:11-13` on `shouldDisplayContentAdminBadge()` and change its text at `:12` from `Admin` to `Content Admin`.
- Gate the super chip at `:14-16` on `shouldDisplaySuperBadge()` and keep the text `Super`.
- The `User` chip at `:8-10` stays gated on `roles.user`.

Resulting matrix: a member sees no chips. A content admin sees `User` and `Content Admin`. A super sees `User`, `Content Admin`, and `Super`.

Admin users list, `src/app/components/admin-users`:

- The route is already super-only, so the viewer always holds `roles/super`. No viewer check is needed in this component.
- `userRoles` at `admin-users.component.ts:141-148` returns `Content Admin` for `roles.admin`, `Super` for `roles.super`, and `Member` for `roles.user`.
- `roleSummary` at `:164-169` returns `Content Admin` and `Super` with the same mapping, and `Member` when neither is set.
- Add `roleClass(role)` returning `admin` for `Content Admin` and `role.toLowerCase()` otherwise. Use it in `admin-users.component.html:116` so the CSS class stays `role-badge-admin`.
- The role history at `admin-users.component.html:199` uses `roleSummary` and inherits the new label.

If this component is ever reused outside a super route, it must gate each badge with the same viewer predicates. It is not reused today.

### Copy Rename

The stored key stays `admin`. Only the user-facing label changes.

| File | Line | Current text | New text |
|---|---|---|---|
| `src/app/components/user-view/user-view.component.html` | 12 | `Admin` | `Content Admin` |
| `src/app/components/user-edit/user-edit.component.html` | 110 | `Admin` | `Content Admin` |
| `src/app/components/user-edit/user-edit.component.ts` | 204 | `Give ${name} admin access?` | `Give ${name} content admin access?` |
| `src/app/components/user-edit/user-edit.component.ts` | 204 | `Remove admin access from ${name}?` | `Remove content admin access from ${name}?` |
| `src/app/components/admin-users/admin-users.component.ts` | 144 | `'Admin'` | `'Content Admin'` |
| `src/app/components/admin-users/admin-users.component.ts` | 166 | `'Admin'` | `'Content Admin'` |

Keep the `Super` label at `src/app/components/user-view/user-view.component.html:15`, `src/app/components/admin-users/admin-users.component.ts:145,167`, and `src/app/components/user-edit/user-edit.component.html:117`. Keep the existing super confirmation strings at `src/app/components/user-edit/user-edit.component.ts:208-209`.

### Inline Content Controls

No predicate changes. The eight controls listed in Current State keep `roles.admin` and therefore work for both tiers. The grant path keeps writing `roles/admin`.

The contact controls at `contact-view.component.html:72` and `contact-edit.component.html:232` are not reachable in the browser because no template renders those components. Their predicates stay unchanged and are covered by grep and by their existing unit specs.

## Production Risks And Mitigations

- A stale client bundle during deploy. A content admin on an old bundle may still see a system sidebar item or a system route that the new rules deny. Mitigation is a reload to pick up the new bundle. No client fallback is added.
- A super-only nav leak. If `visibleAdminNav` is called without the viewer anywhere, a content admin sees system items. Mitigation is the single `buildNavGroups` call site and one unit case per tier.
- Direct URL access. A content admin can type a system URL. Mitigation is `SuperAdminGuard` on all six system children, which redirects to the promoted route rather than rendering an empty shell.
- Alert recipients shrink. The `admin-alert-created` fallback stops mailing content-admin-only records. Mitigation is that `config/adminAlertRecipients` takes precedence and the fallback now reaches the people who can act on alerts.
- Analytics is already super-only. The analytics page and callable were super before this change. Mitigation is no behavior change. The page now has an explicit guard for consistency.
- The entry point stays super-only. The toolbar logo, navbar, and mobile sidenav toggle read `isSuperAdmin()` at `src/app/app.component.ts:134-142,158`. A content admin reaches `/admin` by URL only and, on a narrow viewport, cannot open the admin drawer. Mitigation is that desktop use is unaffected. A follow-up may widen those three checks to `roles.admin` or `roles.super`.
- Contact controls have no browser surface. Mitigation is the unchanged predicate and an explicit grep check, so a future template cannot silently inherit a super-only check.

## Rollout Plan

1. Implement on `2026-11-01_AdminTierSplit`: rules delta, helpers, callables, alert fallback, route guards, index redirect, nav filter, badge predicates, copy rename, spec updates.
2. Run the grep checks for the three changed rule nodes and the untouched `messages` subtree.
3. Run the functions suite, the Angular unit specs, and the rules e2e project until green.
4. Run `npm run e2e:gate` on the full matrix and obtain deploy sign-off.
5. Deploy rules and functions together in one release with no data step.
6. Spot-check one content admin and one super in the emulator: content pages, system redirects, badges, sidebar, and chat moderation.

## Test Plan

Per `docs/testing/TEST_POLICY.md`, assertions live at the lowest provable layer, every user-visible change gets e2e coverage, waits are deterministic, seed state is restored, and `retries` stays 0. All browser tests import `test` and `expect` from `e2e/helpers/fixture.ts`.

### `e2e/specs/admin-roles.spec.ts` (new)

Use three seeded identities: `admin@e2e.local` (super), `staff@e2e.local` (content admin), and `user@e2e.local` (member). Reach the account card by clicking the `Account` button after login, as `e2e/specs/auth.spec.ts:91` does. Restore any mutated roles and flags with `writeDb` in `finally`.

1. `content admin reaches every content admin page`. Log in as staff and visit `/admin/families`, `/admin/people`, `/admin/calendars`, `/admin/media`, and `/admin/photo-albums`. For each, expect the URL to match the route and the route-ready selector from `e2e/specs/admin-consistency.spec.ts:13-46` to be visible.
2. `content admin is redirected from every system admin page`. Log in as staff and visit `/admin/users`, `/admin/features`, `/admin/recovery`, `/admin/analytics`, `/admin/family-explorer`, and `/admin/uploads`. For each, expect the URL not to match `/admin`, `app-admin` count 0, and `admin-nav` count 0.
3. `content admin is served the admin shell at /admin`. Log in as staff, visit `/admin`, expect the URL to be `/admin/families`, `admin-nav` visible, and the `admin-nav-link-users` item count 0.
4. `content admin sees the Content Admin badge and not the Super badge`. Log in as staff, open the account card, expect `.account-role` texts to equal `['User', 'Content Admin']`.
5. `member sees no role badges`. Log in as user, open the account card, expect `.account-roles` count 0 and no `Content Admin` or `Super` text.
6. `super sees the Content Admin and Super badges`. Log in as admin, open the account card, expect `.account-role` texts to equal `['User', 'Content Admin', 'Super']`.
7. `super reaches every system admin page`. Log in as admin and visit the six system routes. Expect `admin-users-table`, `feature-toggle-chat`, `admin-account-creations`, `admin-analytics-totals`, `archive-json-input`, and the uploads table to be visible.
8. `content admin moderates a member chat message`. Save `features/chat`, set it enabled, log in as staff, visit `/chat`, locate the `msg-3` card authored by the member, and expect its `Edit` and `Delete` `.message-button` controls to be visible. Restore the flag in `finally`.
9. `super moderates a member chat message`. Same setup as case 8, log in as admin, expect the same controls on the member card.
10. `content admin keeps the expression create and action controls`. Log in as staff, visit `/expressions`, expect `.create-expression-button` visible, open the seeded expression row, and expect `.expression-actions` visible.
11. `super keeps the expression create and action controls`. Same assertions as case 10 with the admin login.
12. `content admin keeps the legacy photo upload and edit controls`. Save `features/enablePhotoAlbums`, set it to `{ enabled: false, updatedAt: Date.now() }`, log in as staff, visit `/photos`, expect `.photos-upload-button` visible and the seeded photo edit control visible, and restore the flag in `finally`.
13. `super keeps the legacy photo upload and edit controls`. Same setup as case 12 with the admin login.

Contact inline controls cannot be asserted in this browser spec because `contact-view` and `contact-edit` are declared but not rendered. The permanent proof is the unchanged `user.roles.admin` predicate at `contact-view.component.html:72` and `contact-edit.component.html:232`, plus the grep check in Verification Steps.

No arbitrary sleeps, no `test.skip`, and every assertion waits on a rendered element or a polled database read.

### `e2e/specs/rules.spec.ts` (extend)

Add a describe block named `admin tier split` and reuse the existing `signIn`, `readDb`, `writeDb`, `deleteDb`, `get`, `put`, and `patch` helpers with the existing staff token from `e2e/helpers/rules.ts:14`.

1. `content admin is denied familyExplorer, userUploads, and rateLimits reads`. With the staff token, expect `get('familyExplorer')`, `get('userUploads')`, and `get('rateLimits')` statuses not to be 200. With the admin token, expect all three to be 200.
2. `content admin is denied userUploads writes`. With the staff token, put a unique probe record under `userUploads` and expect a non-200 status. With the admin token, expect 200. Delete the probe in `finally`.
3. `content admin keeps every content write node`. With the staff token, put a unique probe key under `contacts`, `calendars`, `calendarEvents`, `photos`, `videos`, `media`, `clans`, `families`, `people`, `addresses`, and `photoAlbums`, and expect every status to be 200. Delete every probe in `finally`.
4. `content admin keeps chat moderation`. With the staff token, patch the seeded member message `messages/msg-3/body` and expect 200, patch `messages/msg-3/authorName` and expect 200, patch `messages/msg-3/isSticky` to its stored value and expect 200, and delete a separate staff-created probe message and expect 200.
5. `content admin keeps self-only likes`. With the staff token, put `messages/msg-3/likes/<staffUid>` and expect 200, then put a like keyed by another uid and expect a non-200 status.

Keep the existing `staff admin cannot mutate features or promotedRoute` case at `:124-144` and the super-only read case at `:146-160` green. They already prove the system boundary.

### `e2e/specs/security.spec.ts` (split)

Replace the single `non-super admin cannot reach any admin route by URL` case at `:171-190` with two cases.

1. `content admin reaches every content admin route by URL`. Log in as staff and visit `/admin/families`, `/admin/people`, `/admin/calendars`, `/admin/media`, and `/admin/photo-albums`. For each, expect the URL to match `/admin` and `admin-nav` to be visible.
2. `content admin is redirected from every system admin route by URL`. Log in as staff and visit `/admin/users`, `/admin/features`, `/admin/recovery`, `/admin/analytics`, `/admin/family-explorer`, and `/admin/uploads`. For each, expect the URL not to match `/admin`, `app-admin` count 0, and `admin-nav` count 0.

Do not include `/admin` in the blocked list. It now lands on a content page. Keep `non-admin cannot open /admin/recovery` at `:163-169` unchanged.

### Existing Browser Specs

`e2e/specs/admin.spec.ts`:

- `:40-46`, `clicking the logo as an admin lands on the admin list`: change the expected URL from `/admin/users` to `/admin/families`.
- `:48-55`, `clicking the logo as a staff admin lands on the promoted route`: no change. The logo stays super-only.
- `:57-65`, `the logo is keyboard focusable and activates with Enter`: change the expected URL from `/admin/users` to `/admin/families`.
- `:67-73`, `staff admin does not see the Admin link in the navbar`: no change. The navbar never renders an admin link.
- `:93`, the checkbox locator: change `name: 'Admin'` to `name: 'Content Admin'`.
- `:96`, the confirmation text: change `Give Regular User admin access?` to `Give Regular User content admin access?`.

`e2e/specs/admin-system.spec.ts`:

- `:71`, the staff badge lookup: change `badge('staff@e2e.local', 'Admin')` to `badge('staff@e2e.local', 'Content Admin')`. The CSS class remains `role-badge-admin`.
- `:137` and `:159`, the checkbox locator: change `name: 'Admin'` to `name: 'Content Admin'`.
- `:140`, the grant text: change `Give Regular User admin access?` to `Give Regular User content admin access?`.
- `:162`, the revoke text: change `Remove admin access from Regular User?` to `Remove content admin access from Regular User?`.
- `:152-153` and `:177-178`, the `roleAudit` before and after assertions: no change. The stored keys stay `admin` and `super`.
- `:407`, the role history text: change `toContain('Admin')` to `toContain('Content Admin')`.

`e2e/specs/admin-consistency.spec.ts` needs no change because every route is visited as the super.

### Angular Unit Specs

- `src/app/services/auth-admin-guard.service.spec.ts:37-50`: no behavior change. Keep `canActivate allows RTDB-backed admins through` for `{ admin: true }` and `canActivate allows supers through even without the admin flag` for `{ super: true }`.
- `src/app/components/user-view/user-view.component.spec.ts:85-100`: replace the two cases with three.
  - `renders the Content Admin and Super chips for a super record`, using `{ user: true, admin: true, super: true }`, expecting `Content Admin` and `Super`.
  - `renders the Content Admin chip only for a content admin record`, using `{ user: true, admin: true, super: false }`, expecting `Content Admin` and not `Super`.
  - `renders no role chips for a member record`, using `{ user: true }`, expecting no `account-roles` and no `Content Admin`.
- `src/app/components/admin-users/admin-users.component.spec.ts`: update `:146` to `['Content Admin', 'Super', 'Member']`. Update `:173` and `:181` to `text: 'Content Admin'` while the class stays `role-badge role-badge-admin`. Update `:210` to `badgeStyle('Admin Only', 'Content Admin')`. Update `:407` to `toContain('Content Admin')`.
- `src/app/components/user-edit/user-edit.component.spec.ts`: update the expected message at `:98` to `Give Ada Lovelace content admin access?`, the combined message at `:213` to `Revoke Ada Lovelace's membership? Remove content admin access from Ada Lovelace?`, and the combined message at `:292` to `Remove content admin access from Ada Lovelace? Remove super access from Ada Lovelace?`.
- `src/app/admin/admin-nav.spec.ts`: update the flag cases for the new signature.
  - `hides photo albums and super-only items when no flags are loaded`, calling `visibleAdminNav(undefined)` as a member, expects 4 keys.
  - `hides photo albums and super-only items when the flag is disabled`, expects 4 keys.
  - `shows photo albums and hides super-only items when the flag is enabled`, expects 5 keys.
  - `shows all items to a super when the flag is enabled`, passing `{ roles: { super: true } }`, expects 11 keys.
  - `shows the ten flag-free items to a super when no flags are loaded`, expects 10 keys.
- `src/app/components/admin/admin.component.spec.ts`: provide an `AuthService` stub whose `userObservable` is a `Subject` and emit `{ id: 'u1', roles: { user: true, admin: true, super: true } }` by default so the existing ten-link assertions at `:53-66` stay valid. Add `renders only content items for a content admin`, emitting `{ id: 'u1', roles: { user: true, admin: true, super: false } }` and expecting 4 links and no `admin-nav-link-users`.
- `src/app/services/auth.service.spec.ts:44-50`: no change. `isUserAdmin()` keeps content-admin semantics.

### Functions Specs

- `functions/src/helpers.spec.ts`: import `isAdmin` and `isSuper`, then add `isAdmin is true for a content admin and a super` and `isSuper is true only for a super`. Seed `{ user: true, admin: true, super: false }` and `{ user: true, admin: true, super: true }` and assert the matrix.
- `functions/src/close-recovery-request.spec.ts:27-29`: rename `seedAdmin` to `seedSuper` and write `users/${uid}/roles/super` instead of `roles/admin`. Add `rejects a content admin caller` seeding `{ admin: true }`, and keep `rejects a non-admin caller` at `:52`.
- `functions/src/update-alert-recipients.spec.ts:45`: seed `admin-1` with `{ super: true }`. Rename the `:62` case `denies a super without the admin role` to `allows a super without the admin role` and assert the call resolves and writes `config/adminAlertRecipients`. Add `denies a content admin caller` seeding `{ admin: true }`.
- `functions/src/admin-generate-reset-link.spec.ts:225-230`: keep `rejects a plain admin caller`. It already seeds `users/admin-1/roles/admin` at `:226` and expects permission denied. The switch to `isSuper` keeps it green with no text change.
- `functions/src/admin-alert-created.spec.ts`: add `recipient fallback selects supers, not content admins`. Unset `config/adminAlertRecipients`, seed one `{ admin: true }` user and one `{ super: true }` user with emails, run the trigger, and assert the single outbound email goes to the super address.
- `functions/src/change-user-role.spec.ts`: no change. Keep `rejects an admin who is not super` at `:62` and `normalizes super to imply admin` at `:173` green. They encode the surviving grant contract.

### Seed

No seed change. `staff@e2e.local` at `scripts/e2e/seed.mjs:34,438` stays `{ user: true, admin: true, super: false }` and is the content-admin fixture. `admin@e2e.local` stays a super at `:435`. `e2e/helpers/rules.ts:11-15` stays unchanged.

## Summary Of Changes

Sign-off checklist.

1. `database.rules.json`: four expressions on three nodes move to `roles/super` (`:4`, `:197`, `:198`, `:235`). All content writes, all `messages` clauses, and the `users/$uid` write stay on `roles/admin`.
2. `functions/src/helpers.ts`: keep `isAdmin` as the content-admin predicate and add `isSuper`.
3. `functions/src/close-recovery-request.ts`, `update-alert-recipients.ts`, and `admin-generate-reset-link.ts`: use `isSuper` and `Super admin access required.`.
4. `functions/src/admin-alert-created.ts`: fallback recipient filter reads `roles.super`.
5. `src/app/app-routing.module.ts`: drop `SuperAdminGuard` from the parent, keep `AuthAdminGuardService`.
6. `src/app/components/admin/admin.module.ts`: add `SuperAdminGuard` to six system children, redirect the empty child to `families`.
7. `src/app/admin/admin-nav.ts` and `admin.component.ts`: add `superOnly`, pass the viewer, rebuild on user and flag changes.
8. `src/app/components/user-view` and `admin-users`: per-permission badge predicates and `Content Admin` labels.
9. `src/app/components/user-edit`: `Content Admin` checkbox label and confirmation copy.
10. New `e2e/specs/admin-roles.spec.ts` with the thirteen cases above.
11. `e2e/specs/security.spec.ts`, `rules.spec.ts`, `admin.spec.ts`, and `admin-system.spec.ts` updated as listed.
12. Angular and functions unit specs updated as listed.
13. No migration, no backfill, no seed change, no Storage change, no new role, no new flag.

## Verification Steps

1. `grep -n "roles/admin" database.rules.json` shows the content writes, the `messages` subtree, and the `users/$uid` line. `grep -n "roles/super" database.rules.json | grep -E "^(4|197|198|235):"` shows the four converted expressions.
2. `git diff -- database.rules.json` touches only lines 4, 197, 198, and 235. A diff on any `messages` line is a defect.
3. `grep -rn "roles.admin" src/app/components/chat-view src/app/components/expressions src/app/components/expression-view src/app/components/contacts src/app/components/photos-legacy --include="*.html"` still lists the eight inline gates.
4. `grep -rn "isSuper" functions/src` lists the helper and the three callables.
5. `npm run test -- functions` is green, including the new `isSuper`, fallback, and content-admin rejection cases.
6. `npx ng test --include src/app/services/auth-admin-guard.service.spec.ts --include src/app/components/user-view/user-view.component.spec.ts --include src/app/components/admin-users/admin-users.component.spec.ts --include src/app/components/user-edit/user-edit.component.spec.ts --include src/app/admin/admin-nav.spec.ts --include src/app/components/admin/admin.component.spec.ts` is green.
7. `npx ng build --configuration=e2e` succeeds.
8. `npm run e2e:gate` is green on Chromium, WebKit, Firefox, the rules project, and the storage-prod project.
9. Manual emulator spot-check: sign in as staff, confirm the five content pages, the six system redirects, the `Content Admin` badge with no `Super` badge, the filtered sidebar, and chat moderation. Sign in as admin and confirm the system pages and both badges.

## Open Questions

None. The tier split, the three-node rules delta, the guard placement, the index redirect, the nav filter, the per-permission badge predicates, the copy rename, and the test seams are all resolved above. The global logo, navbar, and mobile sidenav toggle stay super-only by explicit non-goal and are recorded as a risk.
