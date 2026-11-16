# UI Review Instructions

Running ledger of Eric's UI adjustments, captured live during the full-app
UI review. Nothing here is implemented until the review is done and the batch
is worked as one pass.

## How This File Works

- Eric types an instruction in chat. It is appended here immediately with a
  stable ID.
- Status starts at `open`. It moves to `done` only after the change ships with
  e2e coverage.
- Instructions are grouped by screen or area. Unsorted captures land under
  **Unsorted** until filed.
- One pass implements and verifies everything, then this file is archived.

## Status Legend

| Status | Meaning |
|---|---|
| open | Captured, not yet implemented |
| blocked | Needs a decision from Eric |
| done | Implemented and verified |

## Instructions

| ID | Area | Instruction | Status |
|---|---|---|---|
| UI-001 | Global palette + filled buttons | Make the new top-bar emerald the palette brand (primary) color. Recolor every dark-green filled button (`+ Add Family`, `Print`, and peers) to match. Retune warn/error to complement the emerald in light and dark. | open |
| UI-002 | Theme toggle icon | Replace the `nightlight_round` dark-mode glyph with a standard upward-angled crescent, the dark-mode indicator most platforms use. | open |
| UI-003 | Calendar (user-facing) | The blue birthday and red anniversary tags, plus the calendar palette overall, do not fit the product palette. Redesign those colors to align with the brand in light and dark. Tags use the person's family color as the accent. Today's date circle uses the brand color with a translucent brand cell highlight. Dark mode needs its own pass, the current-day marker especially. | open |
| UI-004 | Top nav links | Middle-click (and ctrl/cmd-click) on a top-nav link should open it in a new tab. Write the e2e tests first, then make them pass. | open |
| UI-005 | Global footer / data rights | Build a user-facing site footer offering data removal and data update requests, per UX and web standards, legally compliant in both light and dark. Runs as its own create-spec, build, redteam cycle. | open |
| UI-006 | Calendar tags | When a tag label wraps to a second line, keep the wrapped line left-aligned with the first, instead of the current hanging indent. | open |
| UI-007 | Admin portal nav | Order the Admin sidebar sections System first, then People, then Content. | open |
| UI-008 | Dev dummy-data module | A dev-only reseedable module that fills every user-facing page with non-family dummy data: 20 public-domain videos, 20 public-domain expressions, photo albums, audio albums, songs, plus People, Contacts, Calendar. Runs as its own spec-and-build track. | open |
| UI-009 | Modal action colors + palette audit | In yes/no modals, Yes is the green brand/primary/success fill and No is red. Audit every modal and dialog action button, map each to a standardized palette role, and consolidate all remaining raw color choices in the app onto palette tokens. | open |
| UI-010 | Password reveal icon | The eye toggle's circular touch target touches the password field's right border. Add right-hand inset so the circle clears the border. | open |
| UI-011 | Sign-in page | Reorder: email+password above Continue With Google. Title-case the heading to "Sign In". Subtitle becomes "Welcome To LeCoursville". Remove the redundant top-right Sign In button on that page. Show the light/dark toggle there instead. | open |
| UI-012 | Email/password sign-up | The sign-in page has no way to create a new email/password account. Restore a working create-account path. | open |
| UI-013 | Deprecate legacy Contact model | Retire the legacy admin Contacts stack, delete the `Contact` model and its `contacts` RTDB node, and ship a standalone idempotent migration that removes the legacy data per environment. People becomes the sole source of truth for contact data. | open |
| UI-014 | Admin People browser | The Admin People page is import-only. Add a view/navigate-all-people surface showing all relevant data points, designed as a dense table. Keep CSV import reachable. | open |
| UI-015 | Admin Content nav + Media tabs | Content group order: Uploads, Media, Expressions, Songs, then Family Explorer at the bottom. Make Photo Albums a tab inside Media instead of its own nav item. | open |
| UI-016 | Admin System nav order | System group order: Features, Analytics, Users, Recovery. | open |
| UI-017 | Features card subtitle | "Toggle visibility of navigation menu items" is too large and possibly redundant. Either remove it or make it a light, small note on the same line as the Feature Flags title. | open |
| UI-018 | Mobile calendar | The mobile month view is broken: right side truncated, weekday headers misaligned with the cells, Saturday unreachable. Adopt a mobile-first responsive grid or an agenda pattern so the month fits and reads cleanly. | open |
| UI-019 | Mobile page toolbars | Page toolbars and filter bars feel wrong on mobile. In truncation mode always stack the elements and left-align them, instead of the current right-aligned wrapping. | open |
| UI-020 | User-facing video playback + share button | Videos in the user-facing Video view never play, only look loaded. Move the Share action below the video, smaller, right-aligned. | open |
| UI-021 | Music download/share placement | Reposition the Download and Share buttons on the user-facing Music view to match the new video placement: below the player, smaller, right-aligned. | open |
| UI-022 | Icon banner alignment | In the Family Explorer error banner, "Could not load the archives." is badly misaligned against the `!` icon. Make that banner and every similar icon-plus-text notice align cleanly in both themes. | open |
| UI-023 | Admin Expressions empty state | With no expressions, the Admin Expressions page shows the loading skeleton forever instead of an empty message. Fix it and audit every Admin component for the same stuck-loading pattern. | open |
| UI-024 | Video drop-zone copy | On admin/media/video the drop zone should read "Drag/Drop an mp4 here, or click to select a file". | open |
| UI-025 | S3 path container radius | The S3 path preview box is fully pill-rounded. Reduce its corner radius to match the rest of the platform. | open |
| UI-026 | Checkboxes to switches | Replace checkboxes platform-wide with one consistent switch-toggle control, with a smooth, polished interaction. | open |
| UI-027 | Admin sidebar version | Right-align the `v24.3.17` label in the Admin left sidebar footer instead of left-aligning it. Also fix the stale version source so the displayed number tracks the deployed build. | open |
| UI-028 | Admin/Users role order and naming | Order roles by privilege ascending: Member, Content Admin, Super. Use "Member" consistently instead of "User". | open |
| UI-029 | Two promoted routes | Admin/Features gets a Promoted Route for both approved and pending users, pending below approved. Pending users are authed but not yet approved and cannot view PII. Rename the labels to the domain terms. | open |
| UI-030 | Recovery nav badge | Show a count badge on the Admin sidebar Recovery item for any outstanding recovery requests, not only open ones. | open |
| UI-031 | Badge palette colors | Badges should use the palette brand/primary/success background, the same emerald as the top bar. Audit every badge style and consolidate off-palette colors. | open |

## Details

### UI-001 Global Palette And Filled Buttons

Goal: one brand emerald, used by the top bar, filled buttons, and the whole
palette as the primary color, plus matching warn/error tones.

Current state (evidence):

- Palette tokens live in `src/styles.scss:75-200`. Brand primary is already
  `--color-brand-primary: #27744A` ("Evergreen Emerald", `styles.scss:85`).
- Filled buttons pull `--color-brand-solid: #27744A` (`styles.scss:91`,
  `:108`), so the token layer thinks they match the bar.
- The M3 custom palette ramp also sits at `#27744A` tone 40/50
  (`styles.scss:209-211`).
- Filled buttons in use: `mat-flat-button color="primary"` in
  `admin-families.component.html:9`, `calendar.component.html:27`,
  `calendar-print.component.html:16`, and peers.
- Top nav: `mat-toolbar` in `app.component.html:6`, painted via
  `mat.toolbar-overrides(container-background-color: var(--color-brand-solid))`
  at `styles.scss:245-251` and `:294-300`.
- Error tokens today: light `--color-error: #B3261E` (`styles.scss:99`),
  dark `#F2B8B5` (`styles.scss:172`). `--color-error-solid` is theme-invariant
  `#B3261E` (`styles.scss:103`). There is no distinct warn token, M3 error
  palette covers warn states (`styles.scss:203`).

Work implied:

1. Confirm the exact emerald the top bar renders in the browser (the code
   says `#27744A`, but the visible bar reads brighter). That value becomes the
   single brand token.
2. Trace why filled buttons render darker than the bar, fix the source of
   truth, and remove any duplicate/divergent green literal. No raw hex outside
   `src/styles.scss` (contract from the 2026-10-31 standardization spec).
3. Replace the material error palette with warn + error tones that sit well
   next to the new emerald and pass AA in both light and dark. Keep the
   theme-invariant solid error used by `.btn-destructive` (`styles.scss:337`).

Done check: `npm run e2e:gate` green, plus a light/dark visual check of the
toolbar, `+ Add Family`, `Print`, and a destructive confirm. Add or update
`e2e/specs/theme.spec.ts` and the relevant domain specs.

### UI-002 Dark-Mode Crescent Icon

Current: `nightlight_round` at two sites, `src/app/app.component.html:93` (top
bar toggle) and `src/app/components/auth/auth.component.html:107` (account
theme pill). Both are the same glyph, so both change together.

