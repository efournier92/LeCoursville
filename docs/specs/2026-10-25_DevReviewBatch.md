# Dev Review Batch: Family Canonicalization, Toolbar Chrome, Calendar, Media Polish And Finalize Save Fix

- Branch: `fine-tuning-2026-10-25`, cut from `master` at `6f3f9266`
- Source ledger: `docs/critique/2026-10-25_DevReview.md` (findings F-20261025-01 to F-20261025-20, decisions OQ-20261025-01 to OQ-20261025-04)
- Post-review finding: F-20261025-21, a production-only media finalize save failure found in the first real dev upload. It is specified here in "Media Finalize And Conditional Writes"; the ledger entry is appended separately.
- Reviewed build: deployed dev channel `https://lecoursville-dev.web.app/`, byte-identical to `master` at `6f3f9266`
- Merge target: `master`. Deploy target: `lecoursville-dev` through `npm run deploy:dev`. Owner re-tests in dev after the deploy.

## Context And Motivation

The owner reviewed the dev build end to end and produced twenty findings plus one data decision. Individually most are small visual or interaction defects. Together they describe three deeper problems that this batch fixes at the root rather than per page:

1. The app carries two parallel collections for one domain concept. Admin reads and writes `families`; every feature reads and writes `clans`. The dev Families page is empty while the People filter lists families, so the admin surface is functional but disconnected from the data the site uses.
2. Shared chrome has drifted. The white page-title bar is a flat strip while the cards under it are rounded surfaces, and the vertical gap below that bar is set separately by each of the nine admin pages with six different values.
3. Browser-native and engine-specific rendering leaked into product surfaces: the audio transport is the UA's own control set, and media thumbnails are rounded and cropped inconsistently with the square icons the app stores.
4. The post-review dev media smoke exposed a production-only save failure the emulator gate cannot see. Every upload reached S3, but the finalize claim aborted against an empty local cache before contacting the server, so no record was written. The fix is a platform-level conditional-write correction that lands first in this batch.

The batch also removes one access path that no longer matches the intended navigation model. Admin becomes reachable only through the top-left logo, and only for super admins.

## Glossary

**Family**

A named group with a hex colour. People belong to a family through `Person.familyId`. This is the canonical term in UI, code, and database paths. _Avoid_: clan, group, tribe.

**Clan**

Retired term. Appears only in legacy code, the legacy `clans` database node, and historical documents until the migration completes. Never use in new code, copy, or schemas.

**Lineage**

The ancestry path text on a person plus the derived ancestry and descendant trees (`Person.lineage`, `person-detail-modal`). A different concept from Family; do not merge the two during this work.

**Page title bar**

The white `app-page-toolbar` at the top of a page, carrying the page heading and page-level actions. Not the green application bar. Referred to as the toolbar in this spec.

**Legacy key**

A database field or node that exists only so that pre-migration code keeps working during the cutover window: the `clans` node, `Person.clanId`, and the `?clan=` query parameter.

**Finalize claim**

The RTDB conditional write that flips a media upload batch from `ticketed` to `finalizing` before S3 verification and record creation (`functions/src/finalize-media-upload.ts:312-334`). A batch that never claims cannot save.

**Cold cache**

An RTDB client process whose local sync tree holds no value for a path yet. The first transaction callback reads that cache rather than the server, so a cold path surfaces to the mutator as `null`.

**Conditional write**

The read-modify-write helper `compareAndSet` (`functions/src/helpers.ts:130-148`), which commits only when the mutator accepts the current value. _Avoid_: lock, CAS, transaction when the mechanism is not an RTDB transaction.

## Current State

Anchors are to `master` at `6f3f9266`.

### Family And Clan Split

- `Clan` and `Family` models are field-for-field identical: `src/app/models/clan.ts:1` and `src/app/models/family.ts:1`.
- Two services over two paths: `src/app/services/clan.service.ts:10` (`CLANS_PATH = 'clans'`) and `src/app/services/family.service.ts:10` (`FAMILIES_PATH = 'families'`).
- Admin reader and writer: `src/app/components/admin-families/admin-families.component.ts:130` subscribes to `familyService.families$`; the empty state renders at `src/app/components/admin-families/admin-families.component.html:135`.
- Feature readers: `src/app/components/people/people.component.ts:121` subscribes to `clanService.clans$`; the People filter iterates it at `src/app/components/people/people.component.html:24` under the label `By Family`.
- Foreign key: `Person.clanId` at `src/app/models/person.ts:30`.
- Importer writes families through the clan service and auto-creates missing records: `src/app/components/admin-people-import/admin-people-import.component.ts:242-243`.
- Persistence: both nodes are declared in rules, `database.rules.json:169` (`clans`) and `:173` (`families`), and both are seeded with the same two records under different ids, `scripts/e2e/seed.mjs:258-265`.
- URL state: People and Contacts read and write a `clan` query parameter, `src/app/components/people/people.component.ts:74-77` and `:165`, `src/app/components/contacts/contacts.component.ts:46` and `:188`.
- Every rendered label already says Family: `src/app/components/people/people.component.html:24`, `src/app/components/contacts/contacts.component.html:24`, `src/app/components/person-detail-modal/person-detail-modal.component.html:21`, `src/app/admin/admin-nav.ts:32`, `src/app/components/admin-families/admin-families.component.html:2`.
- No document defines the difference. `design_specs/clans-ads.md:10-12` introduces the clan collection for data integrity, while `design_specs/people-page.md:42` calls the same UI grouping a family.

### Shared Toolbar And Gap Drift

- Toolbar implementation: `src/app/components/shared/page-toolbar/page-toolbar.component.scss:8-18`. Height 64px (`:12`), padding `0 16px` (`:13`), no radius, `border-bottom: 1px solid var(--color-border)` (`:16`), mobile 56px (`:86-88`). Its own comment says "Chrome, not a card".
- Consumers: 18 templates, all admin pages plus contacts, calendar, chat, expressions, media explorer, people, photo album detail, photo albums, and photos legacy.
- Container gutters differ by surface: admin content padding is `28px 32px` (`src/app/components/admin/admin.component.scss:204`), feature pages use `.page-content` with `padding: 0 16px 24px` (`src/styles.scss:333-342`), so feature toolbars currently touch the green bar with no top space.
- Gap below the toolbar is per page, not shared: first-card `margin-top` values of `4px` (`src/app/components/admin-users/admin-users.component.scss:43`), `8px` (`src/app/components/admin-features/admin-features.component.scss:8`), `12px` (`src/app/components/admin-recovery/admin-recovery.component.scss:99`), `16px` (`src/app/components/admin-users/admin-users.component.scss:54`), `20px` (`src/app/components/admin-features/admin-features.component.scss:19`), and `24px` (`src/app/components/admin-features/admin-features.component.scss:84`).
- Contract in force: `design_specs/2026-10-22_admin_consistency_contract.md:20-25` fixes 64px desktop and 56px mobile, no vertical padding, and no filters inside the title bar; the filter bar is a separate 56px row (`:34-39`). Indexed as D-20261022-03.
- Enforcement: `e2e/specs/admin-consistency.spec.ts:116-132` asserts those exact heights per route, and `:83-86` asserts no form or filter control inside the bar.

### Calendar

