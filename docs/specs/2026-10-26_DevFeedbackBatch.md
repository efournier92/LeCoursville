# Spec: Dev Feedback Batch 2026-10-26

- Source: `docs/critique/2026-10-26_DevFeedback.md` (F-20261026-01 to F-20261026-13, DC-20261026-01 to DC-20261026-05)
- Redteam: `docs/critique/2026-10-26_DevFeedbackBatch.md` (C-20261026-01 to C-20261026-32)
- Branch: `2026-10-26_DevFeedback`, cut from `master` at `c033a3df`
- Status: revised after redteam, ready to implement
- Gate: `npm run e2e:gate`

## Goal

One batch of thirteen owner-reported fixes across the calendar, audio transport, public upload, admin surfaces, account page, and shared top bars. Every user-visible change ships with e2e coverage in the same commit. No data migration runs from this branch; the owner runs it after merge per DC-20261026-03.

## Contracts

1. Surfaces. Content sheets are cards: `--color-surface`, `1px solid --color-border`, `--radius-card`, `--shadow-card`. Shared classes `.surface-card` (user-facing) and `.admin-surface` (admin) are the only surfaces.
2. Spacing. Stacked admin cards sit 16px apart through one shared rule. Pages do not add their own card gaps.
3. Colour families. Brand green `--color-brand-primary` marks primary actions and brand chrome; `--color-accent-strong` marks recovery and caution; neutrals carry transport chrome. Radius families: 999px is reserved for segmented and sort controls, 8px for content chips, icon buttons, and small tiles. No new hex literals outside the token block.
4. Top bars. No top bar clips or scrolls horizontally at any width. Bars wrap and grow taller (DC-20261026-05).
5. Voice. User-facing empty states speak about what was found, never about what has not been uploaded. Admin empty states keep operational language.
6. Determinism. No `test.skip`, no sleeps, `retries` 0, console collector from `e2e/helpers/fixture.ts`.
7. Fixtures. New e2e state comes from `scripts/e2e/seed.mjs`, never hand-edited nodes and never throwaway writes that other tests can observe.

## Work Items

### W1 Calendar picker row margins are equal, pinned absolutely (F-20261026-01)

- `src/app/components/calendar/calendar.component.scss:71`: `.calendar-nav-row { margin: 24px 0; }`.
- `:287` mobile override: replace `margin-top: 16px` with `margin: 16px 0`.
- The picker dropdown keeps `margin: 0 0 10px` (`:160`); it is a popover, not part of the row band.
- E2E in `e2e/specs/calendar.spec.ts`: keep the existing absolute pins (24px top at desktop) and add bottom at 24px; then `setViewportSize({width: 390, height: 844})`, re-open `/calendar`, assert top and bottom are both `16px`. Assert equality as a secondary check so a zeroed regression cannot pass.
- Done-check: computed top equals computed bottom at 1280 and 390, and both equal the pinned values.

### W2 Audio transport reads neutral, not green (F-20261026-02)

- Add two tokens to `src/styles.scss` beside `--color-ink`: `--color-control-strong: #232A32;` and `--color-control-strong-hover: #313942;` (hover is lighter by a step, not a jump).
- `src/app/components/audio-player/audio-player.component.scss`:
  - `:82` `.audio-player-toggle` background `var(--color-control-strong)`, glyph `var(--color-surface)`.
  - `:86` hover `var(--color-control-strong-hover)`.
  - `:99` and `:104` `accent-color: var(--color-ink-2)`.
  - `:143` active-track icon `var(--color-ink)`.
- Keep both sliders focus-visible and the 40px hit targets.
- Done-check: no `--color-brand-primary` in the file; rest-to-hover contrast change is perceptible but small; filled control is at least 3:1 on white.
- E2E `e2e/specs/media.spec.ts`: assert the toggle's computed background equals the `--color-control-strong` token value and that the seek slider's `accent-color` is not the brand green.

### W3 Public upload page becomes one white card (F-20261026-03, DC-20261026-04)

- Root in `public-upload.component.html:1` gains `page-ground page-content`.
- One `.surface-card` sheet wraps heading, form, file list, complete state, and error state. The sheet is `max-width: 680px; margin: 24px auto;` inside `.page-content`, so the narrow single-action form keeps its focus and does not become the widest card on the site.
- `.upload-container` (`public-upload.component.scss:3`) loses its own `max-width`/`padding` duties and becomes the sheet wrapper with the card's padding (24px, 16px on mobile).
- `.file-list` (`:119`) stops impersonating the card: it becomes an inset well (`--color-surface-muted`, `--radius-sm`, 12px).
- `.drop-zone` (`:23`): rest fill `--color-surface` with the dashed border; hover and `dragging` switch to `--color-surface-muted` plus brand border, so drag-over keeps a real affordance.
- Heading stays as the card's own title; no `app-page-toolbar`.
- E2E `e2e/specs/public-upload.spec.ts`: assert the card surface (background, border, radius, 680px cap) and that complete and error states stay inside it; assert the drag state's background differs from rest.