Target: a plain upward-angled crescent, the convention used by iOS, Android,
macOS, GitHub, and most web toggles. Material icon candidates:

- `dark_mode` (recommended): a single tilted crescent, closest to platform
  convention.
- `bedtime`: crescent with a small star, slightly more decorative.
- `nights_stay`: crescent with a cloud, reads as weather, not dark mode.

Keep `light_mode` for the sun. Keep `data-testid="theme-icon-moon"` and the
`theme-icon-sun` pair intact so `e2e/specs/dark-mode.spec.ts:109` and `:115`
keep passing. Add an assertion that the moon slot renders the chosen glyph.

### UI-003 Calendar Palette Alignment

Owner: design-led. This is a color-design pass, not a mechanical token swap.
The birthday blue and anniversary red are the loudest off-brand colors in the
user-facing calendar.

Current tokens, `src/styles.scss`:

- Light: `--cal-birth-accent: #2b6cb0` (blue, `:128`),
  `--cal-anniv-accent: #c53030` (red, `:129`), `--cal-tag-bg: #fafbfc`
  (`:130`), `--cal-tag-ink: var(--color-ink)` (`:131`).
- Dark: `#7FAEDC` / `#E58585` / `#22272D` (`:186-188`).
- Calendar grid chrome lives under `.cal-month-view` (`styles.scss:752-880`).

Consumers:

- `src/app/components/calendar-cell/calendar-cell.component.scss:10-26` —
  tag background, left accent border (birth/anniv/holiday), and the colored
  label text.
- `src/app/components/calendar-view/calendar-view.component.scss:22-160` —
  list view, brand tints, surfaces.
- `src/app/components/calendar/calendar.component.scss:34-127` — toolbar,
  checkboxes, filled button (already brand).
- `src/app/components/calendar-printer/*` — print inherits the same tokens
  and must stay legible on paper (print re-declares light values,
  `styles.scss:675-702`).

Design brief:

1. Keep birthday and anniversary instantly distinguishable from each other
   and from brand emerald and holiday ink.
2. Derive both from the product palette family instead of saturated
   blue/red. Options: a honey/amber (existing `--color-accent`), a slate/ink
   neutral, and the success/error branches. Do not reuse error red for
   anniversaries if error is retuned in UI-001.
3. Check all four combinations: light, dark, and print (light forced), at the
   4px accent bar, the label text, and the tag fill.
4. Every accent must clear contrast for its use: label text AA on the tag
   fill, accent bar visible at 3:1 against `--cal-tag-bg`.

Done check: `npm run e2e:gate`, plus updated screenshots or assertions in
`e2e/specs/calendar.spec.ts` and the print specs. Verify no raw hex outside
`src/styles.scss`.

#### UI-003 Addendum: Family Color Tags And Brand Today Marker

Eric's follow-up direction on the same calendar palette pass. This supersedes
the "derive from the palette family" wording above for the tag accent.

**Tag accent = family color.** The left accent bar on each event tag should be
the family color of the person the event belongs to, not a type color.

- Family color source: `family.hexColor`, already used at
  `admin-families.component.html:89`, `person-detail-modal.component.html:5`,
  and across `family-explorer` via `--family-color`.
- Blocker: `RecurringEvent` (`src/app/interfaces/recurring-event.ts`) carries
  no family color today, and `CalendarService.deriveEventsFromPeople`
  (`calendar.service.ts:50-114`) builds events from `Person` without resolving
  the family. Join on `person.familyId` during derivation and put the hex on
  the event, rather than looking it up in the template.
- Consumer: `calendar-cell.component.html:15` picks `border-birth` /
  `border-holiday` / `border-anniv`. Replace the type-driven class with an
  inline `[style.borderLeftColor]` bound to the event's family color. Fall
  back to `var(--color-brand-primary)` when a person has no family.
- Type no longer lives in the accent bar. Keep birth and anniversary
  distinguishable by icon, label, or the years-since tint. Holidays keep the
  neutral ink bar (`border-holiday`).

**Today marker = brand.** Currently honey:
`.cal-month-view .cal-day-cell.cal-today .cal-day-number` paints
`background: var(--color-accent-strong)` (`styles.scss:853-865`), with the
stale comment "Today = the honey marker".

- Circle: `background: var(--color-brand-solid)`, ink
  `var(--color-on-brand-solid)` (white, passes in both modes).
- Cell highlight: light brand wash on the same cell, e.g.
  `background: color-mix(in srgb, var(--color-brand-primary) 10%, transparent)`,
  matching the existing brand-tint pattern (`calendar.component.scss:114`,
  `calendar-view.component.scss:30`).
- Update the stale honey comment.

Both changes stay inside the UI-003 light/dark/print verification.

**Dark mode is the hard case.** Eric finds the calendar palette, the current
day in particular, looks terrible in dark mode. Treat dark as its own design
pass, not a token swap:

- Today circle in dark: `--color-brand-solid` is theme-invariant `#27744A`
  (a deep green) on a dark ground. That reads muddy and low-energy. Consider a
  lighter-on-dark treatment for the marker in dark only, for example the dark
  brand primary `#8CCDA3` (`styles.scss:165`) as the circle fill with dark ink
  `#111418`, or a ring plus tint instead of a filled circle.
- Cell wash: `color-mix(..., var(--color-brand-primary) 10%, transparent)` in
  dark mixes a light mint at 10 percent, which is nearly invisible against
  `--color-surface: #1B1F24`. Use a higher mix or a dedicated dark token so the
  highlight actually reads.
- Tags and family colors: family `hexColor` values were chosen for light
  surfaces. In dark, a raw mid-saturation accent bar and the colored
  years-since text can vibrate or fail contrast. Plan a dark adapter, for
  example `color-mix` toward the surface for bars and a lightened text variant.
- Check every calendar surface at both modes: grid lines, out-month numbers,
  hover, today, tag fill, tag bar, label text, holiday ink, and the list view.

Add dark-mode screenshots or assertions to `e2e/specs/dark-mode.spec.ts` and
the calendar spec.

### UI-004 Nav Links Open In New Tab

Root cause: every top-nav link is a native `<button>` carrying `routerLink`
(`src/app/components/navbar-links/navbar-links.component.html:20-31` and
`:41-52`). A `<button>` has no href, so the browser cannot middle-click or
modifier-click it, and Angular's Router intercepts the plain click.

Fix shape:

- Render the inline nav items and the mobile menu items as `<a>` elements
  (`a mat-button`, `a mat-menu-item`) with `[routerLink]`. Angular emits a real
  `href` on an anchor, which gives native new-tab behaviour for middle-click,
  ctrl-click, and cmd-click. No custom click handler needed.
- Keep `routerLinkActive`, the icon/label markup, and the test hooks intact.
- Mobile menu (`isMenuList`) also gets anchors, but note `mat-menu-item` hit
  area and focus styling must not regress.

Tests first, per the instruction. Add to `e2e/specs/nav.spec.ts`:

1. Each desktop nav link exposes an `href` matching its route.
2. Middle-click opens a new page: use
   `page.locator(...).click({ button: 'middle' })` and assert a second page
   appears with the target URL (Playwright `context.waitForEvent('page')`).
3. Ctrl/cmd-click also opens a new tab and leaves the current page unchanged.
4. Plain click still navigates in place and sets the active state.

Keep the existing nav assertions passing. Do not add arbitrary sleeps. Run
`npx playwright test --project=chromium e2e/specs/nav.spec.ts` for the fast
loop, full `npm run e2e:gate` before done.

### UI-005 Global Footer And Data Rights

Runs as a standalone `create-spec` then `implement-spec` then `redteam` cycle,
not as part of the UI polish batch. It is the only item here that changes a
data contract and carries legal weight, so it needs its own spec, sign-off,
and adversarial review.

**Finding: there is no global footer.** `src/app/app.component.html` ends at
`<router-outlet>` with no footer. The only data-removal affordance in the app
is a `mailto:` link inside the family explorer:

- `src/app/components/family-explorer/family-explorer.component.html:58-60`.
- `removalRequestHref` builds `mailto:eric@lecoursville.com` with a prefilled
  subject/body (`family-explorer.component.ts:130-136`).
- Styled at `family-explorer.component.scss:155-178`.

That link is scoped to one explorer page, is email-only, has no update path,
and is not discoverable from the rest of the site. No prior spec covers it
(the 2026-10-28 explorer spec mentions only a text link back at the page
footer).

Scope for the spec:

- A site-wide footer present on all user-facing routes, hidden on print and on
  the admin-only shell where appropriate.
- Entry points for **data removal** ("do not display my information") and
  **data update** ("correct my information"), plus a general contact.
- Legally compliant framing: plain language, no dark patterns, an accessible
  request path that works without sign-in, a stated response handling, and
  no promise the app cannot keep.
- UX and web standards: semantic `<footer>`, proper landmarks, focus order,
  target sizes, visible focus, contrast in light and dark, responsive layout,
  and no dead links.