- Event tags: `src/app/components/calendar-cell/calendar-cell.component.scss:5-26`. Fill is `var(--color-surface-muted)` (`#EBEDF0`), birth accent is `var(--color-brand-primary)` (brand green), anniversary accent is `var(--color-accent-strong)` (honey), each with a 4px left border, `width: 100%`, and no inline margin.
- Pre-facelift palette, recoverable from `git show df0848fb^:src/app/components/calendar-cell/calendar-cell.component.scss`: birth `#3182ce`, anniversary `#e53e3e`, fill `#fafbfc`, both on the Chakra palette (blue.500, red.500).
- Day cells carry no padding: `node_modules/angular-calendar/css/angular-calendar.css:24` (`.cal-month-view .cal-cell`), which is why tags sit flush to the cell edge.
- Month picker: opened by the pill at `src/app/components/calendar/calendar.component.html:44`, rendered at `:61`, panel styles at `src/app/components/calendar/calendar.component.scss:147-173`. `datePickerOpen` is declared at `src/app/components/calendar/calendar.component.ts:40` and only ever set false in `selectPickerMonth` (`:178-184`). No outside-click or Escape handler exists anywhere in the app.
- Nav row and spacing: `src/app/components/calendar/calendar.component.scss:68` (`margin: 0 0 10px`); page bottom space is the 24px in `.page-content`.
- Print dialog: opened as a plain `MatDialog` at `src/app/components/calendar/calendar.component.ts:231`; internal padding is thin, `src/app/components/calendar-printer/calendar-printer.component.scss:1` (`padding: 8px 0`), `:5`, `:17` (`padding: 0 4px`); its action button is a grey fill at `:63`. The toolbar Print button already uses the filled brand treatment, `src/app/components/calendar/calendar.component.scss:37`.

### People

- Row hover fill on the people tree: `src/app/components/people/people.component.scss:78-88` (`.tree-row`, `background-color: var(--color-surface-muted)` at `:86`, transition at `:82`). The name already underlines, `.person-name.clickable:hover` at `:121`.
- Row hover fill in the person modal lineage list: `src/app/components/person-detail-modal/person-detail-modal.component.scss:189-199`.
- Contact card in the modal is data-driven only, `src/app/components/person-detail-modal/person-detail-modal.component.html:63`; no living check.
- No death date exists anywhere: `Person` carries `isLiving` only (`src/app/models/person.ts:41`); the importer reads a `Living?` column (`src/app/components/admin-people-import/admin-people-import.component.ts:192-196`) and no death column; no `death` string appears in `src/`, `functions/src/`, rules, or seed.
- Age is computed against today, `src/app/components/person-detail-modal/person-detail-modal.component.ts:361`.

### Media

- Media card thumbnails are rounded in four rules: `src/app/components/media-list/media-list.component.scss:83` and `:100`, plus the admin overrides at `:147` and `:161`; they crop with `object-fit: cover` at `:99` and `:160` inside a 72px square frame.
- Video upload thumbnail preview is widescreen and rounded: `src/app/components/admin-media-upload-video/admin-media-upload-video.component.scss:89-97` (`aspect-ratio: 16 / 9`, `border-radius: var(--radius-input)`), rendered at `src/app/components/admin-media-upload-video/admin-media-upload-video.component.html:90`.
- Audio album cover preview is already square but still rounded: `src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component.scss:148-156`.
- Audio play bar is the native element: `<audio ... controls autoplay>` at `src/app/components/audio-player/audio-player.component.html:27`, wrapped by a styled card at `src/app/components/audio-player/audio-player.component.scss:20-27`. Component state is `tracks` and `currentTrack` with `selectTrack` at `src/app/components/audio-player/audio-player.component.ts:26-56`. No `prefers-color-scheme` rule exists in `src/`; `html { color-scheme: light }` is at `src/styles.scss:58`.

### Media Finalize And Conditional Writes

- Claim path: `functions/src/finalize-media-upload.ts:312-334`. The mutator returns `undefined` when `current` is null, and `:332-334` throws `failed-precondition` `Finalize already in progress.` when `committed` is false.
- Helper: `functions/src/helpers.ts:130-148`. Production uses `ref.transaction(mutate)` at `:143`; the emulator branch at `:134-141` uses get-then-set. The comment at `:119-121` attributes the null callback to the emulator, but it is the SDK's local-cache-first behavior and applies in production too.
- SDK behavior as installed at `6f3f9266` (`firebase-admin@13.10.0`, bundled `@firebase/database`): `runTransaction` registers `onValue` and immediately calls `repoStartTransaction` (`functions/node_modules/@firebase/database/dist/node-esm/index.node.esm.js:13907-13925`). `repoStartTransaction` runs the mutator against the local cache (`:11266-11283`); returning `undefined` aborts before any server round-trip. A preceding `get()` does not leave the value cached, because `repoGetValue` removes the event registration and the sync point (`:11027-11063`).
- Affected callers, all sharing the `if (!current) return undefined` shape: `functions/src/update-media-metadata.ts:114`, `functions/src/close-recovery-request.ts:43` and `:78`, `functions/src/admin-generate-reset-link.ts:107`, `:124`, and `:176`, plus the finalize claim above.
- Rate limiting is unaffected because its mutator returns a value on `null` (`functions/src/helpers.ts:192-209`).
- Client swallow: video catches at `src/app/components/admin-media-upload-video/admin-media-upload-video.component.ts:295-302`, `:320-340`, and `:368-376`; audio catches at `src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component.ts:424-429`, `:462-465`, and `:513-516`. Both replace every rejection with the fixed `FINALIZE_FAILURE` copy.
- Error bands: `src/app/components/admin-media-upload-video/admin-media-upload-video.component.html:154-160` (`video-upload-error`) and `src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component.html:238-246` (`album-upload-error`).
- Mapping: `src/app/services/media-upload.service.ts:192-201` (`MediaUploadError`) and `:217-249` (`mapMediaError`). `failed-precondition` keeps the server message; the default branch discards it.
- Console guard: `e2e/helpers/console.ts:27-32` fails a test on any `console.error` not in the allowlist, so a diagnostic log needs an app-owned prefix.
- Evidence from the first real dev upload, 2026-10-25 19:45 UTC: `Video/test-upload.mp4` (679,980 bytes) and `Video/Icons/test-upload.jpg` (17,805 bytes) exist in `lecoursville-media-dev` with matching `upload-batch` metadata and content types. Batch `-P4oaF0SL5PnnF4ad8AL` stayed `ticketed` with `lastActivityAt` `19:45:49.901Z`. `rateLimits/media-finalize/<uid>` committed `count: 1` at `19:45:51.691Z`. The only finalize invocation logged auth `VALID` and no error. A local reproduction with the installed Admin SDK saw the mutator called with `null`, `committed: false`, and the node unchanged; holding a listener open first made the same call commit.

### Admin Surfaces