### W4 Admin cards share one 16px gap (F-20261026-04)

- Add to `src/app/styles/admin-data.scss`: `.admin-surface + .admin-surface { margin-top: 16px; }`.
- Delete the per-page gap duplicates: `admin-features.component.scss:3` (`margin-bottom: 24px`), and the values at `admin-recovery:99`, `admin-features:8` and `:19`, `admin-users:43`.
- Cards nested in a wrapper (for example `admin-calendars.component.html:5` `.form-section`) keep their wrapper spacing and are listed in the commit body as documented exceptions.
- The toolbar-plus-filter-bar join stays the only joined pair; its rules live in `src/styles.scss:390` and `:396`.
- E2E `e2e/specs/admin-consistency.spec.ts`: on `/admin/users` and `/admin/features`, measure the gap between adjacent `.admin-surface` cards and assert all are 16px.

### W5 Admin uploads queue actions and chips restyle (F-20261026-05)

- Geometry: 32px buttons at `--radius-sm`; chips move to `--radius-sm`; segmented and sort controls keep 999px.
- Colour model, stated once:
  - Enabled and still actionable: glyph carries its semantic colour at rest (approve `--color-brand-primary`, reject `--color-error`, preview `--color-ink-2`), no fill.
  - Hover and focus-visible: tinted fill (`rgba` of the semantic colour at 12%).
  - Disabled or already decided: glyph `--color-ink-3`, no fill, no tint on hover.
- Touch: the component's existing unconditional 44px state-layer (`:129-137`) already covers mobile; do not re-prescribe it, and do not shrink it while shrinking the visual button.
- Thumbnail (`:55`) drops `--radius-sm` to 0; status chip keeps its tint scale.
- E2E `e2e/specs/admin-system.spec.ts`: assert equal box sizes for the three buttons; on the seeded approved row assert no fill and an `--color-ink-3` glyph; on a seeded pending row (see W13 seed change) assert the green glyph at rest and a tinted hover.

### W6 Admin features page redesign (F-20261026-06)

- Promoted route: one labelled row using `admin-card-title` plus a supporting line, select aligned to the card's content inset. Delete the `padding: 0 1em` shim (`admin-features.component.scss:6`) and `margin-bottom: 24px` (`:3`).
- Flag rows: 32px icon tile on `--color-surface-muted` using `FeatureConfig.icon`, label `0.9375rem`/500 over route meta `0.75rem`/`--color-ink-2`, compact toggle right, changed label as a quiet chip at `--radius-sm`.
- Toggle sizing must override size AND travel tokens together, because Material derives travel from `--mat-slide-toggle-handle-width` (`width: calc(100% - handle-width)` then `translateX(100%)`). Prescribe exactly:
  - `--mat-slide-toggle-track-width: 36px`, `--mat-slide-toggle-track-height: 20px`;
  - `--mat-slide-toggle-handle-width: 18px` (travel math only: 36 − 18 = 18px of travel);
  - `--mat-slide-toggle-unselected-handle-size: 14px`, `--mat-slide-toggle-selected-handle-size: 14px`, `--mat-slide-toggle-pressed-handle-size: 14px`, `--mat-slide-toggle-with-icon-handle-size: 14px`;
  - `--mat-slide-toggle-unselected-handle-horizontal-margin: 0 2px`, `--mat-slide-toggle-selected-handle-horizontal-margin: 0 2px`, and both pressed margins `0 2px`;
  - delete the old handle-only pin at `:50`.
  - Arithmetic that must hold after the change: unselected thumb spans x 2 to 16; selected thumb spans x 20 to 34; track is 0 to 36, so both states keep a 2px inset and never overhang.
- E2E in `e2e/specs/admin-content.spec.ts`: assert per-row icon tile presence and group heading spacing, and assert switch geometry by measuring `button[role='switch']` and its `.mdc-switch__handle` descendant, requiring the thumb's left edge at least 1px inside the track and its right edge at most `track.right - 1` in BOTH checked states. Document that selector as the one allowed Material-internal hook.
- Group headings: 20px above, 8px below, none for the first group, hairline separation.
- Row hover: inset rounded fill (8px inset), no full-bleed band.