- Backend path for the request: either a persisted request record with an
  admin-visible queue, or a documented email workflow. Decide in the spec.

Open decisions to settle before the spec is written:

1. Request channel: in-app form persisted to Firestore with an admin queue,
   versus a `mailto:` link, versus both.
2. Identity: how a requester proves the record is theirs, and what happens to
   requests that cannot be verified.
3. Semantics: does "removal" mean deleting the record, hiding it from public
   display, or a per-field redaction? Data retention and audit trail.
4. Scope: people, photos, media, calendar, contacts, messages. Which data
   classes the policy covers.
5. Legal copy owner and jurisdiction. Any legal text is human-reviewed and
   never drafted as final by an agent.

Cycle plan:

1. `create-spec` with the answers above, producing a full spec under
   `docs/specs/`.
2. `implement-spec` with e2e coverage for the footer on every user route, the
   request flow, light/dark, keyboard path, and mobile.
3. `redteam` the implementation for privacy, XSS, auth bypass, PII leakage in
   requests, and dark-pattern/legal gaps.

### UI-006 Calendar Tag Wrap Alignment

Cause: the calendar tag labels use a hanging indent, not a normal paragraph
wrap. In `src/app/components/calendar-cell/calendar-cell.component.scss`:

- `.event-title-link, .event-title-spouse-link` at `:47-59` sets
  `padding: 1px 4px 1px 12px` and `text-indent: -8px`.
- Same pattern on `.event-title-holiday` at `:93-102`.

`text-indent` applies only to the first line, so the first line starts at
`12 - 8 = 4px` while every wrapped line starts at `12px`. That is the 8px
indent Eric sees on wrapped content.

Fix: drop the hanging-indent trick and give the label a uniform left padding
with `text-indent: 0`, so first and wrapped lines share the same left edge.
Apply to both the person labels and the holiday label. Check the single-line
look does not shift more than a couple of pixels from today, and that the
flex `.anniv-first-line` row still aligns the ampersand.

Done check: `npm run e2e:gate`, plus a calendar spec assertion that a long
label's first and second lines share the same left offset (measure bounding
boxes of the rendered line boxes, or assert computed `text-indent: 0px` and
equal padding on both selectors).

### UI-007 Admin Sidebar Section Order

Single source of truth: `ADMIN_NAV_GROUPS` in `src/app/admin/admin-nav.ts:34`
is currently `['People', 'Content', 'System']`. The sidebar renders groups in
that array order (`admin.component.ts:142-149`).

Change to `['System', 'People', 'Content']`. Also reorder the
`AdminNavGroup` union on `admin-nav.ts:27` for readability. No markup or CSS
change is needed. Super-only System entries stay filtered per user as today.

Watch for order-sensitive tests: `e2e/specs/nav.spec.ts` and the admin specs
may assert group order or first-group content.

Done check: `npm run e2e:gate` plus a nav assertion that the rendered group
order is System, People, Content for a super admin and for a regular admin
(where System renders empty and is skipped or shows nothing).

### UI-008 Dev Dummy-Data Seed Module

Runs as its own spec-and-build track, not inside the UI polish batch. It is
infrastructure plus a data contract, and it must never touch prod.

**Goal.** Every user-facing page shows non-family dummy content on the dev
project, and the whole set can be reseeded on demand. Non-family means no real
family member, no real contact, no real location. Fictional people only.

**Existing pieces to build beside, not inside:**

- `scripts/e2e/seed.mjs` (625 lines) seeds the emulator with deterministic
  fixtures and is coupled to the e2e gate. Keep it as-is.
- `scripts/family/upload-people.mjs` is a one-off uploader, not a reseeder.
- `scripts/deploy.sh` owns dev deploy (`lecoursville-dev`). `.firebaserc`
  defaults to `lecoursville-dev`, prod is `lecoursville`.
- No dev-data module exists today.

**Shape.** New isolated module, e.g. `scripts/dev-seed/`, with:

- `index.mjs` entry, `npm run seed:dev` script.
- A source manifest per content class: videos, expressions, photo albums,
  audio albums, songs, people, contacts, calendar events, families.
- A license ledger recording source URL, license, and attribution for every
  public-domain asset.
- Idempotent reseed: a stable namespace prefix (`dev-seed/`, ids tagged
  `devseed-`) so a rerun replaces its own records and touches nothing else.
- Hard guard: refuse to run unless the Firebase project is exactly
  `lecoursville-dev`, and require an explicit `--confirm` flag. Never read a
  prod credential. Mirror the sign-off style of `deploy.sh`.

**Content to pull (20 each unless noted):**

- 20 public-domain videos (e.g. Internet Archive / Prelinger, Library of
  Congress). Small enough for Storage, mp4/webm.
- 20 public-domain expressions or quotes from historical public-domain
  figures. Attribute correctly, no living-person quotes invented or
  misattributed.
- Several photo albums with public-domain images, multiple images per album.
- Several audio albums with public-domain recordings.
- A song set for the songs library, with public-domain lyrics or original
  placeholder lyrics where rights are unclear. Never ship copyrighted lyrics.
- Fictional People, Contacts, Calendar events, and family groups, tied to the
  seeded media so pages cross-link.

**Pipeline.** Download to a gitignored cache, verify checksum and license
metadata, upload to the dev Storage bucket, write records through the Admin
SDK, then print a summary. A `--clean` flag removes only `devseed-` records.

**Open decisions:**

1. Asset hosting: commit nothing. Download at seed time, or cache a pinned set
   in a dev-only bucket. Decide.
2. Sources: which archives are acceptable and how license is verified
   automatically versus by a human.
3. Auth: reuse an existing seed user, or create a dedicated dev content owner.
4. Whether this shares fixtures with the e2e seed or stays fully separate.

**Cycle.** `create-spec`, then `implement-spec`, then a redteam pass focused on
prod safety, license compliance, and idempotency. Verify with a dev deploy and
a browser pass over every user-facing page.

### UI-009 Modal Action Colors And Palette Audit

Policy: in a yes/no modal, Yes is the green brand/primary/success fill and No
is red. Then audit the rest of the app so every action color resolves to a
standardized palette role.

Two modal systems exist:

1. `src/app/components/confirm-dialog/confirm-dialog.component.html` —
   `mat-stroked-button` cancel plus `mat-flat-button` confirm. Confirm is
   brand green by default and red only when `data.destructive` is set
   (`[class.btn-destructive]`). Called through
   `src/app/services/confirm-dialog.service.ts`.
2. `src/app/components/prompt-modal/prompt-modal.component.html` — loops
   `buttons` and sets `color="{{ button.color }}"` plus
   `[class.btn-destructive]`. `PromptButton.color` is an unconstrained
   `string` (`src/app/interfaces/prompt-button.ts:3`), so callers can pass any
   M3 name. Callers include auth sign-out, message-edit, media-explorer,
   photos-legacy, and errors.service.

Work:

- Make the yes/no mapping explicit in both components rather than inferred
  from ad-hoc `color` strings. Type `PromptButton.color` to a palette union
  (`'primary' | 'accent' | 'warn'`) or replace it with a semantic role enum
  (`confirm | cancel | destructive`).
- Audit every call site that opens these dialogs and every dialog action
  button: sign-out, message delete/save, media delete, photo delete, song
  draft, calendar delete/replace, user-edit, recovery, photo album dialogs,
  feature-disabled, auth-action. Build a table of dialog → button → intended
  role → current color → target token.
- `color="warn"` on icon buttons and album deletes (e.g.
  `admin-photo-albums.component.html:51,107,151,218`,
  `admin-calendars.component.html:67`, `user-edit.component.html:22,63`)
  must map to the retuned error/warn palette from UI-001, not an unrelated
  red.

Palette consolidation audit (all under `src/app/**/*.scss`):

- 18 component stylesheets still hardcode `rgba()` / `rgb()` / hex values
  instead of tokens. Worst offenders: `auth.component.scss` (6),
  `photos-legacy.component.scss` (7), `auth-action` (4),
  `admin-user-uploads` (4), `gallery-bar` (3), `admin-families` (3),
  `admin-people-import` (3), plus single hits in `admin-data.scss`,
  `person-detail-modal`, `admin-photo-albums`, `song-draft-dialog`,
  `calendar-datepicker-dialog`, `user-edit`, `user-view`, `photo-albums`,
  `photo-slideshow`, `recovery-request`, `admin`, `chat-view`.
- Add any missing semantic tokens (shadow/overlay/error-tint/amber-tint) to
  `src/styles.scss`, then replace every literal with the token. Keep the
  2026-10-31 contract: zero raw hex outside `src/styles.scss`. Raw `rgba()`
  in shadows is acceptable only through a shadow token.
- `color="accent"` in `user-edit.component.html:13,46` is honey, not brand.
  Decide whether those actions are primary or secondary and normalize.