- Media upload page: tab shell at `src/app/components/admin-media/admin-media.component.html:7`, video panel template of 351 lines at `src/app/components/admin-media-upload-video/admin-media-upload-video.component.html:2`, audio panel of 265 lines. Video fields: dropzone (`:17`), Title (`:36`), Date (`:47`), Storage name (`:59`), S3 path preview (`:72`), thumbnail preview (`:90`), Duration (`:124`), Replace/Sticky/Hidden checkboxes (`:132-150`). Audio fields: Title (`:11`), Folder name (`:24`), Date (`:41`), track dropzone (`:53`), per-track title (`:105`), own-zip checkbox (`:194`), Sticky/Hidden (`:226-236`).
- Photo Albums grid: three columns at `src/app/components/admin-photo-albums/admin-photo-albums.component.scss:66-71`, two under 992px (`:134`), one under 600px (`:140`), square cover `aspect-ratio: 1 / 1` at `:155-168`.
- Role badges: `src/app/components/admin-users/admin-users.component.scss:20-39`. Admin asks for `--color-accent-soft`, which is declared nowhere, so the fallback `rgba(63, 81, 181, 0.12)` ships with honey text; Super uses error red; Member uses the muted grey. Rendered at `src/app/components/admin-users/admin-users.component.html:113`. Honey already means warning/pending in uploads status chips (`src/app/components/admin-user-uploads/admin-user-uploads.component.scss:87-110`), and red already means error.
- Dialogs: eight opens, no shared padding or shape convention. The theme pins only the container colour, `src/styles.scss:133`. Opens include `src/app/services/confirm-dialog.service.ts:26`, `src/app/components/admin-users/admin-users.component.ts:69`, `src/app/components/admin-photo-albums/admin-photo-albums.component.ts:273` and `:374`, `src/app/components/admin-user-uploads/admin-user-uploads.component.ts:198` and `:269`, `src/app/components/calendar/calendar.component.ts:231`, `src/app/components/auth/auth.component.ts:142`.

### Navigation And Icons

- Super admins get an Admin button in the desktop nav (`src/app/components/navbar-links/navbar-links.component.html:32-40`) and in the mobile menu (`:61-69`), both gated on `isSuperUser`.
- The logo already routes super admins to admin and toggles back: `src/app/app.component.ts:87-89` calling `src/app/services/routing.service.ts:98-106`. The logo itself is a bare `<img>` with a click handler, `src/app/app.component.html:7`, with no role, tabindex, or key handler.
- Close icons rely on global icon typography only, `src/styles.scss:38-54`; no centering rule exists. 14 templates render a `close` icon.

## Goals

1. One canonical Family concept in UI, code, and database, with the duplicate collection removed and the dev data migrated without loss.
2. Shared chrome that reads as part of the card system: one rounded page-title bar shape and one owned gap below it, across all 19 pages.
3. Consistent, testable calendar surfaces: semantically coloured event tags that do not clip, a picker that dismisses, equalised vertical rhythm, and a print dialog that breathes.
4. Media surfaces that match the stored square thumbnails, and an audio transport that looks and behaves the same in Chrome, Firefox, and Safari.
5. Admin reachable only through the logo for super admins, with a keyboard-accessible control.
6. Role badges that encode privilege with the Material container/on-container pattern instead of a broken fallback hex.
7. Conditional writes that commit on a cold Cloud Functions instance, so an upload that reaches S3 can always be saved and Retry actually finishes the save.

## User Stories

1. As a visitor, I want one consistent word for family groups, so that the site never tells me my relatives are in a clan.
2. As a super admin, I want the Families page to list the same families the People filter offers, so that I can trust the admin page.
3. As a super admin, I want to add a family on the admin page and see it in the People filter immediately, so that I do not have to edit the database.
4. As a super admin importing a CSV, I want new family names to appear on the Families page, so that import and admin agree.
5. As a person browsing a bookmark, I want an old link that filters by family to still work after the rename, so that shared links do not break.
6. As a user of any page, I want the page title bar to look like a card that belongs to the page, so that the chrome stops looking stitched on.
7. As a user of any page, I want the same space between the title bar and the content on every page, so that the rhythm is predictable.
8. As a user of the calendar, I want birthdays blue and anniversaries red, so that I can tell event types apart at a glance.
9. As a user of the calendar, I want event tags to sit slightly inside the day cell, so that they read as chips rather than clipped bars.
10. As a user of the calendar, I want the month picker to close when I click elsewhere or press Escape, so that I am not trapped in it.
11. As a user of the calendar, I want equal space above the month nav row and below the grid, so that the page feels balanced.
12. As a user printing the calendar, I want a roomy dialog with an obvious print action, so that the dialog is not a cramped grey corner.
13. As a reader of the people page, I want hovering a name to underline it without a grey block, so that the affordance points at the thing I can click.
14. As a reader of a person modal, I want deceased people to show a death date when we know it, so that the record is complete.
15. As a reader of a person modal, I want no Contact card for a deceased person, so that the modal does not invite me to contact someone who has died.
16. As a reader of the media library, I want square thumbnails with no rounded corners, so that image content is not shaved.
17. As a super admin uploading a video, I want the thumbnail preview to be square, so that I see what the app will actually store.
18. As a listener, I want the audio play bar to look and work the same in any browser, so that playback is not a browser lottery.
19. As a super admin, I want the Admin entry out of the navigation, so that the nav stays about family content.
20. As a super admin, I want to reach admin by clicking the logo, so that the entry point is hidden from ordinary members.
21. As a keyboard user who is a super admin, I want the logo to be focusable and announced as admin navigation, so that I am not locked out of admin.
22. As a super admin uploading media, I want the upload page organised into clear groups with one obvious action, so that I do not hunt through a wall of fields.
23. As a super admin managing photo albums, I want four or five albums per row on a large screen, so that I can scan the library instead of scrolling it.
24. As a super admin reading the Users table, I want role badges whose colours mean something, so that I can distinguish Member, Admin, and Super at a glance.
25. As a super admin, I want the role colours to be legible against their own backgrounds, so that a badge is not a contrast failure.
26. As any user, I want the close icon to look centred in its button, so that the modal does not look misaligned.
27. As a super admin uploading media, I want the save step to succeed on the first attempt, so that uploaded bytes never strand without a record.
28. As a super admin whose upload already finished, I want Retry to complete the save, so that I do not have to re-upload the file.
29. As a super admin, I want the failure band to state the server's reason, so that I can tell a duplicate or stale upload from a transient failure.

## Non-Goals

- No change to the green application bar, its height, `--header-height` (`src/styles.scss:96`), or the admin shell height math (`src/app/components/admin/admin.component.scss:5`, `:209`).
- No change to `lineage` as a concept, field, or tree rendering, beyond the Family/Clan rename touching shared identifiers.
- No new admin role, no change to role grants, audit, or the last-super rule.
- No redesign of the People page tree structure, the photo viewer, or the media explorer layout outside the items listed.
- No changes to production data in this batch. Production migration is out of scope; only `lecoursville-dev` is migrated, and only by the owner.
- No dependency additions. Custom audio controls use native media APIs and existing Material components only.
- No change to S3 keys, presign headers, object verification, multipart handling, or the emulator media sink. The save fix is confined to RTDB conditional writes and error reporting.
- No change to the upload forms' layout, field validation, or success copy. Only the finalize failure band gains a reason line.

## Prerequisites

- Java for the emulator suite: `export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`.
- Working tree must be clean of unrelated edits before the branch is cut. Four files currently carry uncommitted changes and stay out of this branch: `functions/package.json`, `functions/package-lock.json`, `docs/discovery/DISCOVERY.md`, `docs/specs/2026-10-22_MediaUploadPipeline.md`.
- Owner credentials for `firebase database:get` against `lecoursville-dev`, and authorization to run the migration script. Agents never touch a real project; see AGENTS.md:61.
- The owner's CSV export must tolerate a missing `Died` column. If the column is absent, the import proceeds and every person has no death date.

## Design Principles