### W7 Admin media footer colours and the resume control (F-20261026-07, DC-20261026-01)

- Primary Upload/Update stays on `color="primary"` (the app-wide filled green). Do not switch it to the brand token; that would make the upload forms the only place using a second green.
- `src/app/styles/admin-forms.scss`: remove the blanket `color: white` at `:40`, then declare per variant:
  - `-upload`: white label (applies to filled buttons; add a guard so a stroked usage falls back to `--color-ink`).
  - `-cancel`: `--color-ink`, transparent.
  - `-delete`: `--color-error`, transparent.
  - `-retry`, `-resume`: `--color-accent-strong` border and glyph, 10% accent fill on hover.
- Scope check: these classes are also used by `user-edit` (Save, Cancel, Delete). Save inherits `-upload` and stays visually unchanged; Cancel and Delete keep their existing local overrides. The commit body records the audit.
- E2E `e2e/specs/media.spec.ts`: plant a resume state through `page.addInitScript` writing a minimal `mediaUploadBatch:<batchId>` sessionStorage entry with the matching `kind`, then assert the Resume button is visible, its computed colour is not white, and its background differs from the card.

### W8 Families page tells the truth, and dev stops serving stale builds (F-20261026-08, DC-20261026-03)

Code:

- `src/app/services/family.service.ts`: expose a status stream alongside the data — `familiesStatus$: Observable<'loading' | 'ready' | 'error'>` driven by a `BehaviorSubject`, updated in the single subscription's `next` (ready) and `error` (error). No auto-retry: a rules denial is deterministic, the Realtime Database SDK already reconnects sockets, and every caller sits behind a guarded route where reload recovers. Keep `families$` for snapshot consumers.
- `src/app/components/admin-families/admin-families.component.ts:130`: drive `state` from `familiesStatus$`, so a denied or failed read reaches `state = 'error'` and never renders "No families yet".
- `src/app/components/people/people.component.ts:127-145`: replace the `isSeed`/`seedEmpty` guess with `familiesStatus$`; `loading` while the families status is loading and people have arrived, `error` on families error, `ready` otherwise. No skeleton hang.
- `angular.json` development configuration: add `"outputHashing": "all"` so dev emits content-addressed bundles exactly like production and the e2e configuration already does. This removes the stale-chunk class of bug at the source instead of maintaining a filename inventory in hosting config.
- `firebase.json`: one header entry only, `{"source": "/index.html", "headers": [{"key": "Cache-Control", "value": "no-cache, max-age=0, must-revalidate"}]}`, because a cached `index.html` pointing at deleted hashed chunks is a white screen. No JS or CSS globs; hashed names make them immutable-safe by default.
- E2E: `people.spec.ts` keeps the ready and missing-data empty assertions; the families ERROR path is covered by a component unit test (`people.component.spec.ts`) with a mocked `familiesStatus$` emitting `error`, asserting the error state renders and no skeleton remains. RTDB is a WebSocket transport, so `page.route` cannot intercept it; do not attempt a route-level error simulation. `admin-content.spec.ts` asserts the Families page lists the seeded names and never shows "No families yet" while data exists.

Owner-run runbook (never executed by an agent):

1. Prerequisite: `npm --prefix functions run build` (the script requires `functions/lib/maintenance/clan-to-family.js`).
2. Back up and verify: `firebase database:get / --project lecoursville-dev > clans-backup-dev.json`; check the file is non-empty JSON and keep it out of git.
3. Dry run: `node scripts/migrations/clan-to-family.mjs --project lecoursville-dev --dry-run`.
4. Review the diff. Collision semantics are the script's: a key collision keeps the FAMILIES record over the clan and logs `family "x" kept over clan "y"`.
5. Apply: `node scripts/migrations/clan-to-family.mjs --project lecoursville-dev --apply`. The script recomputes state at apply time, so a stale reviewed diff is acceptable only if the dry run and apply run back to back.
6. Verify: admin Families count equals the People filter option count; the same names render on both pages.
7. Confirm no residual work: re-run the dry run and require it to report no pending changes, which proves the apply converged.
8. Concurrency: run during a quiet window. The script reads both nodes then writes `/families` as one node, so an admin edit landing between the read and the write is lost; if that happens, re-run the dry run to see the difference and re-apply.
9. Rollback if needed: `firebase database:set /families clans-backup-dev.json --project lecoursville-dev` restores only the families subtree from a targeted export; never restore a whole-database dump, which would clobber newer writes.
10. Ordering: the migration runs after this batch's deploy and before any rules cleanup, per D-20261025-18. Legacy `clanId`, the `clans` node, and `database.rules.json:169` stay until a later pass.