UX caveat to weigh during implementation: red normally signals a destructive
action, so painting No red can read as "No is dangerous" and pushes users
toward the affirmative. For destructive confirms (Delete, Remove, Reset) the
safer mapping is destructive action red and cancel neutral, with Yes green
only for benign confirms. Capture this in the spec decision record before
shipping.

Done check: `npm run e2e:gate`, `npm run theme:check`, plus a dialog audit
table in the change notes and specs asserting the Yes/No colors in
`e2e/specs/edge-cases.spec.ts` or a new dialogs spec.

### UI-010 Password Reveal Icon Inset

Site: the sign-in password field,
`src/app/components/auth/auth.component.html:48-59`. The reveal control is
`button.auth-toggle` with `matSuffix` inside an `appearance="outline"`
`mat-form-field`. Its current style is only `color: var(--color-ink-2)`
(`src/app/components/auth/auth.component.scss:102-104`). The icon button's
40px circular state-layer target sits flush against the outlined field's
right edge, so the circle visually touches the border.

Fix: give the suffix control a small right-hand inset, for example
`margin-right: 4px` on `.auth-toggle`, or adjust the form-field suffix padding
token locally. Keep the touch target at the standard icon-button size and do
not move the lock prefix. Check both appearances at 36px and on mobile.

Also scan for the same pattern anywhere a `matSuffix` icon button sits inside
an outlined field (`media-search-input`, `admin-users`, `admin-songs`,
`songs-list`, `photos-legacy`) and apply the inset consistently if the circle
touches there too.

Done check: `npm run e2e:gate` and a visual assertion that the toggle's
bounding box right edge is inset from the field's content box.

### UI-011 Sign-In Page Adjustments

All in `src/app/components/auth/auth.component.html` unless noted.

1. **Order email/password above Google.** Today the Google button is first
   (`:35-38`), then the `or` divider (`:39`), then the email and password
   fields. Move the form fields first, keep a divider, and place
   `Continue with Google` below. Keyboard order and the form's `ngSubmit`
   stay intact.
2. **Capitalize the heading.** `Sign in` at `:32` becomes `Sign In`. Also the
   submit button copy at `:73` (`Sign in` and the `Signing in…` loading
   state) should read `Sign In` / `Signing In…` for consistency. Check every
   other user-facing `Sign in` string in the auth flow.
3. **Subtitle copy.** `Welcome back to LeCoursville` at `:33` becomes
   `Welcome To LeCoursville`.
4. **Drop the redundant top-right Sign In.** `src/app/app.component.html:37-43`
   renders an `a[mat-button]` "Sign In" link in the toolbar when signed out.
   On the sign-in route itself it duplicates the page. Hide it on the root
   route only, not everywhere signed-out.
5. **Show the theme toggle when signed out.** The toggle (`app.component.html:84-97`)
   lives inside the signed-in `@else` branch, so the sign-in page has no
   light/dark control. Lift the theme button out of the auth conditional so it
   renders on the sign-in page too. Keep `data-testid="theme-toggle"`.

Watch for tests asserting the heading text, subtitle, button labels, or the
signed-out toolbar contents. Update `e2e/specs/auth.spec.ts`,
`e2e/specs/nav.spec.ts`, and `e2e/specs/dark-mode.spec.ts` as needed.

Done check: `npm run e2e:gate` plus a spec that the sign-in page shows fields
before Google, the exact new copy, no toolbar Sign In link, and a working
theme toggle.

### UI-012 Email/Password Account Creation

Finding: email/password **sign-in works, sign-up does not exist**.
`AuthService` imports `signInWithEmailAndPassword` and
`sendPasswordResetEmail` but never `createUserWithEmailAndPassword`
(`src/app/services/auth.service.ts:1-15`). The auth card only renders the
sign-in form (`auth.component.html:34-88`), and the only account-creation
route today is Google sign-in.

What already exists to hook into:

- `AuthService.onSignIn` and `createUser` handle the post-auth profile write:
  create `users/{uid}` without roles, then call the `claimMemberRole`
  callable (`auth.service.ts:189-235`, `:366-372`).
- Membership is server-owned and new users land pending approval
  (`createUser` comment, `auth.service.ts:220-240`).
- `functions/src/account-created.ts` fires on new auth accounts and
  `functions/src/claim-member-role.ts` owns the role stamp.
- Pending users see the pending banner (`app.component.html:100-104`).

Work:

- Add `AuthService.createAccount(email, password)` wrapping
  `createUserWithEmailAndPassword`, then run the same post-auth profile path
  (create profile, claim member role, set local user) used by `onSignIn`.
- Add a create-account mode to the auth card: a toggle between Sign In and
  Create Account, with confirm-password plus the minimum viable validation,
  keeping the field order from UI-011 and the Google button.
- Map Firebase auth errors to the existing friendly-message mapper
  (`auth.component.ts` error codes), including `email-already-in-use`,
  `weak-password`, and `invalid-email`.
- Decide and spec: email verification required before approval, password
  policy, and whether account creation is open or invite-gated. These affect
  security and the approval flow, so they need a decision record.

Not a pure UI change: this adds an auth code path. Give it e2e coverage in
`e2e/specs/auth.spec.ts` for create, duplicate email, weak password, and the
pending-approval landing state.

Done check: `npm run e2e:gate`, plus the emulator seed's auth user set still
works and no route guard regresses.

### UI-013 Deprecate Legacy Contact Model

Decision: retire the legacy admin Contacts stack, delete the `Contact` model
and its `contacts` RTDB node, and ship a standalone idempotent migration that
removes the legacy data per environment. People is the sole source of truth
for contact data.

**Keep (people-based, not the legacy model):**

- `/contacts` user route and `ContactsComponent` (`app-routing.module.ts:27-31`,
  `:95-98`), driven by `ContactsFromPeopleService`.
- `ContactCard` interface and `ContactCardComponent` — a view model over
  `Person`, not the legacy `Contact`.
- `ContactInfoComponent` (`contact-info`) — person-based display.
- Feature flag id `contacts` gating the user-facing route.

**Delete:**

| Path | What |
|---|---|
| `src/app/models/contact.ts` | legacy `Contact` class |
| `src/app/services/contacts.service.ts` | reads/writes the `contacts` node |
| `src/app/components/contacts/contact-edit/` | edits the legacy node |
| `src/app/components/contacts/contact-view/` | declared, unused by any template |
| `src/app/components/admin-contacts/` | legacy fixup list |
| `src/app/app.module.ts:25-27,46,60-62,86` | declarations and the `ContactEditComponent` export |
| `src/app/components/admin/admin.module.ts:7,64-76` | admin contacts routes |
| `src/app/admin/admin-nav.ts:9,41` | `ADMIN_ROUTE.contacts` and the nav item |
| `database.rules.json:18-21` | `contacts` read/write block (last, after migration) |

**Downstream touchpoints to update:**

- `scripts/e2e/seed.mjs:494` seeds `contacts/contact-1..3`. Remove the node.
- `functions/src/admin-analytics-summary.ts:26` lists `/contacts` in fixture
  top pages. Remove or keep as a page label? It is a fabricated fixture, so
  drop the row.
- e2e specs that reference the legacy stack:
  `admin.spec.ts:116`, `nav.spec.ts:155-169`, `security.spec.ts:475-489`,
  `rules.spec.ts:591-595,685-688,741`, `admin-system.spec.ts:364-377`,
  `feature-flags.spec.ts:124`, `loading.spec.ts:9,80-87`,
  `pending-membership.spec.ts:96`, `auth.spec.ts:36-37,122`,
  `admin-content.spec.ts:449`. Distinguish the user-facing `/contacts` tests
  (keep) from the `/admin/contacts` and `contacts` node tests (remove or
  rewrite to People).
- Unit specs: `admin-contacts.component.spec.ts`,
  `contact-edit.component.spec.ts`, `contact-view.component.spec.ts`.
- Discovery and handoff notes that describe the legacy model.

**Migration: `scripts/migrations/drop-legacy-contacts.mjs`.**

- Standalone, no app import. Uses the Admin SDK from the functions package
  (same `createRequire` trick as `scripts/e2e/seed.mjs`).
- Takes an explicit `--project <id>` and refuses anything unless the operator
  passes `--confirm`. Dry-run by default: report the node size and record
  count, then exit.
- Deletes only `contacts/`. Idempotent: a second run reports nothing to delete
  and exits zero.
- Refuses to run while the rules still allow `contacts` writes in a way that
  would let clients recreate the node after the migration. Order: ship the
  code that stops writing, run the migration in dev then prod, then drop the
  rules block and deploy rules.
- Add `npm run migrate:drop-contacts`.
- Log a before/after count and a timestamp. Never touch any other node.

Done check: `npm run e2e:gate`, `npm run pii:check`, unit suite, plus a dev
run of the migration and a browser pass showing the Contacts page still works
from People and `/admin/contacts` is gone.

### UI-014 Admin People Browser