1. Fix the shared primitive, not the nine copies. Toolbar shape, gap, colours, and dialog padding live in `src/styles.scss` or the shared component, never in a page stylesheet.
2. Tokens over literals. New colours are declared as tokens in the `src/styles.scss:66-97` block; no new hardcoded hex in component files, and no fallback hex behind an undeclared token.
3. One collection, one writer. After this batch, nothing reads or writes the `clans` node except the migration script and the legacy alias reader.
4. Colour carries meaning consistently. Green is the brand, honey is warning/pending, red is error/destructive, indigo is management, purple is elevated privilege.
5. Additive migration first, destructive cleanup second, with an export before either.
6. Keep the contract docs true. Any changed shape updates `design_specs/2026-10-22_admin_consistency_contract.md` and the discovery index in the same commit.

## Backend Requirements

### Data Model

`Person` gains an optional death date, mirroring `anniversaryDate`:

```ts
// src/app/models/person.ts
deathDate: PersonDate | null; // optional in stored data; absent means unknown
```

- `PersonDate` stays as declared at `src/app/models/person.ts:3-7`.
- `Person.clanId` is renamed to `familyId: string | null` at `src/app/models/person.ts:30`. During the cutover both keys may exist on stored records; application code reads `familyId` only.
- `src/app/models/clan.ts` is deleted. `src/app/models/family.ts` remains as the single model.
- `src/app/services/clan.service.ts` and `src/app/services/clan.service.spec.ts` are deleted.

### Service Surface

`FamilyService` becomes the only reader and writer:

- Keep `families$`, `getFamilies()`, `getFamily(id)`, `createPushId()`, `saveFamily()`, `updateFamily()`, `deleteFamily()` as implemented at `src/app/services/family.service.ts:10-41`.
- Add `resolveFamilyIdByName(name: string): string | undefined` behaviour by exposing the in-memory list, so the importer can resolve and auto-create without a second service. Keep the resolution logic in one place and reuse the existing `clansByNameMap` approach from `src/app/components/admin-people-import/admin-people-import.component.ts:258`.
- Every consumer currently injecting `ClanService` injects `FamilyService`: `src/app/components/people/people.component.ts:64`, `src/app/components/contacts/contacts.component.ts:34`, `src/app/services/contacts-from-people.service.ts:8`, `src/app/components/person-detail-modal/person-detail-modal.component.ts`, `src/app/components/admin-people-import/admin-people-import.component.ts:4`, and `src/app/services/calendar.service.ts`.
- Identifier renames, all mechanical and covered by the compiler: `getClanForPerson`, `getClanByName`, `navigateToClan`, `clansByIdMap`, `clansByNameMap`, `clanColorHex`, `selectedClan`, `onClanChange`, `clearClanFilter`, `FamilyGroup.clan`, `CardContact.clan`, `resolveClanId`, `pendingClans`, `getFamilyColorForClan`, `NavigateToAdminClans` (`src/app/services/routing.service.ts:145`).
- Template and CSS hooks named for clan are renamed for family, including the `--family-color` custom property already used by the people page.

### CSV Import

- The importer parses an optional `Died` column with the same helper used for birthdays (`src/app/components/admin-people-import/admin-people-import.component.ts:175-176`), producing `deathDate` or null.
- A missing `Died` column is not an error, does not warn, and does not block the import. An unparseable date in a present column is a row-level warning, matching the birthday path.
- Import auto-creates missing families through `FamilyService`, writing `familyId` on each person (`:214`), never `clanId`.
- Validation: a death date earlier than the birthday is a row warning, and the row still imports with `deathDate` set, because the source may be authoritative about death even when the birth year is wrong. Record the choice in the import summary.

### URL State

- People and Contacts write `?family=` and read `?family=` first, then fall back to `?clan=` for one release (`src/app/components/people/people.component.ts:74-77`, `:165-171`; `src/app/components/contacts/contacts.component.ts:46`, `:188`).
- The fallback is read-only. Any interaction rewrites the URL with `family`, so links self-heal.
- A code comment at both read sites states the alias is scheduled for deletion, so the next reader removes it rather than extending it.

### Migration Transform (unit-tested)

The data move is a pure function plus a thin runner, so it can be proven without a live database.

- Pure module: `functions/src/maintenance/clan-to-family.ts`, exporting `mergeFamilyNodes(clans, families, people)` returning `{ families, people, conflicts, stats }`.
- Rules of the transform:
  - Match by exact `name`; when a name exists in both, keep the `clans` record id and the `clans` hex colour, and record a conflict entry when the colours differ.
  - Families present only in `families` are kept unchanged.
  - Every person gains `familyId` equal to their old `clanId`, remapped through the merge id map.
  - The transform never deletes `clanId`, never deletes the `clans` node, and is idempotent: running it twice produces the same output.
  - Output is deterministic: stable ordering by `sortOrder` then `name`, so a dry run diffs cleanly.
- Runner: `scripts/migrations/clan-to-family.mjs`, using the admin SDK pattern already proven in `scripts/e2e/seed.mjs:16-23` (resolve `firebase-admin` from `functions/node_modules`, `initializeApp({ databaseURL })`).
  - Flags: `--project lecoursville-dev`, `--dry-run` (default), `--apply`, `--delete-legacy`, `--export <path>`.
  - `--dry-run` prints node counts, the merge table, conflicts, and the number of people gaining `familyId`; writes nothing.
  - `--apply` writes `families` and `people/*/familyId` only.
  - `--delete-legacy` is the only path that removes `people/*/clanId` and the `clans` node, and it refuses to run unless `--apply` already completed in this invocation and the post-checks pass.
  - Post-checks before any delete: every person that had `clanId` now has `familyId` pointing at an existing family, and no two families share a name.
  - The runner closes the database connection so the process exits (`scripts/e2e/seed.mjs:515` pattern).

### Rules

- Keep both node rules during the cutover; remove the `clans` block (`database.rules.json:169-171`) only in the cleanup step.
- Add a dated snapshot pair under `database-rules/` before touching rules, following `database-rules/README.md:4-24`: the console export as `before.json` and the post-change `database.rules.json` as `after.json` with its sha256.
- No Functions trigger or storage path references `clans`; verified by `functions/src/account-created.ts:32` (`/users/{uid}`), `functions/src/admin-alert-created.ts:24` (`/adminAlerts/{alertId}`), and `functions/src/sweep-media-uploads.ts:131` (scheduler). No trigger migration is required.

### Concurrency And Cutover Window

- Run the additive migration, deploy, then re-run the same idempotent script with `--apply` to catch records written by the old code during the deploy window.
- Cleanup (`--delete-legacy`) happens only after the owner confirms dev is healthy, and rules removal follows the data removal.
- The admin Families page is live during the migration; do not edit families in the admin UI while the script runs.

### Conditional Writes (compareAndSet)

- Fix `functions/src/helpers.ts:130-148`. The production branch must guarantee that the mutator's first invocation sees the value at `ref`, not an empty local cache.
- Extend the `DataRef<T>` type at `:111-117` with `on("value", callback)` and `off("value", callback)`, matching the Admin SDK Reference methods. Keep the narrowed type so tests can still pass fakes.
- Extend `FakeRef` in `functions/src/test-support.ts:126-175` with `on("value", cb)` that invokes `cb` with a snapshot of `db.read(this.path)` and returns `cb`, and `off("value", cb)` as a no-op. Keep the existing `transaction` implementation. Add no-op `on`/`off` to the inline `brokenRef` at `functions/src/helpers.spec.ts:192-202` so the emulator case still typechecks.
- Production branch shape, in this order:
  1. Define the callback, attach one `value` listener, and hold it open.
  2. Await the first callback, so the sync-tree cache for the path is complete.
  3. Call `ref.transaction(mutate)` while the listener is still attached.
  4. Detach with `ref.off("value", callback)` in `finally` on commit, abort, and throw.