### W9 User-facing empty states speak to the visitor (F-20261026-09)

- Headlines: `We couldn't find any <thing>.` Search variants: `We couldn't find any <thing> matching "<term>".`
- Hints state a next step, never the backlog: `Try a different search or filter.` or `Check back later.`
- Remove every "yet", "once X is added", and any mention of uploading or creating on user-facing routes.
- Copy set, through `wordsmith` before landing:
  - People: `We couldn't find any people.` / `Check back later.`
  - Contacts: `We couldn't find any contacts.` / `Check back later.`
  - Calendar: `We couldn't find any events.` / `Check back later.`
  - Expressions: `We couldn't find any expressions.` / `Check back later.`
  - Chat: `We couldn't find any messages.` / `Start the conversation.`
  - Photos: `We couldn't find any albums.` / `Check back later.`
  - Album detail and slideshow: `We couldn't find any photos in this album.` / `Check back later.`
  - Media list: `We couldn't find any media.` / `Check back later.`
  - Audio tracklist: `We couldn't find any tracks in this album.`
- `no-results-message.component.ts`: default `title` becomes `We couldn't find anything.`; the search branch becomes `We couldn't find any <noun> matching "<term>".`
- Admin routes keep their operational copy.
- E2E: update the empty-dataset assertions that already exist in `contacts.spec.ts`, `expressions.spec.ts`, `photos.spec.ts`, and `people.spec.ts` rather than adding five copies of the node-null-and-restore machinery. Add one new case only for chat, whose empty state is flag-gated with its own markup: flip the seeded-OFF flag on, assert the copy, restore OFF in `finally`. Reuse the procedure already in `loading.spec.ts:70-97`.
- Done-check: `rg -n "yet|once .*added|will appear here" src/app/components --glob '*.html'` returns only admin templates.

### W10 Account page drops Connect Google (F-20261026-10)

- Remove `.account-connect` from `user-view.component.html:47-69`, including the connected status and error band.
- Remove `googleConnected`, `connecting`, `connectError`, `onConnectGoogle`, `mapLinkError`, `isGoogleConnected` from `user-view.component.ts`, and `linkGoogle` from `auth.service.ts:129` after confirming no other caller.
- Reword `auth.component.ts:182`: `An account already exists for this email. Sign in with your email and password.`
- E2E `e2e/specs/auth.spec.ts`: replace the connect assertion with positive ones — the account page shows the profile name, the Edit profile action, and the email as text. No negative assertion on the removed control; `linkGoogle` has one caller, removed in the same commit.

### W11 Email is immutable (F-20261026-11, DC-20261026-02)

- `user-edit.component.html:84`: the Email field becomes read-only text in the shared `#userFields` template, so self and admin modes both lose the input.
- `admin.service.ts:72`: keep `.update()` (never `.set()`), and omit `email` from the written payload so a stale form object cannot rewrite it.
- `database.rules.json:158`: append the email equality to the THIRD disjunct only — the `data.exists()` profile branch — as `newData.child('email').val() === data.child('email').val() && (...existing role clauses...)`. Do not append it to the whole rule, which would deny super delete (`newData` is null there) and the creation branch.
- Emulator rules test (add to `e2e/specs/rules.spec.ts` or the functions/rules unit suite, whichever already asserts user writes): a self write changing email is denied; a self name-only write succeeds; a super delete still succeeds; the first-sign-in creation write succeeds; `auth.service`'s session refresh, which rewrites the same email, still succeeds.
- Add a dated rules snapshot before the change ships, following `database-rules/<date>/`.
- Documented consequence: an account with no email can never gain one from a client; new accounts are created by signing in again.

### W12 Top bars never overflow (F-20261026-12, DC-20261026-05)

- `page-toolbar.component.scss`:
  - `.page-toolbar` (`:9`): `min-height: 64px; height: auto; flex-wrap: wrap; row-gap: 8px; padding: 12px 16px; align-items: center`.
  - `.page-toolbar-content` (`:57`): `flex: 0 1 auto`, add `flex-wrap: wrap` and `justify-content: flex-end` (today alignment is `margin-left: auto`; keep it and add the justify so wrapped rows stay right-aligned), children `max-width: 100%`.
  - `.page-toolbar-left` (`:34`): keep `flex: 1 1 auto; min-width: 0`; title keeps one-line ellipsis and takes a second line below 720px.
  - `@media (max-width: 600px)` (`:95`): `min-height: 56px` instead of a fixed height; tools take `flex-basis: 100%` when they cannot share the row.