Finding: `/admin/people` is not a people browser. The route maps to
`AdminPeopleImportComponent` (`src/app/components/admin/admin.module.ts:61-64`),
whose page is a CSV upload and validation flow with the toolbar title
"People" (`admin-people-import.component.html:1-40`). There is no list of all
people, no search, and no way to open an individual record from admin.

Design goal: a dense, scannable table of every person in the system, the Admin
People default surface. CSV import stays reachable from the same page, as a
secondary action or a tab, not the whole page.

Reuse the established admin table system:

- `src/app/styles/admin-data.scss` — table, pagination footer, filters.
- `src/app/components/admin-users/admin-users.component.html:96-146` — the
  reference implementation: search filter, sort, `admin-table`, pagination
  with `Showing x-y of z`.
- `src/app/admin/pagination.ts` — `paginate`, `pageRange`.
- `PeopleService.people$` — the source, already live.

Columns to fit, from `Person` (`src/app/models/person.ts:1-34`):

- Name (given, preferred, maiden, last, suffix), compact single cell.
- Family.
- Generation.
- Born (year, or full date on hover).
- Died.
- Anniversary.
- Spouse.
- Contact: an email/phone summary, counting or first value, not every entry.
- Address: city/state summary.
- Living: a compact status.
- Updated: relative or date.

Behavior:

- Client-side search across name, family, and contact values.
- Sort on name, family, generation, born, updated.
- Pagination consistent with the other admin tables.
- Row click opens the person record. Decide the detail surface: reuse
  `person-detail-modal`, or route to a new `/admin/people/:id` editor. The
  existing user-facing `/people` view is the only person surface today.
- Empty, loading, and error states use the established admin skeleton and
  `app-load-error`.
- Information density: tight row height, single-line cells with ellipsis and
  a title tooltip, no card-per-person layout. Responsive: horizontal scroll
  or a stacked mobile variant, no clipped columns.

Open decisions:

1. Person detail/edit: modal versus a dedicated admin route. The admin needs
   an edit path eventually; scope this item to view and navigate, and note
   editing as a follow-up unless wiring the existing editor is trivial.
2. Whether the CSV import moves to a tab or a toolbar action on the same page.
3. Whether the table shares the exact pagination page size with admin users.

Done check: `npm run e2e:gate`, plus an admin spec for the table rendering,
search, sort, pagination, row navigation, and the still-working import entry.

### UI-015 Admin Content Nav And Media Tabs

Target Content group order, top to bottom:

1. Uploads
2. Media
3. Expressions
4. Songs
5. Family Explorer (bottom)

Current order in `src/app/admin/admin-nav.ts:43-49`: Family Explorer,
Expressions, Media, Photo Albums, Songs, Uploads. Reorder the `ADMIN_NAV`
entries accordingly. Group order itself is UI-007.

**Photo Albums becomes a Media tab.** Today it is a separate nav item
(`admin-nav.ts:46`) and route (`admin.module.ts:42-44`, guarded by
`PhotoAlbumsFeatureGuard`). Media already has a section switcher rendered as
buttons, not Material tabs:

- `admin-media.component.html:7-25` — Video / Audio Album buttons with
  `role="group"`, `aria-pressed`, `data-testid="media-section-*"`.
- `admin-media.component.ts:28` — `section: 'video' | 'audio'`.

Work:

- Add a third section, Photo Albums, rendering the existing
  `AdminPhotoAlbumsComponent` (`admin-photo-albums/`). Do not rewrite that
  component; embed it.
- Change the switcher to a proper tablist or keep the existing segmented
  buttons and extend it. Match whatever is most consistent with the app.
  Keep the feature-flag gate: hide the Photo Albums tab when
  `enablePhotoAlbums` is off, not the whole Media page.
- Remove the `photoAlbums` entry from `ADMIN_NAV` so it stops rendering as a
  sidebar item. Keep `ADMIN_ROUTE.photoAlbums` as a compatibility route that
  renders Media with the Photo Albums tab selected, so old links and tests do
  not 404. Decide whether to redirect or alias.
- Deep-link support: Media should read a query param or child route for the
  active section, so `/admin/photo-albums` and links from uploads land on the
  right tab.

Tests to update: `admin.spec.ts:118-120` (nav list), `admin-consistency.spec.ts`
(route checks), `admin-roles.spec.ts`, `admin-content.spec.ts` (many
`/admin/photo-albums` navigations), `feature-flags.spec.ts:122` (nav link
absence), `loading.spec.ts:32-33`, `dark-mode.spec.ts:351`, `security.spec.ts`,
`nav.spec.ts`. The `admin-nav-link-photoAlbums` test ID disappears, so those
assertions must target the tab.

Done check: `npm run e2e:gate` plus an admin spec asserting the sidebar order
and that the Photo Albums tab loads the album manager inside Media.

### UI-016 Admin System Nav Order

Target, top to bottom: Features, Analytics, Users, Recovery.

Current `src/app/admin/admin-nav.ts:49-52` is Users, Features, Recovery,
Analytics. Reorder those four `ADMIN_NAV` entries. All are super-only, so no
visibility change. Pairs with UI-007 (System is the first group).

Update any sidebar-order assertions in `e2e/specs/nav.spec.ts` and
`e2e/specs/admin.spec.ts`.

Done check: `npm run e2e:gate` plus a nav assertion on the rendered System
group order.

### UI-017 Features Card Subtitle

Site: `src/app/components/admin-features/admin-features.component.html:45-46`.

```
<mat-card-title class="admin-card-title">Feature Flags</mat-card-title>
<mat-card-subtitle>Toggle visibility of navigation menu items</mat-card-subtitle>
```

It renders at Material's default subtitle size, which reads as a second
heading. It is also partly redundant with the page intro just above it,
"Choose what appears in the app..." (`admin-features.component.html:4-6`).

Two acceptable outcomes, pick the cleaner one:

1. Remove the subtitle entirely. The intro already explains the page, and the
   card title is self-explanatory. Lowest risk, least clutter.
2. Keep it but inline it: one flex row, `Feature Flags` plus the note in a
   small, light `--color-ink-2` style, for example 0.8125rem, aligned to the
   title baseline. Reuse the `.promoted-route-support` scale
   (`admin-features.component.scss:37-41`) and do not use
   `mat-card-subtitle`, whose Material sizing causes the current issue.

Recommendation: remove. If it stays, inline it.

Done check: `npm run e2e:gate` and a visual check at mobile width that the
title row does not wrap awkwardly.

### UI-018 Mobile Calendar

Symptoms: right-hand columns truncated, weekday header labels do not line up
with the day cells beneath them, Saturday cannot be reached.

Root causes in the current CSS:

- `.calendar-month-view-container` forces `min-width: 700px` at
  `calendar-view.component.scss:127`, `:139`, `:157`, and the day cells force
  `min-width: 160px` each (`styles.scss:763` and the `max-width: 768px` block
  at `:767-774`). Seven 160px cells need about 1120px, so a phone shows roughly
  three and a half columns.
- The header row and the day rows do not share a column template. The header
  cells are flex children that shrink to the container width, while day cells
  hold their 160px minimum, so headers drift out of alignment.
- `.cal-month-view` sets `overflow: hidden` (`styles.scss:823-829`), which
  clips the overflowing cells instead of letting the scroller pan. Combined
  with `max-width: 100%` on the month container (`calendar-view.component.scss:132`),
  the right side is cut rather than scrollable.
- A pan hint exists (`calendar-pan-hint`, `calendar-view.component.html:52-55`,
  shown under 768px) but the clipped overflow means panning does not reveal
  Saturday.

Options, pick one primary pattern:

1. **Fluid 7-column grid (recommended).** Drop the 700px minimum and the 160px
   cell minimum on phones. Make both `.cal-day-headers .cal-cell` and
   `.cal-day-cell` `flex: 1 1 0`, `min-width: 0`, `width: calc(100% / 7)`.
   Shorten weekday labels to single letters under about 480px. Reduce cell
   min-height to roughly 64px, shrink the day number, and rely on the existing
   `+N more` affordance (`calendar-view.component.ts:31`, `maxEventsPerCell`).
   No horizontal scroll, header and cells share identical widths by
   construction.
2. **Single-week scroller with a sticky header.** Keep 160px cells but make
   the header share the same scroll container and width so it pans with the
   cells. Add snap scrolling (`scroll-snap-type: x mandatory`) per week. This
   keeps readable event text but still needs a swipe.
3. **Agenda/list mode on phones.** Render the month as a grouped list of days
   with events, with a compact week strip on top. Most legible for event-dense
   days, more work, and a departure from the grid the rest of the app uses.

Recommended: option 1 for the month grid, plus an agenda toggle if dense days
remain unreadable at phone width.

Also fix:

- Remove `overflow: hidden` clipping or move it to the scroller so nothing is
  silently cut.
- Ensure the header and body scroll together if any horizontal scroll remains.
- Keep touch targets at least 44px on the day cells or the event links.
- Verify orientation change and both themes, since today's marker and event
  tags change with UI-003.