- Do not treat the return value of `on` as an unsubscribe function. The Admin SDK returns the callback, not a detach function.
- The priming callback resolves once and ignores later snapshots. It never writes.
- Keep the emulator branch (`:134-141`) exactly as is. Do not attach the listener there.
- No caller changes. All seven call sites inherit the fix, including the finalize claim at `functions/src/finalize-media-upload.ts:312`.
- Behavior contract:
  - Existing node: the mutator receives the node value on its first call, `committed` reflects the server outcome, and the written value is the mutator's output.
  - Missing node: the listener delivers `null`, the mutator returns `undefined`, `committed` is false, and nothing is written.
  - Concurrent change between prime and transaction: the transaction retries with the server value, as today.
  - Throw inside the mutator or the transaction: the listener still detaches and the error propagates unchanged.
- Do not change `rateLimit` (`:192-209`) or add a second retry loop. The helper fix covers it.
- Keep the `Finalize already in progress.` throw (`functions/src/finalize-media-upload.ts:332-334`). After the fix it only fires on a real concurrent claim.

## Frontend And UI Requirements

### Page Title Bar (all 19 pages)

Applies to `src/app/components/shared/page-toolbar/page-toolbar.component.scss` and the containers that host it.

- The bar becomes a card surface: `background: var(--color-surface)`, `1px solid var(--color-border)`, `border-radius: var(--radius-card)`, `box-shadow: var(--shadow-card)`. The `border-bottom` hairline is removed.
- Height contract is unchanged: 64px desktop, 56px at 600px and below. `box-sizing: border-box` stays, and no vertical padding is added.
- Spacing contract: the host owns `margin-top: 16px` and `margin-bottom: 16px`. Horizontal inset comes from the page gutter, so the bar's left and right edges align with the cards below it: 32px inside admin (`.admin-content`) and 16px on feature pages (`.page-content`).
- To keep the admin top rhythm identical, `.admin-content` padding changes from `28px 32px` to `12px 32px` (`src/app/components/admin/admin.component.scss:204`), with the mobile steps at `:246` and `:252` reduced by the same 16px.
- Delete the per-page first-card `margin-top` values listed in Current State. `.admin-intro` keeps its own `margin: 0 0 16px` (`src/app/styles/admin-data.scss:10-16`) and sits inside the owned gap.
- Filter row: when an `.admin-filter-bar` immediately follows the toolbar, the two read as one unit. The toolbar then rounds only its top corners and the filter bar rounds only its bottom corners, with a single shared border and shadow. Implement with `.page-toolbar:has(+ .admin-filter-bar)` and a matching rule on `.admin-filter-bar`. Fallback when `:has` is unsupported: both surfaces take the full radius with an 8px gap.
- Do not touch the green `mat-toolbar`, `--header-height`, or the admin shell height calculations.
- Update `design_specs/2026-10-22_admin_consistency_contract.md` to describe the card surface and the shared gap, keeping the 64/56 height and no-filters-in-bar clauses intact.

### Calendar Event Tags

- Add semantic tokens to `src/styles.scss`: `--cal-birth-accent: #2b6cb0`, `--cal-anniv-accent: #c53030`, `--cal-tag-bg: #fafbfc`, `--cal-tag-ink: var(--color-ink)`.
- `.calendar-cell-event-container` uses `--cal-tag-bg`, keeps a 4px left border, and gains `margin-inline: 4px` with `width: auto` so it does not overflow the cell.
- `.border-birth` and `.birthday-color` use `--cal-birth-accent`; `.border-anniv` and `.anniversary-color` use `--cal-anniv-accent`.
- Event titles keep `--color-ink`; hover keeps the brand colour and underline.
- Not-living opacity stays at 0.55.

### Calendar Month Picker Dismissal

- Clicking outside the pill and the panel closes the picker.
- Escape closes the picker and returns focus to the month/year pill.
- Clicking the pill toggles as today, and selecting a month still closes it.
- Implement one shared dismissal mechanism (document listener with `stopPropagation` on the pill and panel, or a small reusable directive) so later dropdowns reuse it. Do not add a calendar-only global listener without a comment pointing at the shared one.
- Focus-visible styling for the pill must remain, since it becomes a real toggle control.

### Calendar Rhythm

- `.calendar-nav-row` gains `margin-top: 24px` desktop and `16px` at 600px and below, matching the space below the grid.
- The picker panel offset (`margin: 0 0 10px` at `src/app/components/calendar/calendar.component.scss:152`) is unchanged.

### Print Calendar Dialog

- Global dialog scale in `src/styles.scss`: set `mat.dialog-overrides(container-shape)` to `var(--radius-card)` and add shared rules for `.mat-mdc-dialog-content` and `.mat-mdc-dialog-title` padding so every dialog gets 32px horizontal and 24px vertical breathing room at desktop, 20px at 600px and below.
- Printer-specific spacing then drops to zero duplication: `.calendar-printer-container` padding is removed or reduced to a single 8px vertical adjustment, header and body padding go to zero, and the surface relies on the shared scale.
- The action row uses the primary treatment: brand fill, white label, `--radius-control`, 40px height, hover and active states matching `.calendar-print-button` (`src/app/components/calendar/calendar.component.scss:37-66`). Implement as `mat-flat-button` with the existing class name preserved for tests, or a shared `.btn-primary` recipe if one is added.

### People Surfaces

- `.tree-row` loses the hover fill and its `background-color` transition; the name underline remains the only affordance.
- `.lineage-person-row` loses the hover fill and gains the same underline-on-hover treatment applied to its name, matching the tree.
- Admin data tables keep their row hover; do not sweep `admin-*` styles.

### Person Modal: Deceased Behaviour

- The Contact card condition requires `person.isLiving !== false` in addition to the existing data checks (`src/app/components/person-detail-modal/person-detail-modal.component.html:63`).
- Add a `Died` row immediately after the `Birthday` row, rendered only when `person.deathDate` is present with a non-zero year. Absent or zero-year means the row does not render at all, with no placeholder and no empty row.
- The date renders through the existing `formatDate` helper and links to the calendar the same way the birthday does, or as plain text if the calendar cannot represent a death event. Choose plain text if linking would imply a celebration.
- `calculateAge()` becomes death-aware: when `deathDate` is present, compute age at death; otherwise compute against today. The rendered label reads the same `(N)` in both cases.
- `isLiving === false` is the only deceased test; do not treat missing `isLiving` as deceased.

### Media Thumbnails

- Remove `border-radius` from all four thumbnail rules in `src/app/components/media-list/media-list.component.scss:83`, `:100`, `:147`, `:161`. Keep `object-fit: cover` and the 1:1 frame.
- The `.media-list-item` card keeps its own radius.
- Admin upload previews: `.media-thumbnail-preview` becomes `aspect-ratio: 1 / 1` and loses `border-radius`; `.media-cover-preview` loses `border-radius` and keeps 1:1.
- Verify against a real stored icon before finalising the crop, so the preview shows the same crop the library shows.

### Audio Play Bar

Replace the native transport with a component-owned one, keeping a real media element underneath.