- `admin-data.scss:51`: admin filter row gets `height: auto; min-height: 56px; flex-wrap: wrap`.
- `gallery-bar.scss`: delete the stale no-wrap comment (`:178`); the search pill keeps `flex: 1 1 240px` and may shrink to 150px below 720px.
- Overflow helper: add `expectNoHorizontalOverflow(locator)` to `e2e/helpers/` that compares `scrollWidth` to `clientWidth` on the ELEMENT, never on `documentElement` or `body` (`.app-container` is the scroll container with `overflow-x: hidden`, so document-level checks are false green). Call it with explicit locators: `app-page-toolbar .page-toolbar`, `.admin-filter-bar`, and the app nav toolbar.
- Call sites: `photos.spec.ts`, `people.spec.ts`, `contacts.spec.ts`, `calendar.spec.ts`, `admin.spec.ts` at 900px and 768px via `setViewportSize`, restoring the viewport afterwards. Calendar asserts the toolbar only; the month grid is an intentional horizontal scroller and is excluded.
- Done-check: no top bar reports `scrollWidth > clientWidth` at 1280, 1024, 900, 768, 600, or 390.

### W13 Admin uploads queue works on mobile (F-20261026-13)

- Seed: extend `scripts/e2e/seed.mjs` `userUploads` with one `pending` and one `rejected` upload alongside the existing approved one, with fixed ids and deterministic dates, so queue states are testable without throwaway writes.
- Above 720px keep the table. Below 720px render each upload as one media row:
  - 72px square thumbnail, no radius.
  - Filename `0.9375rem`/600 over one meta line: size, type, date, middle-dot separated.
  - Uploader as a quiet caption.
  - Status chip top-right.
  - Action bar full width beneath, using W5's template and colour model: `Preview`, `Approve`, `Reject` labelled, at least 44px tall, equal thirds.
- Rows keep a 1px `--color-border` divider between them and 12px vertical padding; the row card does not draw its own outer border (the sheet already does), so the result stays one sheet with divided rows rather than boxes in boxes.
- Filters and pagination stack full width below 720px, per W12.
- Implementation: CSS-only reflow of the existing table under 720px. Rows use `display: grid` on the `tr` with the existing `data-label` attributes driving placement (`grid-template-areas` or `:nth-child`), so one template and one set of handlers stay in place. No `BreakpointObserver`, no second render branch, no new abstraction.
- E2E `e2e/specs/admin-system.spec.ts` at 390x844: `expectNoHorizontalOverflow` on the queue container; assert three row cards (approved, pending, rejected) with thumbnails; assert each action is visible with height at least 44px; approve the pending row and assert its status becomes approved, restoring the node in `finally` if the seed is shared.

## Commit Plan

Six commits, each independently green:

1. Calendar margin, audio transport neutrals. (W1, W2)
2. Public upload card. (W3)
3. Admin card gap, features redesign, uploads queue restyle. (W4, W5, W6)
4. Admin media footer colours, families truthfulness, hosting cache headers. (W7, W8 code)
5. Empty-state voice, account page, email immutability plus rules snapshot. (W9, W10, W11)
6. Top bar wrap, seed states, mobile uploads layout, overflow helper. (W12, W13)

## Verification

- Unit: targeted specs only, `npx ng test --include <spec.ts>` per file (D-20261025-12).
- E2E: `npm run e2e:gate` with `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`.
- Manual: one pass on the dev build at 1280, 900, and 390 for touched pages, checking the values the e2e asserts.
- Red proofs to record in commit bodies: audio control colour before/after, resume button visibility before/after, admin gap before/after, toolbar overflow before/after, email write denial, mobile queue before/after.

## Rollout

1. Merge to `master` after a green gate.
2. Owner runs the W8 runbook against `lecoursville-dev`.
3. Owner re-tests Families and People parity, then signs off a dev deploy.
4. Cleanup pass later: `clanId`, `clans` node, `database.rules.json:169`.

## Out Of Scope

- Any Admin SDK path for changing a sign-in email (DC-20261026-02).
- Deleting the `clans` node or its rules in this batch.
- Feature-flag behaviour changes; W6 is visual only.
- Replacing the custom audio transport; only its palette changes.
- Moving the app-wide filled button colour off the M3 primary palette.