Done check: `npm run e2e:gate`, plus mobile viewport specs in
`e2e/specs/calendar.spec.ts` (Playwright phone viewport) asserting: all seven
columns visible, header cell left edges equal the day cell left edges, and
Saturday visible without horizontal scroll.

### UI-019 Mobile Page Toolbars

Issue: on phones the shared page toolbars wrap instead of stacking, and the
wrapped rows keep desktop alignment. `.page-toolbar` is `flex-wrap: wrap`
with `justify-content` inherited per cluster, and the tools cluster is
`justify-content: flex-end` (`page-toolbar.component.scss:10-14`, `:61-68`).
At `max-width: 600px` only `flex-basis: 100%` is applied
(`:116-129`), so the tools row drops below the title but stays pushed right.

Target mobile behavior: one vertical stack, every group full width, all
content flush left.

Changes:

- `.page-toolbar` under 600px: `flex-direction: column; align-items: stretch;
  row-gap: 8px`.
- `.page-toolbar-left` and `.page-toolbar-title`: full width, left aligned.
- `.page-toolbar-content`: `justify-content: flex-start`, `width: 100%`,
  keep `flex-wrap: wrap` so multiple actions wrap from the left.
- Keep the 44px icon-button touch target rule.
- Same treatment for the admin filter row: `.admin-filter-bar` becomes a
  column with `align-items: stretch`, and `.admin-filter-actions`
  (`admin-data.scss:135-160`) drops `margin-left: auto` and right alignment,
  using `justify-content: flex-start` and `flex: 1 1 100%`.
- Do not stretch buttons edge to edge unless a page already does. Left-aligned
  content within a full-width row.
- Audit page-level toolbars that do not use the shared component, such as the
  calendar toolbar row (`calendar.component.scss:270-310` already stacks, but
  confirm alignment).

Done check: `npm run e2e:gate`, plus mobile viewport specs asserting the
toolbar children are stacked and their left edges match the toolbar's content
box. Cover admin list pages, People, Calendar, and Photos.

### UI-020 User-Facing Video Playback And Share Button

Two issues on `/media/video`.

**A. Videos never play.**

Selection and rendering path:

- `MediaVideoComponent` wraps `app-media-explorer` with the video type
  (`media-video.component.html:2-5`).
- `media-explorer.component.html:45-68` chooses the player: a Google Drive
  iframe when the URL starts with `https://drive.google.com/`
  (`isExternalDriveUrl`, `media-explorer.component.ts:181-185`), otherwise a
  native `<video controls preload="metadata" [src]="selectedMedia.urls.download">`.
- `VideoPlayerDriveIframeComponent` sets the raw URL as the iframe src
  (`video-player-drive-iframe.component.ts:51-53`).
- Uploaded videos get a CloudFront/S3 URL from
  `functions/src/finalize-media-upload.ts:433-435` and
  `mediaUrl` (`functions/src/media/naming.ts:118-120`).

Investigate in this order, in the browser with DevTools Network open:

1. Real URL shape per record. Report `urls.download` for a failing video.
2. If it is a Drive URL: `/view` links refuse to frame. Only `/preview`
   embeds. Normalize `file/d/<id>/(view|edit|...)` to `/preview` in the iframe
   component and handle docs.google.com/open?id=. Also confirm the file is
   shared "Anyone with the link".
3. If it is a CloudFront/S3 URL: check the response `Content-Type` (must be
   `video/mp4`, not `application/octet-stream`), CORS headers, and range
   support (206). A wrong content type gives exactly the "loads but will not
   play" symptom. Fix the upload path's `ContentType` and re-upload.
4. If it is a Firebase Storage emulator URL: confirm the emulator serves
   range requests and the object actually exists.
5. Check codec: `.mov`/HEVC fails in Chromium. Normalize to H.264 mp4.
6. Add an error handler on the `<video>` element that surfaces a real message
   instead of a silent black player (`error` event, `MEDIA_ERR_SRC_NOT_SUPPORTED`,
   etc.).

**B. Share button placement.**

Current: the Share button (and Download) sit in
`.media-explorer-actions-container` above the player
(`media-explorer.component.html:12-37`), centered, with a 120px minimum width
and 36px height (`media-explorer.component.scss:18-32`). There is also a stale
`.share-video-to-clipboard` absolute top-right style in
`video-player-drive-iframe.component.scss:27-35` that is no longer used;
remove it.

Target: below the video, right-aligned, visibly smaller. Concretely:

- Move `.media-explorer-actions-container` after the player markup, set
  `justify-content: flex-end`, remove `min-width: 120px`, and shrink to a
  compact text button or an icon button with a short label.
- Keep Download and Share grouped, with Share at the far right.
- On mobile, keep it below the video and full-width-right aligned per UI-019.
- Preserve the existing clipboard behavior and the tooltip.

Done check: `npm run e2e:gate`, plus a media spec that selects a video and
asserts it reaches `readyState >= 2` (or emits `loadedmetadata` /
`canplay`), and that the Share control renders after the player and is
right-aligned.

### UI-021 Music Download And Share Placement

Same shared surface as UI-020: `MediaAudioComponent` wraps the same
`app-media-explorer` (`media-audio.component.html:2-5`), so the action row is
the same `.media-explorer-actions-container` rendered above the player
(`media-explorer.component.html:12-43`). On Music it currently floats above
the album art, centered, which reads as detached from the player controls.

Do this as one change with UI-020, not a separate style fork:

- Render the actions block after the active media panel (video, audio,
  document, photo album), so it sits below the player on every media type.
- Right-align it, shrink the controls to compact text or icon buttons, and
  remove the 120px minimum width (`media-explorer.component.scss:18-32`).
- On Music specifically: Download then Share, Share far right, tucked under
  the audio player's track list. Never above the album art.
- Keep the clipboard behavior and tooltip from
  `onGetShareableLink()` (`media-explorer.component.ts:111-135`).
- Check the empty/no-selection state still hides the row.

Done check: `npm run e2e:gate`, plus a music spec asserting the Share
control renders after the audio player and is right-aligned, and that the
video placement from UI-020 matches.

### UI-022 Icon Banner Alignment

Site from the screenshot: `admin-family-explorer.component.html:9-12`.

```
@if (actionError) {
  <div class="admin-error" role="alert">
    <mat-icon>error_outline</mat-icon>
    {{ actionError }}
  </div>
}
```

Cause: `.admin-error` (`src/app/styles/admin-data.scss:40-48`) is a plain block
with `padding`, `border-left`, and no flex layout. The `<mat-icon>` is an
inline material glyph, so its box and the text baseline do not line up, which
is what shows as the icon floating high and the text sitting low.

Fix in the shared class, not per page:

```
.admin-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.admin-error mat-icon {
  flex: 0 0 auto;
  font-size: 20px;
  width: 20px;
  height: 20px;
  line-height: 20px;
  margin-top: 1px;
}
```

`align-items: flex-start` keeps a multi-line message tidy; a one-line message
still centers visually thanks to the 1px nudge and the 20px glyph. If a
single-line centered look is preferred, use `align-items: center` and accept
that a long wrapped message has the icon near the first line.

Audit every sibling notice for the same pattern and give them one shared shape:

- `.admin-success` (`admin-data.scss:50-60`) is already flex, verify the icon
  spacing matches.
- `.auth-banner` (`auth.component.scss:106-133`) is already flex at
  `align-items: flex-start`.
- `LvLoadErrorComponent` inline template (`.lv-load-error`) has no icon, but
  confirm the retry button aligns on wrap.
- Every `.admin-error` usage with a `<mat-icon>`:
  `admin-calendars.component.html:21,92`,
  `admin-families.component.html:21,227`,
  `admin-family-explorer.component.html:10,113`,
  `admin-media-upload-video`, `admin-media-upload-audio-album`,
  `admin-songs`, `admin-users`, `admin-analytics`, `admin-features`.
  Text-only usages must still look right with the flex class.
- `app-no-results-message` already uses a structured icon column; leave it.

Also check the dark mode rendering from the screenshot, where the low-contrast
red tint makes the misalignment more obvious.

Done check: `npm run e2e:gate`, plus a visual or computed-style assertion that
the icon and text share a vertical center within a few pixels in both themes.

### UI-023 Admin Expressions Stuck Skeleton

The Admin route renders the shared `ExpressionsComponent`
(`admin.module.ts:78-81`), so this also affects the user-facing page.

Symptom: with zero expressions, `isLoading` never flips false and the skeleton
in `expressions.component.html:79-100` runs forever. The empty state exists at
`:136-142` but is unreachable.

Suspected cause: the seed-skip in `MessageComponent`
(`message.component.ts:58-68`). It declares `let isSeed = true` per
subscription and drops the first emission if it is empty. `subscribeMessagesObservable`
is re-run on every `authService.userObservable` emission (`:54-56`), and the
`MessageService` source is a `BehaviorSubject([])` that replays its current
value (`message.service.ts:25-26`). When the store is empty, a resubscription
replays `[]`, it is mistaken for the seed and dropped, and no later emission
arrives to clear `isLoading`. With any message present the first replay is
non-empty, so the bug hides.