- Markup: `<audio #mediaElement class="audio-player-element" [src]="..." preload="metadata">` with no `controls` attribute, plus a visible control bar: play/pause button, seek slider, elapsed and total time, and a volume control with mute toggle.
- Keep the element class name and `src` semantics, because `e2e/specs/media.spec.ts:364-376` asserts `.audio-player-element` and drives playback through it.
- Control bar styling uses tokens: surface card, `--radius-control` buttons, brand fill for the primary play button, `--color-ink-2` for time text.
- Behaviour:
  - Play/pause toggles the media element; `timeupdate`, `loadedmetadata`, `ended`, and `volumechange` drive the UI.
  - Clicking a track in the list loads and plays it, preserving current `selectTrack` behaviour (`src/app/components/audio-player/audio-player.component.ts:45-56`).
  - Track end advances to the next track in the list; the last track stops and resets to paused at the end.
  - Autoplay blocked by the browser leaves the player paused with no console error and no thrown promise.
  - Seek slider is a native `<input type="range">` bound to `currentTime`, with `aria-label` and `aria-valuetext`.
  - Keyboard: space toggles play/pause when the play button has focus, arrow keys seek on the range, and all controls are reachable in DOM order with visible focus.
  - Volume persists in component state only; no storage write.
- Accessibility: play/pause button has `aria-pressed`; the seek control exposes minute:second text; the track list buttons keep their current structure and add `aria-current` on the active track.
- No `prefers-color-scheme` dependency: the bar renders from tokens, so OS dark mode cannot change it.

### Admin Media Upload Page

Restructure both panels into one grouped layout with a sticky action bar.

- Remove the tab band as the organising idea. The page keeps a single section switch rendered as a segmented control above the content: `Video` and `Audio Album`, preserving both existing routes of data and the current component boundaries.
- Grouping per panel, in this order:
  1. `File`: dropzone, selected-file name, replace-file control for editing.
  2. `Details`: title, date, and for audio the folder name and per-track rows.
  3. `Artwork`: video thumbnail preview and frame scrubber, or audio cover preview and its source.
  4. `Advanced` (collapsed by default, `<details>` styled as a card row): storage name, S3 path preview with provisional flag, duration override, sticky and hidden flags, own-zip option.
  5. Sticky action bar: primary `Upload` or `Save changes`, secondary `Cancel`, right aligned, visible while the form is scrolled.
- Every existing `data-testid` is preserved: `video-file-input`, `video-path-preview`, `video-thumbnail-preview`, `video-thumbnail-input`, `album-cover-preview`, `album-cover-source`. The specs at `e2e/specs/media.spec.ts:81-85` and `:699-700` depend on them.
- Field-level requirements unchanged: required fields, validation messages, and upload progress messaging keep their current copy.
- The success and error bands move directly under the sticky bar as a single stack, reusing `.admin-error` (`src/app/styles/admin-data.scss:33-41`) and the success variant.
- Responsive: single column at 600px and below, sticky bar collapses to full-width buttons.

### Media Save Error Reporting

- Add `detail?: string | null` to `MediaUploadError` (`src/app/services/media-upload.service.ts:192-201`) as a fourth optional constructor argument.
- `mapMediaError` (`:217-249`) populates `detail` from the raw error message (`errorText(error)`) when that string is non-empty and differs from the user-facing `message`. Do not change any existing `message`, `code`, or `ticket` mapping.
- `finalize()` (`:488-503`) and `retryFinalize()` (`:505-517`) already route through `mapMediaError`; no extra plumbing.
- Both components add a `finalizeReason: string | null` field, set from `error.detail` in every finalize catch: video `:295-302`, `:333-335`, and `:368-376`; audio `:424-429`, `:462-465`, and `:513-516`. Clear it when the form resets and before starting a new upload.
- Render the reason inside the existing `role="alert"` band so it is announced once. After the primary sentence, render `<div class="admin-error-reason" data-testid="video-finalize-reason">Reason: {{ finalizeReason }}</div>` and the audio equivalent with `data-testid="album-finalize-reason"`. Render only when non-null.
- Keep the existing `FINALIZE_FAILURE` sentence unchanged. It stays the primary line, and the current e2e assertions keep passing.
- Trim the reason, cap it at 300 characters, and render through normal Angular interpolation. Never render a stack, HTML, or a raw ticket.
- Log once per caught finalize failure with an app-owned prefix: `console.error("[media-finalize] Save failed", { batchId, reason })`. Never log metadata, signed URLs, or file contents.
- Allowlist the prefix in `e2e/helpers/console.ts:27-32` beside the existing entries, with a comment that the forced-finalize failure tests exercise a handled path while unexpected errors remain visible.

### Admin Photo Albums Grid

- Density ladder on `.admin-album-grid`: `repeat(5, minmax(0, 1fr))` at 1600px and up, `repeat(4, ...)` from 1200px, `repeat(3, ...)` from 992px, `repeat(2, ...)` from 600px, one column below 600px.
- Cover aspect ratio becomes `4 / 3` instead of `1 / 1`, so cards get shorter as they get narrower; keep `object-fit: cover`.
- Card chrome reduces so it does not compete at the new size: keep the surface, radius, and border, drop the shadow, and tighten the content padding.
- Apply the same density logic to the in-album photo grid (`.admin-photo-grid`, `src/app/components/admin-photo-albums/admin-photo-albums.component.scss:253`) so list and contents agree on scale.
- The skeleton grid follows the same column ladder so loading matches layout.

### Role Badges

- Add tokens to `src/styles.scss`: `--role-member-bg: #ECEFF1`, `--role-member-fg: #37474F`, `--role-admin-bg: #E8EAF6`, `--role-admin-fg: #283593`, `--role-super-bg: #F3E5F5`, `--role-super-fg: #6A1B9A`.
- `.role-badge` uses the member tokens by default; `.role-badge-admin` uses the admin pair; `.role-badge-super` uses the super pair, replacing the error red.
- Delete the `--color-accent-soft` reference entirely rather than defining it; the token never existed and the fallback is the bug.
- Keep the pill radius, the 0.7rem/600 label, and the role text. Colour stays redundant encoding.
- Minimum contrast 4.5:1 for each pair against the badge background. The proposed pairs measure 9.9:1, 7.7:1, and 8.6:1 respectively; re-measure after any adjustment.
- The role history table (`roleSummary`, `src/app/components/admin-users/admin-users.component.ts:164`) stays plain text; do not add badges there in this batch.

### Admin Entry And Logo

- Delete the desktop Admin button (`src/app/components/navbar-links/navbar-links.component.html:32-40`) and the mobile menu Admin item (`:61-69`).
- Convert the logo to a real control: a `<button type="button" class="toolbar-logo">` wrapping the existing image, wired to the existing `onLogoClick()` (`src/app/app.component.ts:87`), with `aria-label` of `Admin` for super admins and `Home` otherwise, and the existing `alt` text retained on the image.
- Add a visible focus ring matching the app's focus treatment, and ensure the hit target is at least 44px.
- Non-super users keep today's behaviour: clicking the logo goes to the promoted route.
- The admin sidebar keeps its own navigation; only the top toolbar loses the entry.

### Close Icon Centering

- Add one global rule rather than per-component fixes: `.mat-mdc-icon-button .mat-icon` centring via flex on the button's icon slot, with `line-height: 1` retained.
- Measure the rendered offset first in a browser at 24px glyph size inside a 40px button; if a glyph-specific nudge is still required after flex centring, apply it globally with a comment naming the glyph, not per page.
- The fix must hold for all 14 render sites, including the person modal at `src/app/components/person-detail-modal/person-detail-modal.component.html:14`.

## Production Risks And Mitigations

