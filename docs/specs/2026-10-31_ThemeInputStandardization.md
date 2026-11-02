# Theme Input Standardization: Evergreen Emerald Palette + Control Standardization + User-Facing Read-Only

- **Branch:** `theme+input-standardization` in the `lecoursville-theme` git worktree (`/Users/e/mnt/bnk/cs/lecoursville-theme`); base HEAD `26755dcd`.
- **Date:** 2026-10-31
- **Budget:** ~8 hours, single run. Success criterion (user's words): "100% confidence palette changed and everything standardized." The verification section makes that confidence executable.

## Context & Motivation

Three coupled problems, one initiative:

1. **Brand color is stale.** The brand green (`#2D5A27` light / `#7FB77E` dark) is a forest green that reads muddy in both modes. The accent honey (`#A8762D`) stays. Success currently aliases brand (src/styles.scss:77-79, comment "one green language"), which becomes wrong once brand moves to emerald: success needs its own identity.
2. **Controls are a zoo.** The calendar Print button (calendar.component.scss:40-65: 8px radius, filled brand, bordered) vs the Create Expression button (expressions.component.scss:52-70: pill, muted background, borderless) is the exemplar inconsistency. Inputs still carry a 14px `--radius-input` (styles.scss:111) and two field heights (36px and 44px). 85 raw `border-radius` values are scattered across component SCSS (23x 999px, 11x 4px, 7x 0, 7x 8px, 7x 12px, 6x 2px, 3x each 24px/14px/16px).
3. **The user-facing app pretends to be editable.** Expression creation, contact editing, and legacy photo mutation all surface on the member side with role gates, but every backing DB write is already admin-only (verified against database.rules.json, see Server-Side Enforcement). The user-facing app becomes honestly read-only; admin editing moves to the admin portal by *reusing existing components as-is*.

Provenance note (user-supplied, load-bearing for the contacts admin route): contacts originate from the people/CSV import pipeline; contact-edit exists for manual fixups after import. That is exactly why `/admin/contacts` must exist: the import creates contacts, and admins occasionally repair them. The import pipeline itself is untouched.

## Glossary

See `docs/GLOSSARY.md` for repo-wide terms. Inline definitions this spec depends on:

- **Token** - a CSS custom property declared in `src/styles.scss` under `html` (light) and re-derived under `html[data-theme="dark"]`. Components never hardcode colors; they consume tokens.
- **Control standard** - the single contract every interactive control follows: one height (44px), one radius ladder, one focus treatment, tokenized borders.
- **Read-only (user-facing)** - no create/edit/delete controls for expressions, contacts, photos, albums, people, media, calendar content on member routes. Messaging self-service (chat post/reply/edit-own/delete-own, likes, saves), the public `/upload` flow, and login are explicitly preserved.
- **Role-conditional control** - UI whose visibility or behavior reads `user.roles` to gate a *control*. Informational role display (badges) is not a role-conditional control and stays.
- **Brand solid** - a new theme-invariant saturated fill token (`--color-brand-solid: #27744A`) with white ink, used where a flat brand block is needed in both modes. Modeled on the intent of the error-solid pattern; note no `--color-error-solid` token existed at base HEAD, so both solids are introduced together (see Token Migration).

## Current State

All paths relative to the worktree root. Line numbers verified at `26755dcd`.

### Tokens and Material theming (src/styles.scss)

- Light tokens: `html` block, styles.scss:57-117. Brand: `--color-brand-primary: #2D5A27`, `--color-brand-primary-hover: #3A7033`, `--color-brand-primary-dark: #245020` (:74-76). Success aliases brand (:77-79). Accent: `#A8762D` / `#9C6B26` (:80-81). Error `#B3261E` (:82). Border `#E1E4E8` (:83). Link `#245020` (:84).
- Dark tokens: `html[data-theme="dark"]` block, styles.scss:121-158. Brand `#7FB77E` family (:132-134). Success aliases brand (:135-136). Accent `#C99B55` / `#D4A768` (:137-138). Error `#F2B8B5` (:139). Border `#333940` (:140). Link `#9CC79B` (:141).
- Shape tokens (:108-113): `--radius-card: 16px`, `--radius-control: 999px`, `--radius-input: 14px`, `--radius-sm: 8px`.
- Material theme: `mat.define-theme` with `mat.$green-palette` primary / `mat.$orange-palette` tertiary, light at :169-182, dark at :184-197. `all-component-themes` at :200 with toolbar (:205-208), select/menu/datepicker/autocomplete/dialog (:212-219), and form-field (:222-225) overrides - form fields currently get `--radius-input` (14px) for both filled and outlined container shapes.
- Dark re-emission trap (D-20261030-15): colors-only re-emission `@include mat.all-component-colors($dark-theme)` at styles.scss:230-232. **Any per-component override added inside the light `html` block that is color-bearing MUST be re-emitted inside this dark block or dark mode silently reverts it.**
- Focus-visible: styles.scss:345-348 (`outline: 2px solid var(--color-brand-primary) !important`), with the M3 form-field suppression at :353-355.
- Filled/raised button pills: styles.scss:317-322 (`--mdc-filled-button-container-shape` / `--mdc-protected-button-container-shape` = `var(--radius-control)`).
- Dialog padding `!important` trap (D-20261025-15): styles.scss:236-246 - Material injects dialog styles after this sheet; the shared padding needs `!important`.
- mat-slide-toggle trap (D-20261022-04): Material 22 emits a null `--mat-slide-toggle-handle-width`, pinning the thumb left; a width override is required wherever toggles are styled (today only src/app/components/admin-features/admin-features.component.scss:57 handles it).
- There is **no** `--color-error-solid` token and no input-border token at base HEAD. Both are introduced by this spec.
- No raw-hex allowlist exists today; component SCSS contains raw hex values (e.g. public-upload.component.scss:213/221/241/321 use tokens, but other components hardcode grays and greens).

### Control zoo

- Calendar Print button: calendar.component.scss:40-65 (8px radius, filled brand, bordered) vs Create Expression: expressions.component.scss:52-70 (pill, muted bg, borderless).
- Custom raw-button families (no shared class, raw CSS buttons): photo-album-detail.component.html:3/:14/:19 (`gallery-back-btn`, `gallery-search-clear`, `gallery-slideshow-btn`), photo-albums.component.html:15/:21-22 (`gallery-search-clear`, `gallery-segmented-btn`), public-upload.component.html:33/:39/:61/:66 (`btn-*` family, styled via the `btn-upload` mixin at src/app/styles/_buttons.scss:1-22 and local classes), chat-view.component.html:~62-90 (`.message-button` family).
- Field heights: two heights in use (36px and 44px) across user-facing forms and admin forms (src/app/styles/admin-forms.scss:13 uses `--radius-input` for fields).
- mat-slide-toggle exists ONLY admin-side: admin-features, admin-family-explorer.
- Existing shared button primitive: `src/app/styles/_buttons.scss` (`btn-upload` mixin) - already tokenized, pill via `--radius-control`.

### Read-only scope: role gates in user-facing templates

- expressions.component.html:42 - `@if (user && user.roles && user.roles.admin)` wrapping the Create Expression button (:42-51).
- expressions.component.html:115-123 - inline `app-expression-edit` renders when `expression.isEditable`; the edit-mode surface in the expressions list.
- expression-view.component.html:28-40 - `editMessage()` button (admin-only context).
- contact-view.component.html:72-84 - `@if (user.roles.admin)` footer with edit button that sets `contact.isEditable = true` (the ONLY entry into contact-edit).
- contact-edit.component.html:232 - role gate inside the edit surface.
- user-view.component.ts:30/:37/:46 - `isAdminUser`/`isSuperUser`/combined; used for role badges (informational display) - **these stay** (decision 4).
- photos-legacy.component.html:60/:152/:162 - role gates around legacy photo edit/delete, with `updatePhoto`/`deletePhoto` at photos-legacy.component.ts:94-96/:103-113. **Explicitly out of scope this run (decision 3).** photos-legacy renders only via photo-shell.component.html:2-6 when the `enablePhotoAlbums` flag is off.
- chat-view.component.html:72 - `message.authorId === user.id || (user && user.roles && user.roles.admin)`: KEEP the authorId disjunct, DROP the `roles.admin` disjunct (self-service only).
- Rule (decision 4): role-conditional *controls* are banned on user-facing templates except admin* components, photos-legacy (decision 3), and user-view (informational badges). user-edit and contact-edit compute their role flags in TypeScript.

### Mutation inventory (who can write what)

- contacts.service.ts:52 (`updateContact`), :60 (`deleteContact`) - entered only from contact-view; NO admin equivalent today.
- Expressions/message CRUD: message-edit.component.ts:95/:103/:160; message.service.ts:38/:43/:52/:57/:64 - NO admin equivalent today.
- photos.service.ts:76 (`updatePhoto`), :86 (`deletePhoto`), :131/:135 (album-assign writes) - admin equivalent EXISTS (`admin-photo-albums` uses photo-albums.service.ts:44/:52/:56/:60).
- people.service.ts:40/:44 - no user-side edit UI exists; no change needed.
- Media writes already admin-only. Calendar has NO user-side event mutation (admin-calendars manages the PDF URL only).
- Photo albums user-side (photo-albums.component.html, photo-album-detail.component.html) already read-only: search, sort, slideshow only - no create/edit/delete.

### Routes and guards (src/app/app-routing.module.ts)

- All user routes guarded: contacts :28-31 (Auth+Approved+FeatureFlag), calendar :34-38, chat :40-43, expressions :46-49, photos :52-55, photos/:albumId :58-62, slideshow :64-68, people :71-74, contacts/:id :84-87. Media :90-92 (loadChildren).
- `/admin` at :95-97 behind `AuthAdminGuardService` + `SuperAdminGuard`, loadChildren AdminModule.
- `/upload` at :105-107 (`PublicUploadComponent`) - unguarded BY DESIGN, preserved.
- `/feature-disabled` :100-102, `/auth/action` :109-111, `**` :113-115.
- Admin routes are a flat table in src/app/components/admin/admin.module.ts:26-74 keyed by `ADMIN_ROUTE` constants from src/app/admin/admin-nav.ts:4-15; the sidebar is driven by `ADMIN_NAV` at admin-nav.ts:32-43 (groups People/Content/System at :30), filtered by `visibleAdminNav` (:45-49) with per-item featureFlag.

### Server-side enforcement (database.rules.json) - VERIFIED

Write-rule audit result: every node that a user-facing mutation could touch is already admin-gated or author-scoped:

- `/contacts`, `/photos`, `/videos`, `/media`, `/people`, `/addresses`, `/photoAlbums`, `/calendars`, `/calendarEvents`, `/clans`, `/families` - write requires `roles/admin === true`.
- `/messages/**` - write requires `roles/user === true` AND author scoping (authorId rules); authorName is admin-only. This is the preserved messaging self-service. Member writes are limited to `messageType === 'chat'` at both the message and reply level, and expression records are admin-or-super only.
- `/users/$uid` - self-create with role constraints. `/userUploads/$id` - `False` (public-create pending records for the /upload flow, written via admin SDK paths elsewhere). `/mediaUploads`, `/mediaDeletions`, `/recoveryRequests`, `/adminAlerts`, `/rateLimits`, `/outboundEmails`, `/config/adminAlertRecipients` - `False` (admin SDK / functions only). `/features`, `/promotedRoute` - super only. `/roleAudit/$id` - super, create-once.

**Applied rules changes (2026-11-01 second round).** The first pass concluded that removing UI was enough. Redteam round 2 showed two write or read surfaces were still open, so three rules changed:

- `/contacts` read tightened from `roles/user` to admin-or-super. The member contacts view derives from `/people`, so no member client reads this node.
- The `/messages/$id` create validate now requires admin-or-super on the `messageType === 'expression'` branch, so members cannot create expression records with an empty author name.
- A `messageType` child validate at the message and reply level limits member writes to `'chat'`.

The drift assertion in verification stays: grep for member-writable nodes beyond `messages`, `users/$uid`, and the public-create `False` set, so a future change cannot silently reopen a write path. The completeness script also re-audits every `.write` in `database.rules.json` on each `theme:check` run.

### Discovery citations

- D-20261030-15 (dark re-emission trap) - load-bearing for the token mechanics section.
- D-20261022-04 (slide-toggle handle width) - load-bearing for the control contract.
- D-20261025-15 (dialog `!important`) - constrains any global dialog styling touched during the sweep.
- D-20261025-14 (admin uniformity contract) - see docs/design_specs/2026-10-22_admin_consistency_contract.md; the admin portal keeps its uniformity contract, which this spec's control standard generalizes app-wide.
- D-20261030-01 (tree-styles global leak under ViewEncapsulation.None) - caution during any shared-SCSS extraction.

## Goals

1. Replace the brand palette with "Evergreen Emerald" in both modes, plus the new accent-AA, success-split, brand-solid, and input-border tokens - with zero raw hex outside `src/styles.scss`.
2. Standardize every interactive control app-wide: one 44px field height, text-entry controls at the 16px card radius, pill buttons only, one border/focus/invalid contract, tokenized radii everywhere.
3. Make the user-facing app honestly read-only (except preserved self-service), moving contact and expression editing behind `/admin` by reusing existing components unchanged.
4. Prove all of it with executable completeness checks plus the full gate.

## User Stories

1. As a member, I want the app in a coherent emerald palette in light and dark, so that the brand reads intentional in both modes.
2. As a member, I want every input and button to share one shape and height, so that forms feel like one product.
3. As a member, I want the expressions page to be a library I browse, so that I am never shown edit controls I cannot legitimately use.
4. As a member, I want to keep posting, replying, editing my own, and deleting my own messages in chat, so that self-service conversation is untouched.
5. As a member, I want to like and save messages, so that my personal curation still works.
6. As a member, I want the public `/upload` flow to keep working unguarded, so that invited uploads still need no account.
7. As an admin, I want `/admin/contacts` and `/admin/contacts/:id`, so that I can fix up contacts after CSV import.
8. As an admin, I want `/admin/expressions`, so that I can create and edit expressions from the admin portal.
9. As an admin, I want the standard control contract in the admin portal too, so that the whole app reads as one design system.
10. As a keyboard user, I want a single visible focus treatment derived from the brand, so that focus is never invisible in either mode.
11. As an admin, I want feature-flagged admin nav items to keep their flags, so that photo-album admin stays hidden while the flag is off.
12. As a super admin, I want all guards on user routes preserved, so that the read-only change does not touch authorization.
13. As a developer, I want a scripted completeness check, so that "100% standardized" is a command exit code, not an opinion.
14. As a member on a light theme, I want default input borders at 3:1 contrast, so that field edges meet WCAG 1.4.11.

## Non-Goals

- photos-legacy is untouched this run (decision 3): gates at photos-legacy.component.html:60/:152/:162 and its mutation calls remain. Flag-off fallback only; revisit when the legacy view is retired.
- No new admin UI beyond routing existing components; no new forms.
- No database.rules.json changes (verified unnecessary).
- No feature flags for the rollout (single branch, single release).
- No changes to auth, guards, or the `/upload` guard-free design.
- No palette or radius decisions beyond the locked ladder.
- No deletion of photos-legacy, no replacement of the flag fallback.

## Prerequisites

- Worktree `lecoursville-theme` on branch `theme+input-standardization` at `26755dcd` with a clean tree.
- Java 21 (`JAVA_HOME` export) for the emulator gate.
- Read `docs/testing/TEST_POLICY.md` before behavior changes.

## Design Principles

1. Tokens only: component SCSS consumes `var(--*)`; `src/styles.scss` is the single color authority.
2. One control contract, enforced by grep, not by review.
3. Reuse, don't rebuild: admin editing reuses `expressions.component` and `contact-view`/`contact-edit` verbatim; internal admin role gates keep passing on admin routes.
4. Read-only by honesty: remove UI; enforcement already exists server-side (verified above).
5. Dark parity is part of definition-of-done: every color-bearing override re-emitted in the dark block (D-20261030-15).

## Backend Requirements

None. No schema, no functions, no rules changes. The one backend-adjacent obligation:

- **Rules verification (no change expected):** re-run the write-rule audit during implementation and record the result in the commit. If any member-writable path exists beyond `/messages` (author-scoped), `/users/$uid` (self-create), and the public-create `False` set (`/userUploads/$id`, `/mediaUploads`, `/mediaDeletions`, `/recoveryRequests`, `/adminAlerts`, `/rateLimits`, `/outboundEmails`, `/config/adminAlertRecipients`), STOP and spec the rules change before proceeding - that finding supersedes this spec's no-change conclusion.

## Frontend / UI Requirements

### 1. Token migration table (src/styles.scss)

Light (`html`, :57-117) / dark (`html[data-theme="dark"]`, :121-158). Values below are LOCKED.

| Token | Light old | Light new | Dark old | Dark new |
|---|---|---|---|---|
| `--color-brand-primary` | `#2D5A27` | `#27744A` | `#7FB77E` | `#8CCDA3` |
| `--color-brand-primary-hover` | `#3A7033` | `#1F5F3C` | `#8FC290` | derived light-emerald step (implementer computes, e.g. `#9BD8B2`; must pass large-text contrast on surface) |
| `--color-brand-primary-dark` | `#245020` | `#1F5F3C` | `#6BA76B` | `#6FAF88` |
| `--color-brand-success` (split from brand) | `#2D5A27` (alias) | `#1B7A43` | `#7FB77E` (alias) | `#7CC79B` |
| `--color-brand-success-dark` | `#245020` (alias) | `#166236` | `#6BA76B` (alias) | `#63B287` |
| `--color-accent` | `#A8762D` | `#A8762D` (kept) | `#C99B55` | `#C99B55` (kept) |
| `--color-accent-strong` | `#9C6B26` | `#8A5F1E` (AA text variant) | `#D4A768` | `#D9AE6F` (AA text variant) |
| `--color-error` | `#B3261E` | unchanged | `#F2B8B5` | unchanged |
| `--color-border` | `#E1E4E8` | unchanged (hairlines) | `#333940` | unchanged |
| `--color-link` | `#245020` | `#1F5F3C` | `#9CC79B` | `#8CCDA3` |
| NEW `--color-brand-solid` | - | `#27744A` (theme-invariant) | - | `#27744A` (inherited, not re-derived) |
| NEW `--color-on-brand-solid` | - | `#FFFFFF` | - | `#FFFFFF` |
| NEW `--color-brand-container` | - | `#DCEFE3` | - | `#1C3A2A` |
| NEW `--color-on-brand-container` | - | `#123726` | - | `#DCEFE3` |
| NEW `--color-error-solid` | - | `#B3261E` | - | `#B3261E` (inherited) |
| NEW `--color-input-border` | - | `#C9CED4` (WCAG 1.4.11 3:1 on `#FFFFFF`) | - | `#333940` |
| NEW `--color-input-border-invalid` | - | `#B3261E` | - | `#F2B8B5` |
| NEW `--color-focus` | - | `var(--color-brand-primary)` (per mode) | - | `var(--color-brand-primary)` |
| NEW `--height-control` | - | `44px` | - | inherited |
| `--radius-control` | `999px` | `999px` (unchanged, buttons only - text entry uses `--radius-card`) | inherited | inherited |
| `--radius-input` | `14px` | **DELETED** - text-entry uses `var(--radius-card)` | inherited | inherited |
| `--radius-card` | `16px` | `16px` (unchanged) | inherited | inherited |
| `--radius-sm` | `8px` | `8px` (unchanged; inner chips) | inherited | inherited |
| NEW `--radius-avatar` | - | `50%` | - | inherited |

Neutrals unchanged: `#F3F4F6`/`#FFFFFF`/`#232A32`/`#E1E4E8` light, `#111418`/`#1B1F24`/`#262B31`/`#333940` dark (already correct at styles.scss:66-73/:124-127).

Mechanics: edit both blocks; the brand-solid, error-solid, and `--height-control` tokens are theme-invariant and stay in the light block only (dark inherits). Success stops aliasing brand - delete the "one green language" comment at styles.scss:77-79 and set independent values.

### 2. Material `$green-palette` replacement mechanics

- `mat.$green-palette` (styles.scss:173, :188) is Material's own green scale, close enough in hue but not exact. Replace with a custom palette so M3 tones derive from the locked emerald:
  ```scss
  $evergreen: mat.m2-define-palette((
    50: #EAF4EE, 100: #DCEFE3, 200: #B7DFC8, 300: #8CCDA3, 400: #5BA381,
    500: #27744A, 600: #1F5F3C, 700: #1A4F32, 800: #143F28, 900: #0E2F1E,
    contrast: (500: #FFFFFF, 600: #FFFFFF, 700: #FFFFFF),
  ));
  ```
  Use `primary: $evergreen` in both `define-theme` calls (styles.scss:169-182, :184-197). Tertiary stays `mat.$orange-palette`. (Exact API: if M2 `define-palette` is unavailable in the Angular Material version in use, use `mat.define-palette` / the M3 system-palette map variant - implementer picks the version-correct spelling; the tone map above is the contract.)
- Keep/extend the per-component override block at styles.scss:199-226: form-field `filled-container-shape`/`outlined-container-shape` change from `var(--radius-input)` (:223-224) to `var(--radius-card)` (16px text-entry shape). **Deviation recorded 2026-10-31 (implementation):** the full pill (999px) is geometrically invalid for outlined mat-form-fields — the notched-outline layout inflates and collapses the input to zero width (47 gate failures, auth input invisible; fixed in src/styles.scss:251). Implemented as `var(--radius-card)` (16px) for mat-form-field containers, and raw text-entry inputs follow the same 16px card radius. Pill stays for buttons only.
- **Dark re-emission (D-20261030-15):** any new color-bearing override added inside the light `html` block at :199-226 (e.g. form-field outline colors, toggle colors) MUST be re-emitted inside the dark block at :230-232 alongside `all-component-colors($dark-theme)`. Add the new input-border/invalid overrides in BOTH places.
- mat-slide-toggle (admin-only; D-20261022-04): wherever toggle overrides land, set `--mat-slide-toggle-handle-width` explicitly; do not rely on Material's null default.

### 3. Raw-radius sweep mapping

Replace every raw `border-radius` in `src/**/*.scss` (outside `src/styles.scss`) per this ladder:

| Raw value found | Replaces with |
|---|---|
| `999px`, `50%` on avatars-as-pill, `9999px`, `100px` | `var(--radius-control)` (buttons only, pills) |
| `50%` on round avatars/circles | `var(--radius-avatar)` |
| `16px` | `var(--radius-card)` |
| `8px`, `6px` (small corners, chips, thumbnails) | `var(--radius-sm)` |
| `14px`, `12px`, `4px`, `2px`, `24px` on inputs/fields/cards/badges | map by role: text-entry fields -> `var(--radius-card)`; badges/inner chips -> `var(--radius-sm)`; cards -> `var(--radius-card)` |
| `0` on containers that must square against the viewport edge (sidenav :213 family-explorer, page grounds) | keep as literal `0` - allowlisted (see completeness script) |
| `50%` on icon-only circular buttons | `var(--radius-avatar)` (or `--radius-control` if pill geometry; implementer judgment, logged in commit) |

Known concentration sites: admin-media-upload-audio-album.component.scss:54/:80/:107/:135, admin-photo-albums.component.scss:209/:344, admin-media-upload-video.component.scss:54/:93, family-explorer.component.scss:45, admin-forms.scss:13, photos-legacy.component.scss:194 (out of scope file - leave), plus the 85-value scatter from recon.

### 4. One control standard contract

- **Buttons:** all buttons (Material `mat-button`/`mat-raised-button`/`mat-unelevated-button`/`mat-stroked-button` AND raw `.gallery-*`, `.btn-*`, `.message-button`, Print button) conform to: height 44px (`var(--height-control)`), radius `var(--radius-control)`, focus = 2px `var(--color-focus)` outline per styles.scss:345-348 (already global). Variants: filled (brand primary bg + `--color-on-brand`), container (brand container bg + `--color-on-brand-container`), destructive (`--color-error-solid` bg + white ink; extend styles.scss:265-270 `.btn-destructive` if present, else the `.btn-*` destructive classes in public-upload), text/ghost (transparent, ink). Hover: `--color-brand-primary-hover`. The calendar Print button (calendar.component.scss:40-65) becomes the filled variant; Create Expression (expressions.component.scss:52-70) - after the read-only removal, its button lives admin-side and takes the filled variant too.
- **Inputs:** one height 44px (`var(--height-control)`); default border 1px `var(--color-input-border)` (light `#C9CED4`, dark `#333940` - strict WCAG 1.4.11 3:1); radius `var(--radius-card)` (16px) via form-field overrides and raw text-entry inputs, the pill is for buttons only; invalid border `var(--color-input-border-invalid)` (`#B3261E` light / `#F2B8B5` dark); focus = notched outline `var(--color-focus)` + container ring (M3 handles the notch; the global `:focus-visible` suppression at styles.scss:353-355 stays).
- **Slide-toggle:** admin-only; standard 44px row height around it, handle-width pinned (D-20261022-04), on-color = brand primary per mode, re-emitted dark.
- **Chips:** inner chips `var(--radius-sm)` (8px); role badges (styles.scss:89-94 pairs) unchanged values, radius -> `var(--radius-sm)`.
- **Badges:** role badges and calendar tag styles keep their bg/fg pairs; radii tokenized.
- **Avatars:** `var(--radius-avatar)` (50%).

### 5. Read-only removals (exact sites)

| Site | Action |
|---|---|
| expressions.component.html:42-51 | Delete the admin-gated Create Expression block |
| expressions.component.html:115-123 | Remove the `expression.isEditable` `app-expression-edit` branch (view branch at :107-114 remains for all items) |
| expressions.component.ts | Remove `onCreate()`, `cancelEdit()` and any now-unused edit plumbing; `message.service` write methods that become dead from this surface stay (used by chat + new admin route) |
| expression-view.component.html:28-40 | Remove the admin edit button block (expression-view becomes pure read surface on user routes) |
| contact-view.component.html:72-84 | Remove the `@if (user.roles.admin)` edit footer |
| contact-edit.component.html:232 | Gate moves to a TypeScript `canDelete` getter, component moves to admin routing (reuse as-is) |
| chat-view.component.html:72 | Change `message.authorId === user.id \|\| (user && user.roles && user.roles.admin)` to `message.authorId === user.id` |
| user-view.component.ts:30/:37/:46 | KEEP (informational badges, decision 4) |
| photos-legacy.component.html:60/:152/:162 + photos-legacy.component.ts:94-113 | LEAVE UNTOUCHED (decision 3, out of scope) |
| message-edit.component.ts:95/:103/:160; message.service.ts | Unchanged - these serve chat self-service AND the new admin expressions route |

### 6. Admin route additions (reuse as-is)

- `ADMIN_ROUTE` (admin-nav.ts:4-15): add `contacts: 'contacts'` and `expressions: 'expressions'`.
- `ADMIN_NAV` (admin-nav.ts:32-43): add `{ key: 'contacts', path: '/admin/contacts', label: 'Contacts', icon: 'contact_mail', group: 'People' }` and `{ key: 'expressions', path: '/admin/expressions', label: 'Expressions', icon: 'format_quote', group: 'Content' }` (decisions 1, 5).
- admin.module.ts route table (:26-74): add `path: ADMIN_ROUTE.contacts` with a child route pair: `''` -> contacts list (a minimal admin wrapper listing contacts that links to detail; list markup may reuse contact-view cards in read mode) and `:id` -> `ContactEditComponent` rendered inside the admin shell, plus `path: ADMIN_ROUTE.expressions` -> `ExpressionsComponent` as-is (its internal admin gate at expressions.component.html:42 is deleted per section 5, so no gate blocks it).
- Declarations: ensure `ContactEditComponent`, `ContactViewComponent` (already in app.module.ts), and `ExpressionsComponent` are importable by AdminModule (export from their modules or declare; implementer resolves per existing AdminModule pattern - it already imports cross-module components).
- Admin shell nav renders automatically from `ADMIN_NAV` - no nav template changes.
- Contacts list on admin side: the minimal new surface in this spec. Scope it to a table/card list (name, email, phone) with row click to `/admin/contacts/:id`. No create/import controls (import stays in admin people import).

### 7. Preservation assertions (must survive the change)

- Chat: post, reply, edit-own (`chat-view.component.html:72` authorId-only), delete-own, likes, saves all functional.
- `/upload` (app-routing.module.ts:105-107): no guard added, flow unchanged.
- Login and every existing guard on user routes (app-routing.module.ts:28-92) unchanged.
- User-view role badges render as before.

## Production Risks & Mitigations

1. **Dark-block re-emission trap (D-20261030-15):** a color override added only in the light block silently reverts in dark. Mitigation: the e2e dark-mode spec asserts input borders/focus in dark; the completeness script checks overrides exist in both blocks.
2. **mat-slide-toggle null handle width (D-20261022-04):** restyling toggles without pinning handle width pins the thumb left. Mitigation: explicit token set; admin-features e2e smoke.
3. **Dialog `!important` precedence (D-20261025-15):** Material injects dialog styles late; global dialog changes need `!important`. Mitigation: leave styles.scss:236-246 mechanics alone.
4. **Admin uniformity contract (docs/design_specs/2026-10-22_admin_consistency_contract.md, D-20261025-14):** the admin portal's page-title card / filter-row conventions must survive the sweep; do not restyle admin chrome beyond the token/radius/height standardization.
5. **photos-legacy exception drift:** role-gated mutation UI remains at photos-legacy.component.html:60/:152/:162 (flag-off fallback only). E2E must assert it stays reachable-but-gated while the album view is read-only, so the exception is visible, not forgotten.
6. **Custom M3 palette tone drift:** hand-rolled palette tones may shift M3-derived surfaces (M3 derives surface tones from primary). Mitigation: the overlay-surface pins at styles.scss:212-219 stay; dark-mode e2e screenshots assert dropdown/dialog surfaces.
7. **Contrast regressions from `#8CCDA3` ink-green on dark surfaces:** `--color-link` dark changes to `#8CCDA3`; verify against `#1B1F24` surface (large-text/AA for link usage) in the e2e contrast checks already present, else adjust only `--color-link`.

## Rollout Plan

Single branch, no flags. One release: tokens + controls + read-only + admin routes ship together. Order of implementation commits (recommended, each gate-green or at least build-green):

1. Token migration + Material palette + dark re-emission (no behavior change).
2. Radius/height sweep + control contract (visual only).
3. Read-only removals + chat-view disjunct trim.
4. Admin routes (contacts, expressions) + admin-nav entries.
5. Tests: completeness script, e2e updates, unit updates.

No deploy in this run; deploy sign-off per AGENTS.md is separate.

## Test Plan

### Completeness script (new, `scripts/check-theme-standardization.mjs`, wired into `npm run e2e:gate` pre-build or standalone `npm run theme:check`)

Exits non-zero with file:line output on violation:

1. **Zero raw hex colors** in `src/**/*.scss` and `src/**/*.html` (inline styles) outside `src/styles.scss` - allowlist: none (styles.scss itself exempt; `color-mix()` wrappers around tokens are fine as long as the mixed values are `var(--*)`).
2. **Zero non-token border-radius** outside `src/styles.scss`: every `border-radius` must be `var(--radius-*)` or literal `0`; collect and diff against the section-3 mapping (any unlisted raw value fails).
3. **Zero `user.roles` reads in user-facing templates** (`src/app/components/**` excluding `admin*`, `photos-legacy`, and `user-view` which reads in TS for badges): grep `user.roles` / `roles?.admin` / `roles.admin` / `userSignedIn.roles` in `.html` files and fail on violations. The final exception set is exactly admin*, photos-legacy, and user-view (informational badges). user-edit and contact-edit now compute their role flags in TypeScript, so their templates carry no role reads.
4. **No `--radius-input`** token or usage anywhere (deleted).
5. **Rules audit:** parse `database.rules.json`; fail if any `.write` evaluates to a rule NOT containing `roles/admin` or `roles/super`, excluding: `/messages/**` (author-scoped - assert the rule string contains `authorId`), `/users/$uid` (assert `auth.uid` self-match), and the `False` public-create set listed in Backend Requirements.
6. **Dark parity:** every `@include mat.*-overrides` color-bearing call inside the light `html` block has a counterpart inside the dark block (structural check on styles.scss).

### e2e (Playwright; `import { test } from '../helpers/fixture'`; deterministic waits; retries 0; restore flags; chat seeded OFF)

Per repo routing table:

- `e2e/specs/nav.spec.ts` - admin sidebar shows Contacts (People) and Expressions (Content) for super admin; ordering/labels; user navbar unchanged.
- `e2e/specs/feature-flags.spec.ts` - `visibleAdminNav` filtering still hides Photo Albums when `enablePhotoAlbums` off; flags restored after test. Also photo-shell fallback: flag off renders photos-legacy (still routed, still shows its admin edit controls for admins - decision 3 exception made visible), flag on renders photo-albums.
- `e2e/specs/expressions.spec.ts` - as member: expressions list renders read-only; NO Create button; NO inline edit surface; expression-view shows no edit button. As super admin via `/admin/expressions`: Create + edit + delete work end-to-end (seed data per scripts/e2e/seed.mjs - extend seed with an admin-authored expression if absent).
- `e2e/specs/contacts.spec.ts` - as member: contact detail has no edit footer (contact-view.component.html:72-84 gone). As super admin: `/admin/contacts` lists seeded contacts; row click opens `/admin/contacts/:id`; a field fixup saves and persists (update path contacts.service.ts:52); delete NOT surfaced in the admin list this run unless contact-edit already exposes it (keep whatever contact-edit itself renders).
- `e2e/specs/chat.spec.ts` - as member: post, reply, edit-own, delete-own, like, save all work (preservation). Admin attempting edit on another author's message sees no edit control (disjunct removed at chat-view.component.html:72). Restore chat flag OFF if the test enables it.
- `e2e/specs/security.spec.ts` - read-only boundary: (a) member navigating to `/admin/contacts` and `/admin/expressions` is blocked by AuthAdminGuard+SuperAdminGuard; (b) DB-tamper probe: attempt a direct write to `/contacts/$id` as member via the RTDB SDK in-test and assert permission-denied (rules audit made real); (c) `/upload` remains reachable without auth (guard-free preserved).
- `e2e/specs/admin.spec.ts` (or existing admin domain spec) - `/admin/expressions` create/edit/delete happy path if not already covered by expressions.spec admin section; keep one home for it, cross-reference.
- `e2e/specs/edge-cases.spec.ts` - theme toggle light/dark: input border `#C9CED4` / `#333940` computed-style assertions on a seeded form; focus-visible outline color equals brand per mode; invalid state shows `--color-input-border-invalid` on a required-field submit.
- Calendar Print button (filled variant) and photo-albums gallery buttons: assert class/geometry (height 44, radius 999) via `getComputedStyle` in the calendar/photos specs if they exist, else edge-cases.

### Unit tests (`npx ng test --include`)

- `expressions.component.spec.ts`: no `onCreate` / Create button renders for admin or member; `isEditable` items render via expression-view. The admin-route case stubs `Router.url` to exercise the live `isAdminRoute` getter (`isAdminRoute` is derived from `Router.url`, not a one-shot `location.pathname` read).
- `chat-view.component.spec.ts` (or message-view spec): edit control renders only when `authorId === user.id`, not for admin on foreign messages.
- `contact-view.component.spec.ts`: no edit footer regardless of roles.
- `admin-nav` / `visibleAdminNav` spec: Contacts and Expressions entries present with correct groups; featureFlag filtering intact.
- `admin.module` routing spec: `/admin/contacts/:id` resolves `ContactEditComponent`; `/admin/expressions` resolves `ExpressionsComponent`.
- Update any spec asserting the old brand hexes or `--radius-input`.

### Verification steps (runbook)

1. `npm run theme:check` (completeness script) - exit 0.
2. `npx ng test --include` - all green.
3. `npm run e2e:gate` - full matrix green (Chromium + WebKit + Firefox), 0 retries, no skips.
4. Manual smoke (one pass, both modes via the theme toggle): expressions (read-only), chat self-service, `/upload`, admin contacts fixup, admin expressions create, admin-features toggle thumb position.
5. Rules audit output pasted into the commit message.

## Summary of Changes (sign-off checklist)

1. `src/styles.scss`: token migration per table (brand emerald both modes, success split, accent AA variants, new brand-solid/container/input-border/focus/height tokens, `--radius-input` deleted); custom `$evergreen` M3 palette in both `define-theme` calls; form-field container shapes to `var(--radius-control)`; new overrides re-emitted in dark block.
2. `src/app/styles/admin-forms.scss` + all component SCSS: raw hex -> tokens; raw radii -> ladder per mapping; text-entry fields to 44px/16px card radius and buttons to 44px/pill; Print button and Create Expression unified to filled pill; `.gallery-*`, `.btn-*`, `.message-button` families tokenized.
3. Read-only removals: expressions.component.html:42-51/:115-123, expression-view.component.html:28-40, contact-view.component.html:72-84, chat-view.component.html:72 disjunct trimmed. photos-legacy untouched. user-view badges untouched.
4. Admin: `ADMIN_ROUTE`/`ADMIN_NAV` + admin.module routes for `/admin/contacts` (+`:id` reusing `ContactEditComponent` with a minimal list surface) and `/admin/expressions` (reusing `ExpressionsComponent`).
5. `scripts/check-theme-standardization.mjs` completeness script + npm script.
6. Seed additions in `scripts/e2e/seed.mjs` (admin-authored expression, admin-visible contact needing fixup) if absent.
7. e2e specs updated/extended per test plan; unit tests per test plan.
8. No `database.rules.json` change (verified; audit re-run recorded).