Also note `ExpressionsComponent` declares its own `isLoading`
(`expressions.component.ts:19`) while the base class uses `loading`, and
`retry()` resets only the base field (`message.component.ts:70-75`). That
split is worth removing.

Fix direction:

- Stop inferring "seed" from an empty emission on the consumer side. Give
  `MessageService` an explicit loaded signal (a `messagesLoaded$` or a
  `hasLoaded` flag, or switch to `ReplaySubject(1)` like `MediaService`), and
  have `MessageComponent` clear loading only when that signal says the first
  real read completed, empty or not.
- Unify to one loading field.
- Add unit and e2e coverage for the zero-messages case: the empty state shows,
  the skeleton is gone, and a retry after an error recovers.

Audit the other Admin components for the same class of bug: a skeleton or
`status === 'loading'` that only clears on a non-empty emission. Check each
loading path:

- `admin-calendars` (`valueChanges` direct, empty emits `[]`, likely fine).
- `admin-songs` (`songs$` + explicit loaded flag, verify empty).
- `admin-photo-albums` (null seed from the service, verify empty).
- `admin-families` (`familiesStatus$`, verify empty).
- `admin-users`, `admin-analytics`, `admin-recovery`, `admin-user-uploads`,
  `admin-media`, `admin-family-explorer`, `admin-people-import`.
- Shared: `MessageComponent` consumers (expressions, chat),
  `contacts` (`seedEmpty` flags), `people`, `calendar`
  (`eventsLoaded` guard), `media-list`.
- Verify each shows an empty state and never a permanent skeleton when its
  collection is empty.

Done check: `npm run e2e:gate` plus one e2e or unit case per audited
component for the empty-collection state.

### UI-024 Video Drop-Zone Copy

Current copy at `admin-media-upload-video.component.html:21`:

```
<span class="media-drop-zone-hint">Drop an MP4 here or choose a file.</span>
```

Change to the requested wording: `Drag/Drop an mp4 here, or click to select a
file`.

Keep the block clickable (it wraps a hidden file input, `:24-33`). Check the
same drop-zone pattern in the audio upload and photo import for copy
consistency, but do not change those unless they read inconsistently.

Done check: `npm run e2e:gate` and an assertion on the new hint text.

### UI-025 S3 Path Container Radius

Site: `.media-path-preview` in
`admin-media-upload-video.component.scss:86-96`. It uses
`border-radius: var(--radius-control)`, which is `999px`
(`styles.scss:141`), so the read-only path box renders as a pill, as in the
screenshot.

Use a smaller corner token instead. `--radius-sm` (8px) matches other
informational insets and thumbnails (`styles.scss:142`); `--radius-card`
(16px) is the surface radius if the box should read as a card. Recommendation:
`--radius-sm`.

Audit other non-interactive boxes that misapply `--radius-control`: it is
meant for buttons and inputs, not display panels. Grep for
`radius-control` across component styles and fix any read-only panel.

Done check: `npm run e2e:gate` and a computed-style assertion or screenshot
check on the path box.

### UI-026 Checkboxes To Switches

Scope: every `mat-checkbox` and native `type="checkbox"` in user-visible UI
becomes the app's single switch control. 36 occurrences across 11 files.

| File | Count | What they are | Switch? |
|---|---|---|---|
| `admin-media-upload-video` | 6 | Replace file, sticky, hide, plus form flags | Yes |
| `admin-media-upload-audio-album` | 6 | Own zip, sticky, hide, album flags | Yes |
| `user-edit` | 6 | user/admin/super role grants | Yes |
| `calendar` | 4 | Birthdays, anniversaries, deceased, holidays filters | Yes, as switch rows |
| `calendar-print` | 5 | Same filters for print output | Yes, as switch rows |
| `admin-recovery` | 2 | Email alternate contact | Yes |
| `admin-family-explorer` | 1 | Published | Yes |
| `admin-photo-albums` | 1 | Year is circa | Yes |
| `chat-edit` | 1 | Sticky | Yes |
| `photos-legacy` | 2 | Year is circa | Yes |
| `media-types-checkboxes` | 2 | Type filter list | Yes, as switch rows per type |

Control: use `mat-slide-toggle`, the component already used in
`admin-features.component.html:78-87` and
`admin-family-explorer.component.html:48-54`, and the custom
`role="switch"` pattern in `auth.component.html:100`. Pick one: standardize on
`mat-slide-toggle` for all data-bound booleans, and align its theme to the
palette.

UX details that make it feel smooth:

- Whole label is clickable, not just the thumb.
- Minimum 44px touch target, visible focus ring, and `role="switch"` with
  `aria-checked` handled by the component.
- Optimistic toggle: flip the model immediately, show a brief inline saving
  state, and roll back with an error if the write fails. Do not leave a switch
  visually on while the server says off.
- 150 to 200ms thumb transition, disabled state clearly dimmed, and respect
  `prefers-reduced-motion`.
- Consistent row layout for groups: label left, switch right, optional
  supporting line under the label. Calendar and print filters become a tidy
  stack of switch rows, not a wrapped inline cluster.
- Keep `color="primary"` so the on-state uses the brand emerald from UI-001.
- Do not switch multi-select contexts that are genuinely "select these rows":
  bulk selection of records stays a checkbox. No such bulk selection exists in
  the current grep, but keep the rule if it appears.

Accessibility and tests:

- `mat-slide-toggle` exposes `role="switch"`. Update every e2e and unit spec
  that queried `mat-checkbox` or `input[type=checkbox]`, including
  `calendar.spec.ts`, `calendar-print` tests, `admin-content.spec.ts`,
  `admin-system.spec.ts`, `platform.spec.ts` if present, and any
  `data-testid` selectors that assumed a checkbox.
- Keyboard: Space toggles, Tab reaches every switch, and focus order matches
  the visual row order.
- Verify in light and dark, and on mobile for tap-target size.

Done check: `npm run e2e:gate` and a grep proving no `mat-checkbox` remains in
`src/app/**/*.html` except any intentionally retained bulk-selection control.

### UI-027 Admin Sidebar Version Alignment And Source

**Alignment.** Markup at `admin.component.html:40-42`:

```
<div class="sidebar-footer">
  <span class="version">v{{ version }}</span>
</div>
```

`.sidebar-footer` (`admin.component.scss:158-166`) has only padding and a top
border, so the span defaults left. Right-align it:

```
.sidebar-footer {
  display: flex;
  justify-content: flex-end;
}
```

Keep the existing font size and muted color. Check the mobile drawer variant at
`admin.component.scss:268-270`.

**Source of the number, and why it is stale.** It is not fetched from the
deploy. `VersionService.getAppVersion()` imports `package.json` at build time
(`version.service.ts:13-16`, `resolveJsonModule` in `tsconfig.json:19`).
`package.json` currently says `24.3.17`, and nothing updates it:
`scripts/deploy.sh` only runs `tag_build`, which tags with
`date +%y.%m.%d` and pushes that tag (`deploy.sh`, `tag_build`). No
`npm version`, no CI workflow, and no step writes the version back into
`package.json`. That is why the sidebar shows a very old number while the
repo has date tags up to `26.5.17`.

Fix options, pick one:

1. **Build-stamp file (recommended).** Have `deploy.sh` write a gitignored
   `src/environments/build-info.ts` (or a JSON) containing the release
   version and short SHA before `ng build`, and have `VersionService` read
   that first, falling back to `package.json` in local dev. Keeps deploy as
   the source of truth and does not require committing a version bump.
2. **Bump package.json in deploy.** Before build, compute a date version
   without leading zeros (for example `26.5.17`) and run
   `npm version <v> --no-git-tag-version`, then build. Simple, but the file
   churns on every deploy and must be committed or it re-bumps each time.
3. **Use the git tag directly.** Generate the version from `git describe
   --tags --always` at build time. Closest to the existing date tags, but a
   build without a tag needs a sensible fallback.

Whatever is chosen, align the naming: today the tag is `26.5.17` and the
displayed string is `v24.3.17`, so the tag should be the same token the UI
shows. Also confirm dev and prod both stamp the build.

Tests: `admin.spec.ts:217-223` asserts the footer text matches
`/^v\d+\.\d+\.\d+/`, so keep a semver-shaped version or update the matcher.
Add a check that the stamped version equals the deploy tag.

### UI-028 Admin/Users Role Order And Naming

Target display order, lowest privilege first: Member, Content Admin, Super.

Current state:

- Role badges in the Users table come from `userRoles()`
  (`admin-users.component.ts:141-149`), which currently returns
  `Content Admin, Super, Member`. Reorder to `Member, Content Admin, Super`.
- `roleSummary()` (`:166-173`) already defaults to "Member" and reports
  admin/super only. Fine.