- Risk: the migration overwrites families an admin created on the Families page. Mitigation: merge by name, keep `families`-only records, dry run first, and report conflicts instead of resolving them silently.
- Risk: old code writes `clanId` during the deploy window, so a record exists with neither key or a stale one. Mitigation: additive first, rerun the idempotent apply after deploy, verify before cleanup.
- Risk: a person references a clan id that does not exist in `clans`. Mitigation: the runner reports orphans and refuses `--delete-legacy` while any exist.
- Risk: rules removal outpaces data removal and the app loses read access mid-flight. Mitigation: rules removal is the last step, after verification, with a dated snapshot pair.
- Risk: toolbar card changes break the admin consistency assertions. Mitigation: heights stay 64/56 and filters stay out of the bar; only surface and gap change.
- Risk: `:has` unsupported in an older engine silently drops the toolbar/filter-bar join. Mitigation: documented fallback with full radius plus 8px gap, and an e2e assertion on the computed radius of the joined unit.
- Risk: the custom audio transport regresses playback that autoplay-policy tests rely on. Mitigation: keep the native element and its class, and assert `currentTime` advance as today.
- Risk: a shared dialog padding scale makes one dialog overflow on mobile. Mitigation: clamp horizontal padding to the dialog's own `maxWidth` and verify all eight dialogs at 360px width.
- Risk: the import breaks when `Died` is missing. Mitigation: explicit test for absent, empty, and malformed columns.
- Risk: priming adds a listener and a wait to every conditional write. Mitigation: one listener per call, detached in `finally`, covered by commit, abort, and throw tests; the transaction already waits on the server.
- Risk: the priming listener never fires when the database is unreachable, so the call hangs. Mitigation: the function timeout already bounds the call, and the transaction would hang on the same unreachable database; no new failure mode.
- Risk: the emulator branch keeps hiding production behavior. Mitigation: the helper test reproduces the cold-cache null call, and the owner runs one real dev upload after the batch deploys.
- Risk: the reason line leaks server internals. Mitigation: admin-only surfaces, server-authored strings only, 300-character cap, interpolation only.
- Risk: the diagnostic log breaks the console-error gate. Mitigation: app-owned prefix in the documented allowlist, with the forced-failure specs asserting the line.
- Risk: the helper change silently alters recovery behavior. Mitigation: existing recovery specs stay green, and `helpers.spec.ts` gains explicit missing-node and committed-path cases.

## Rollout Plan

1. Cut `fine-tuning-2026-10-25` from `master` at `6f3f9266`; leave the four unrelated working-tree edits out.
2. First commit, F-20261025-21: the `compareAndSet` priming fix, the reason reporting, the console allowlist entry, and their tests. It is independent of every styling and Family change and can be reverted alone. Owner decision: deploy it with the batch, not as a separate dev deploy.
3. Land the styling and interaction findings as separate commits grouped by surface: toolbar chrome, calendar, people and person modal, media and audio, admin media upload, admin albums, role badges, navigation, icons.
4. Land the Family canonicalization as its own commit series inside the same branch: model and service rename, then importer and URL state, then migration transform plus spec, then seed collapse and e2e updates, then contract and discovery docs.
5. Run `npm run e2e:gate` locally until green; the gate builds the e2e bundle, runs unit tests, functions tests, the prod storage rules suite, and the browser matrix.
6. Merge to `master`.
7. Owner runs the additive migration against `lecoursville-dev`: dry run, review, apply, keep the export.
8. Deploy dev with `npm run deploy:dev`, which gates, builds the dev bundle, and deploys hosting, functions, database rules, and dev storage rules. Owner types `deploy` at the sign-off or sets `E2E_APPROVED=1`.
9. Owner re-tests dev, including one real video upload that must reach `finalized` with a `media` record, and a forced finalize failure that must show the reason line. Rerun the migration apply once to catch stragglers from the deploy window.
10. After owner sign-off, run the cleanup pass: `--delete-legacy`, remove the `clans` rules block with a dated snapshot, and deploy again.
11. Delete the legacy `?clan=` read alias in the following release, not this one.

## Test Plan

Seams: Vitest for pure logic, Playwright across Chromium, WebKit, and Firefox for visible behaviour, and a unit-tested pure migration transform. Import `test` from `e2e/helpers/fixture.ts` in every spec so console errors fail the test.

### Unit (Vitest, `src/app/**`)

- `src/app/components/person-detail-modal/person-detail-modal.component.spec.ts`
  - Deceased person with address data renders no Contact card.
  - Deceased person with a death date renders a `Died` row with the formatted date.
  - Deceased person without a death date renders no `Died` row and no empty placeholder.
  - Living person with contact data still renders the Contact card.
  - Age at death is computed from `deathDate`; living age still uses today.
  - `isLiving` undefined behaves as living.
- `src/app/components/admin-people-import/admin-people-import.component.spec.ts`
  - CSV with a `Died` column sets `deathDate`.
  - CSV without a `Died` column imports cleanly with `deathDate` null and no warning.
  - Malformed `Died` value produces a row warning and does not block the row.
  - Death before birth produces a row warning and still imports.
  - Import resolves existing family names and creates missing ones through `FamilyService`, writing `familyId`.
- `src/app/components/admin-users/admin-users.component.spec.ts`
  - Member, Admin, Super, and Admin plus Super render the expected badge classes.
  - Admin badge no longer references an undefined token, asserted through computed background colour.
- `src/app/components/audio-player/audio-player.component.spec.ts`
  - Play toggles the media element; pause toggles back.
  - `timeupdate` updates the elapsed label and slider position.
  - Selecting a track loads its src and plays.
  - Track end advances to the next track; last track resets to paused.
  - Autoplay rejection leaves the player paused without an unhandled rejection.
  - Seek input sets `currentTime`.
- `src/app/components/calendar/calendar.component.spec.ts`
  - Outside click closes the picker.
  - Escape closes the picker and returns focus to the pill.
  - Selecting a month still closes the picker.
  - Pill click toggles open and closed.
- `src/app/services/family.service.spec.ts`
  - CRUD round trips on the `families` path.
  - Name resolution finds an existing family and reports a missing name.
- `src/app/components/admin-media-upload-video/admin-media-upload-video.component.spec.ts`
  - A finalize rejection with `detail` renders the existing copy plus `Reason: <detail>`.
  - A retry finalize rejection renders the reason again.
  - A rejection with no `detail` renders no reason line.
  - The finalize failure is logged once with the `[media-finalize]` prefix.
- `src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component.spec.ts`
  - Same four cases on the album error band.
- `src/app/services/media-upload.service.spec.ts`
  - `mapMediaError` keeps the mapped `message` while setting `detail` from the raw server message.
  - `detail` is null when the raw message is empty or equals the mapped message.

### Unit (Vitest, `functions/src`)

- `functions/src/maintenance/clan-to-family.spec.ts`
  - Merge with an empty `families` node copies every clan, preserving ids.
  - Overlapping names keep the clan record and record a colour conflict.
  - Families-only records survive untouched.
  - Every person gains `familyId` mapped from `clanId`.
  - Idempotent: running the transform on its own output changes nothing.
  - Deterministic ordering by `sortOrder` then `name`.
  - Orphan `clanId` values are reported and not silently dropped.
- `functions/src/helpers.spec.ts`
  - Cold-cache regression: a fake ref whose `transaction` calls the mutator with `null` unless a listener delivered a value. The fixed helper primes the listener, the mutator receives `{status:"ticketed"}`, and the write commits. The test fails against the current helper, which reports `committed: false`.
  - Genuinely missing node: the listener delivers `null`, the mutator returns `undefined`, `committed` is false, and nothing is written.
  - The priming listener detaches on commit, on abort, and when the mutator throws.
  - Existing rate-limit and recovery cases stay green with the added `on`/`off` fake surface.

### E2E

- `e2e/specs/calendar.spec.ts`
  - Birth tags compute the blue accent and anniversary tags compute the red accent.
  - Tag left edge is inset from the cell edge by 4px.
  - Picker opens on pill click, closes on outside click, closes on Escape with focus back on the pill.
  - Month nav row computed `margin-top` is 24px at desktop and 16px at 390px wide.
  - Print dialog: title visible, year buttons visible, primary action button computed background equals the brand token, dialog content has at least 24px padding.
- `e2e/specs/people.spec.ts`
  - Hovering a tree row leaves the row background unchanged and underlines the name.
  - Person modal for a seeded deceased person shows no Contact heading.
  - Person modal for a seeded deceased person with a death date shows the `Died` row.
  - Family filter still filters; `?family=Mignonne` applies the filter and `?clan=Mignonne` still applies it through the alias.
- `e2e/specs/media.spec.ts`
  - Media card thumbnail computes `border-radius: 0px`.
  - Video thumbnail preview computes a 1:1 aspect ratio and 0 radius.
  - Audio cover preview computes 0 radius.
  - Audio transport: play button starts playback, elapsed time advances, pause stops it.
  - Audio transport controls are keyboard reachable and announce state through `aria-pressed`.
  - In `retry finalize does not re-upload` (`:633`), the forced failure shows `video-finalize-reason` containing `forced failure`, and the retry still saves without re-uploading.
  - In `video resume after reload saves the typed metadata` (`:1083`), the forced failure shows the reason line before the reload.
- `e2e/specs/admin.spec.ts`
  - The toolbar renders no `nav-admin-link` on desktop or mobile for a super admin.
  - Clicking the logo as a super admin lands on `/admin/users`.
  - Clicking the logo as a staff admin lands on the promoted route.
  - The logo is focusable and reachable by keyboard.
- `e2e/specs/admin-consistency.spec.ts`
  - Title bar height assertions stay 64px and 56px.
  - Title bar computes a card radius and a border.
  - Gap between the title bar and the following content is 16px on every admin route.
  - No filters inside the title bar (existing assertion kept).
- `e2e/specs/admin-content.spec.ts`
  - Admin Families lists the same names the People filter offers, after the seed collapses to one node.
  - Album grid computes 5 columns at 1600px wide, 4 at 1280px, and 1 at 390px.
- `e2e/specs/admin-system.spec.ts`
  - Role badge computed colours match the token pairs for member, admin, super.
- `e2e/specs/nav.spec.ts`
  - Logged-in nav shows enabled features and never the Admin entry.
- `e2e/specs/rules.spec.ts`
  - Post-cleanup, reads and writes to `clans` are denied while `families` keeps admin-write and authenticated-read.

### Seed And Fixtures

- `scripts/e2e/seed.mjs`: remove the `clans` node from the root tree (`:258-265`, `:427-428`), keep `families`, and change every seeded person's `clanId` to `familyId` (`:225`, `:251`, `:253`).
- Add one seeded deceased person with a death date and one without, so both modal branches are covered without inventing data inside a test.

## Summary Of Changes

Sign-off checklist, one line per finding.

- [ ] F-01 Calendar event tags: blue for birthdays, red for anniversaries, one shade darker than the pre-facelift values, lighter tag fill.
- [ ] F-02 Calendar tags inset 4px from the day cell edge without overflowing.
- [ ] F-03 Month picker dismisses on outside click and Escape, focus returns to the pill.
- [ ] F-04 Calendar nav row top gap equal to the space below the grid.
- [ ] F-05 Shared dialog padding and shape scale, printer dialog no longer cramped.
- [ ] F-06 Print dialog action button uses the primary brand treatment.
- [ ] F-07 People tree and lineage rows: no grey hover fill, name underline only.
- [ ] F-08 Withdrawn: green app bar untouched.
- [ ] F-09 Deceased person: no Contact card, `Died` row when known, hidden when unknown, age at death.
- [ ] F-10 Close icon centred through one global rule.
- [ ] F-11 Custom audio transport, identical across browsers, dark-mode safe.
- [ ] F-12 Media card thumbnails square, no radius, cover crop retained.
- [ ] F-13 Admin entry removed from nav; logo is the keyboard-accessible admin entry for super admins.
- [ ] F-14 Admin media upload reorganised into grouped sections with a sticky action bar and an Advanced disclosure.
- [ ] F-15 Album grid density ladder up to five columns with a 4:3 cover.
- [ ] F-16 Page title bar is a rounded card inset on all four sides, with one shared 16px gap below, on all 19 pages.
- [ ] F-17 Role badges use Material container pairs; the undefined token reference is gone.
- [ ] F-18 Admin Families page and the People filter read the same collection.
- [ ] F-19 Family is canonical in UI, code, and data; clan removed; `?clan=` kept as a read-only alias for one release.
- [ ] F-20 Video thumbnail preview is 1:1 and square, matching stored thumbnails.
- [ ] F-21 Conditional writes commit on a cold Functions instance: `compareAndSet` primes the path cache and holds a listener across the transaction, so the finalize claim, metadata save, and recovery locks reach the server.
- [ ] Finalize failure bands show `Reason: <server message>` and log `[media-finalize]` once.
- [ ] Helper regression test reproduces the SDK's cold-cache null call and passes only with the fix.
- [ ] Migration script with dry run, apply, cleanup, export, and post-checks.
- [ ] Contract doc and discovery index updated for the toolbar shape and the Family decision.

## Verification Steps

1. `npm run e2e:gate` is green. It builds the e2e bundle, runs unit tests, functions tests, the storage-prod rules suite, and the Chromium, WebKit, and Firefox projects.
2. The new cold-cache case in `functions/src/helpers.spec.ts` fails against the pre-fix helper and passes after it; existing rate-limit and recovery tests stay green.
3. `git grep -n "clan" -- src functions scripts e2e` returns only the migration module, the legacy alias reader, the legacy rules snapshot history, and comments that state the alias is temporary.
4. `git grep -n "color-accent-soft"` returns nothing.
5. In a browser at 1280px wide: every page title bar has a card radius, a 16px gap below it, and aligns with the cards underneath; the gap is identical on all nine admin routes and on a feature page.
6. In a browser at 1600px wide: the album grid shows five columns; at 390px it shows one.
7. In Firefox with OS dark mode: the audio bar looks identical to Chrome, controls respond, and no native dark transport appears.
8. Owner runs the migration dry run against `lecoursville-dev`, reviews the merge table and conflicts, applies it, keeps the export, and confirms the admin Families page count matches the People filter options.
9. After the dev deploy, the owner uploads one real video: the batch reaches `finalized`, a `media` record exists, and no `Finalize already in progress.` reason appears. A deliberately forced finalize failure shows the reason line without a page error.
10. Owner re-tests every finding, then approves the cleanup pass.

## Open Questions

None. All decisions resolved on 2026-10-25: branch base clean master, custom audio transport, optional `deathDate` with a tolerant `Died` column, all 19 pages for the toolbar, green bar untouched, grouped media upload page with sticky actions, five-step album density ladder, cover-crop thumbnails, indigo and purple role palette, shared dialog scale, nav row top gap, one-release `?clan=` alias, and an owner-run migration script with unit-tested transform. F-20261025-21 is resolved as the primed-cache `compareAndSet`, a visible server reason, and a first commit that deploys with the batch.