- The role editor (`user-edit.component.html:99-120`) shows checkboxes in the
  order User, Content Admin, Super. Keep the order but rename the first label
  from `User` to `Member`. The bound key stays `roles.user`, since it is a
  data contract used by rules and guards.
- `user-view.component.html:8-16` renders the account badge as `User`. Rename
  it to `Member` for consistency across the app, in the same order.

Toggle interaction: UI-026 converts these checkboxes to switches. Keep the
existing privilege rules intact when doing so: checking Super forces Content
Admin on (`user-edit.component.ts:66-80`), and the Content Admin control is
disabled while Super is on. Display order is Member, Content Admin, Super in
both the editor and the badges.

Tests that assert the old order or label:

- `admin-users.component.spec.ts:146` expects
  `['Content Admin', 'Super', 'Member']`.
- `admin-users.component.spec.ts:173-181` and `:408` assert badge text/class.
- `admin-roles.spec.ts:141` and `:155` expect `.account-role` text
  `['User', 'Content Admin']` and `['User', 'Content Admin', 'Super']`.
- `user-view.component.spec.ts:85-110`.
Update them to the new order and "Member".

Done check: `npm run e2e:gate` plus an admin spec asserting the badge order
and the editor's switch order.

### UI-029 Approved And Pending Promoted Routes

Goal: Admin/Features manages two landing routes, one for approved members and
one for pending (not-yet-approved) members. The pending control sits below the
approved control and lacks the approved-only options.

**Domain naming.** The codebase already uses "approved" and "pending", not
"verified":

- `isApprovedUser()` (`src/app/models/user.ts:22-26`).
- `ApprovedGuardService` (`src/app/services/approved-guard.service.ts`).
- The pending banner text (`app.component.html:99-102`).
- `isPending()` = signed in and not approved (`app.component.ts:132-134`).

So the admin labels should be "Approved Users" and "Pending Users". Do not
introduce "verified" or "unverified" anywhere user-facing or in code.

**Current behavior:**

- One promoted route, `promotedRoute` `{ route, updatedAt }` in RTDB
  (`feature-flags.service.ts:81-92`).
- `RoutingService` loads it and `getPromotedRoute()` returns it, rejecting
  `/admin` and `/` (`routing.service.ts:21-63`).
- The root-route bounce uses it for any signed-in user
  (`app.component.ts:120-122`), so a pending user is sent to the same landing
  page as an approved member, even though approval gating hides
  `/people`, `/contacts`, and `/calendar` (`navbar-links.component.ts:32-34`).
- Admin/Features renders one select, "Default Landing Page"
  (`admin-features.component.html:18-38`).

**Work:**

- Data: add `promotedRoutePending` as a sibling node, same `{ route,
  updatedAt }` shape. Do not restructure `promotedRoute` unless a migration is
  worth it.
- `FeatureFlagsService`: `getPendingPromotedRoute()` /
  `setPendingPromotedRoute()`, and include the new field in the audit record
  type (`FeatureFlagAuditField` currently `enabled | promotedRoute`).
- `RoutingService`: `getPromotedRoute(approved: boolean)` returns the matching
  route. Callers pass status: the root bounce uses `this.isApproved()`
  (`app.component.ts:120-122`), and the sign-in redirect in
  `auth.service.ts:216` passes `isApprovedUser(user)`.
- Validation: the pending route must point at a route pending users can
  actually reach. Approved-only routes are PII and planning surfaces:
  `/people`, `/contacts`, `/calendar`, plus `/admin`. Allowed pending options:
  `/photos`, `/media/video`, `/media/audio` (Music), `/expressions`, `/account`,
  and the upload page if it is reachable. Reject and fall back otherwise, with
  a visible warning like the existing promoted-route warning.
- Environment: add `promotedRoutePending` to `environment.ts`,
  `environment.prod.ts`, and `environment.e2e.ts`. Pick a safe default such as
  `/photos` or `/expressions`; `/calendar` is not safe for pending.
- Admin/Features markup: two selects in the same card. First "Approved Users
  Landing Page" with all feature routes. Second, directly below, "Pending Users
  Landing Page" with the restricted option set, visually secondary (caption
  explaining that pending users cannot view PII).
- Audit history: record which route changed.

**Open decisions:**

1. Node shape: separate `promotedRoutePending`, or a nested
   `promotedRoutes: { approved, pending }` with a migration.
2. Allowed pending routes: confirm the exact set; the navbar gate is the
   source of truth.
3. Whether pending users should land on a dedicated "pending" page explaining
   the wait instead of a feature route.

Tests:

- `feature-flags.spec.ts`, `admin-system.spec.ts`, and `nav.spec.ts` cover
  promoted routes and will need the second control.
- Add a pending-user e2e: sign in as a pending user at `/` and assert the
  redirect goes to the pending route, not the approved one.
- Update `routing.service.spec.ts` for the new signature and fallbacks.

Done check: `npm run e2e:gate` plus an approved-vs-pending redirect spec.

### UI-030 Recovery Nav Badge Counts Outstanding

A badge mechanism already exists and is wired:

- `AdminBadgeService.openRecoveryRequests()` queries `recoveryRequests` where
  `status === 'open'` (`admin-badge.service.ts:20-22`).
- `AdminComponent.watchBadges()` subscribes and renders it on the sidebar item
  (`admin.component.ts:83-105`, `admin.component.html:19-26`).
- The render path, `data-testid="admin-nav-badge-recovery"`, failure `!`
  state, and 99+ cap all work.
- The `recoveryRequests` node is indexed on `status`
  (`database.rules.json:226-230`).

The gap: `open` is not the only outstanding state. The server sets a request
to `pending` when a reset link is generated but it is not yet resolved or
closed (`functions/src/admin-generate-reset-link.ts:117`), and terminal states
are `resolved` and `closed` (`admin-recovery.component.ts:341-346`). Fresh
requests start at `open` (`functions/src/submit-recovery-request.ts:205`). So a
request sitting in `pending` is outstanding but produces no badge.

Fix:

- Count outstanding = every request whose status is not `resolved` and not
  `closed`. Because RTDB has no "not equal" index, either sum two indexed
  queries (`open` + `pending`) client-side with `combineLatest`, or fetch the
  node once and filter (it is super-only and small). Prefer the two-query sum
  so the index stays useful and the payload stays small.
- Rename the method to `outstandingRecoveryRequests()` and the accessible label
  from "open" to "outstanding" (`admin.component.ts:120, 133-134`).
- Keep the failure `!` behavior and the zero-hide behavior.

Tests: `admin.spec.ts` and any badge spec should cover an `open` request, a
`pending` request, a `resolved` request (no badge), and the error state.

Done check: `npm run e2e:gate` plus a badge spec seeded with one request in
each status.

### UI-031 Badge Palette Colors

Attention and count badges should use the brand emerald, matching the top bar.
Semantic badges keep the semantic tone (error stays error, warning stays
warn), but every tone comes from the palette.

Audit of every badge in the app:

| Badge | Where | Current | Target |
|---|---|---|---|
| `.nav-badge` | `admin.component.scss:123-139` | `--color-brand-solid` + `--color-on-brand` | Already correct. The color looks off only because `--color-brand-solid` is the old green, fixed by UI-001. Verify after that lands. |
| `.nav-badge-error` | `admin.component.scss:140-142` | `--color-error` | Keep. Semantic failure state. |
| `.role-badge` / `-admin` / `-super` | `admin-users.component.scss:20-40`, tokens at `styles.scss:120-125` and `:179-184` | Hardcoded grey/indigo/purple (`#ECEFF1`, `#E8EAF6`, `#F3E5F5`, and dark variants) | Move to palette tokens. Member = neutral surface-muted, Content Admin = brand success/primary tint, Super = brand solid or the darkest brand tone. Keep three distinguishable treatments and AA contrast. |
| `.account-role` | `user-view.component.scss:42-48` | brand-primary 10% tint + brand-primary-dark text | Fine, align to the retuned brand. |
| `.count-badge` error/warning | `admin-people-import.component.scss:118-160, 256-262` | error, accent-strong, surface-muted | Keep semantic, source from the retuned error/warn tokens. |
| `.event-type.badge` | `person-detail-modal.component.scss:150-162` | birth/anniv colors | Covered by UI-003 calendar palette. |

Implementation notes:

- Add any missing badge-specific tokens to `src/styles.scss` (for example a
  `--badge-brand-bg` / `--badge-brand-fg` pair) instead of hardcoding hex in
  component styles. Keeps the UI-009 consolidation contract.
- Verify contrast for each badge in light and dark: `--color-on-brand` on the
  brand fill, and the role badge foregrounds on their tints.
- Do not rely on color alone for status. Role badges already carry text. If a
  notification badge becomes green, keep the count and accessible label.

Done check: `npm run e2e:gate` plus a grep proving no hardcoded badge hex
remains outside `src/styles.scss`, and a light/dark visual check of the admin
sidebar, Users table, and import validation cards.

## Unsorted

Empty.

