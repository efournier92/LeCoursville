# Critique Ledger: Dev Site Holistic Review

- Goal: capture the owner's holistic review feedback on the dev build in this session, then apply every accepted item as one batch on a dedicated branch.
- Started: 2026-10-25
- Target: deployed dev channel `https://lecoursville-dev.web.app/` (Firebase project `lecoursville-dev`)
- Version proof: deployed `/main.js` sha256 `1f2484137c1ce00617ac5114f32f7eb02e5da702410fbf6d788edfd6873ea5fb` is byte-identical to the local `dist/lecoursville/browser/main.js` built at 14:46 today; hosting `last-modified` 2026-10-25 18:56 GMT. Deployed dev equals `master` at `6f3f9266`.
- Batch branch: `fine-tuning-2026-10-25`, cut from `master` at `6f3f9266`
- Status: review closed 2026-10-25, spec approved, implementation pending

## Review Surface

Feature-flagged routes resolve through `FeatureFlagGuard`; a disabled flag redirects to `/feature-disabled`. Admin resolves through `AuthAdminGuardService` plus `SuperAdminGuard`.

| Route | Component | Guard / flag |
|---|---|---|
| `/` | `AuthComponent` | public |
| `/contacts`, `/contacts/:id` | `ContactsComponent` | auth plus `contacts` |
| `/calendar` | `CalendarFeatureModule` (lazy) | auth plus `calendar` |
| `/chat` | `ChatComponent` | auth plus `chat` |
| `/expressions` | `ExpressionsComponent` | auth plus `expressions` |
| `/photos` | `PhotoShellComponent` | auth plus `photos` |
| `/photos/:albumId` | `PhotoAlbumDetailComponent` | auth, `photos`, `PhotoAlbumsFeatureGuard` |
| `/photos/:albumId/slideshow` | `PhotoSlideshowComponent` | auth, `photos`, `PhotoAlbumsFeatureGuard` |
| `/people` | `PeopleComponent` | auth plus `people` |
| `/media` | `MediaFeatureModule` (lazy) | public reads, admin writes |
| `/admin` | `AdminModule` (lazy) | admin plus super admin |
| `/admin/media`, `/admin/photo-albums`, `/admin/users`, `/admin/features`, `/admin/people`, `/admin/families`, `/admin/calendars`, `/admin/uploads`, `/admin/recovery` | admin pages | admin plus super admin |
| `/upload` | `PublicUploadComponent` | public |
| `/auth/action` | `AuthActionComponent` | public |
| `/feature-disabled` | `FeatureDisabledComponent` | public |
| `**` | `AuthComponent` | fallback |
## Findings

Format: `ID | date | area | severity | impact | status | finding | location or repro`

- F-20261025-01 | 2026-10-25 | visual | medium | high | open | Month-view event tags read as dark gray and lost their type hues. The 2026 facelift moved birthdays from blue `#3182ce` to brand green `--color-brand-primary` `#2D5A27` and anniversaries from red `#e53e3e` to honey `--color-accent-strong` `#9C6B26`, and moved the tag fill from near-white `#fafbfc` to `--color-surface-muted` `#EBEDF0`. Owner wants the old blue/red coding back, one shade darker than the old values, with a lighter fill. | `src/app/components/calendar-cell/calendar-cell.component.scss:5` (`.calendar-cell-event-container`, `.border-birth`, `.border-anniv`, `.birthday-color`, `.anniversary-color`), tokens `src/styles.scss:68`, `src/styles.scss:72`, `src/styles.scss:79`
- F-20261025-02 | 2026-10-25 | visual | low | medium | open | Event tags sit flush against the left edge of the month-view day cell. They need a slight inset so the tag clears the cell border as a floating chip. Cause: `.calendar-cell-event-container` is `width: 100%` with no inline margin, inside `.cal-events-container`. | `src/app/components/calendar-cell/calendar-cell.component.scss:5` (`.calendar-cell-event-container`), parent `src/app/components/calendar-view/calendar-view.component.html:17`
- F-20261025-03 | 2026-10-25 | ux | medium | high | open | The month/year picker stays open until a month is clicked, so a user who opened it by accident is stuck inside it. It should dismiss on an outside click (and Escape, matching the app's other dismissable surfaces). Evidence: the only write of `datePickerOpen = false` after opening is in `selectPickerMonth`; the pill only toggles it. | `src/app/components/calendar/calendar.component.ts:40` (`datePickerOpen`), `src/app/components/calendar/calendar.component.ts:178` (`selectPickerMonth`), `src/app/components/calendar/calendar.component.html:44` (pill click toggles the flag), dropdown markup `src/app/components/calendar/calendar.component.html:61`
- F-20261025-04 | 2026-10-25 | visual | low | medium | open | The month nav row (previous arrow, month/year pill, next arrow) needs vertical breathing room above it equal to the space below the calendar grid: currently the row has no top margin and the calendar's bottom spacing comes from the page column padding, so the row reads cramped against the toolbar. Owner wording: same margin above the picker row as below the calendar. | `src/app/components/calendar/calendar.component.scss:68` (`.calendar-nav-row`, `margin: 0 0 10px`), bottom spacing `src/styles.scss:336` (`.page-content`, `padding: 0 16px 24px`; 16px on mobile at `:341`)
- F-20261025-05 | 2026-10-25 | visual | medium | high | open | The Print Calendar dialog is cramped: it needs substantially more space around its edges so the content breathes. It currently gets Material's default dialog padding plus a thin inner padding, and the year buttons and action row sit tight to the panel. | `src/app/components/calendar-printer/calendar-printer.component.scss:1` (`.calendar-printer-container`, `padding: 8px 0`), header `:5`, body `:17` (`.calendar-printer-body`, `padding: 0 4px`), opened as a plain `MatDialog` at `src/app/components/calendar/calendar.component.ts:231`
- F-20261025-06 | 2026-10-25 | visual | medium | high | open | The dialog's action button (`Print <year>`) reads as a passive gray control, not a call to action. It should carry the primary treatment already used by the calendar toolbar Print button (brand fill, white label). | `src/app/components/calendar-printer/calendar-printer.component.scss:63` (`.calendar-printer-action-btn`, gray surface fill), reference treatment `src/app/components/calendar/calendar.component.scss:37` (`.calendar-print-button`)
- F-20261025-07 | 2026-10-25 | visual | medium | high | open | People surfaces fill the whole row gray on hover. Owner wants no gray hover fill: hovering a person should only underline the name, so the affordance is the name, not a block highlight. Two spots carry the gray fill: the people tree row and the person detail lineage row. The tree row already underlines the name via `.person-name.clickable:hover`, so it only needs the row fill removed plus its now-unused background transition; the lineage row needs the fill removed and an underline added to its name. | `src/app/components/people/people.component.scss:78` (`.tree-row`, transition at `:82`, hover fill at `:86`), `src/app/components/person-detail-modal/person-detail-modal.component.scss:189` (`.lineage-person-row`, hover fill at `:197`, name rule at `:199`)
- F-20261025-08 | 2026-10-25 | visual | high | high | clarified | SUPERSEDED BY F-20261025-16. The owner clarified on 2026-10-25 that the target is the white page-title bar (`app-page-toolbar`) present on most pages, not the green app bar. The green `mat-toolbar` is OUT OF SCOPE for this batch. Any interpretation involving margins on the app shell, `--header-height`, or admin shell height is withdrawn. | see F-20261025-16
- F-20261025-09 | 2026-10-25 | ux | high | high | open | The person modal shows a Contact card for deceased people whenever they carry address, phone, or email data. A deceased person should never show Contact. In its place the modal should show a date of death when one exists and omit the row entirely when it does not. The Contact card is currently data-driven only, with no living check. | `src/app/components/person-detail-modal/person-detail-modal.component.html:63` (Contact card condition), person fields `src/app/models/person.ts:16` (no death date on `Person`), age computation `src/app/components/person-detail-modal/person-detail-modal.component.ts:361` (`calculateAge` uses today, not a death date)
- F-20261025-10 | 2026-10-25 | visual | low | medium | open | The close X in the person modal sits off-centre inside its icon button, and the owner expects the same defect anywhere that glyph renders. Close buttons carry no centering rule of their own, so they inherit the global icon typography, which is the likely common cause across all render sites. | `src/app/components/person-detail-modal/person-detail-modal.component.html:14` (close `mat-icon-button`), `src/app/components/person-detail-modal/person-detail-modal.component.scss:63` (`.close-button` sets only opacity, alignment, and margins), global icon typography `src/styles.scss:42` (`.material-icons`, `line-height: 1`)
- F-20261025-11 | 2026-10-25 | visual | high | high | open | The audio album play bar is the browser's native `<audio controls>` element inside a styled card, so its appearance is decided by the engine: acceptable in Chrome, poor in Firefox, and worse under a dark OS theme. The owner wants one consistently good play bar across browsers. The wrapper card is styled, the controls are not. | `src/app/components/audio-player/audio-player.component.html:27` (native `<audio controls autoplay>`), wrapper styles `src/app/components/audio-player/audio-player.component.scss:20` (`.audio-player-native`), light colour scheme declared at `src/styles.scss:58` (`html { color-scheme: light }`)
- F-20261025-12 | 2026-10-25 | visual | medium | high | open | Media card thumbnails are clipped by rounded corners. Thumbnails should be square so the image content is not shaved at the corners. Both the thumbnail frame and the image inside it carry the small radius. | `src/app/components/media-list/media-list.component.scss:83` (`.imageContainer`, `border-radius: var(--radius-sm)`), `:100` (`.imageCenterer img`), plus the admin-mode overrides at `:147` and `:161`
- F-20261025-13 | 2026-10-25 | ux | medium | high | open | Admin must not appear in the main toolbar. The only way into admin should be clicking the logo at the top left, and that entry point should work for admins only. Today a super admin gets an `Admin` nav button in both the desktop nav and the mobile menu, while the logo already routes super admins to `/admin`. | `src/app/components/navbar-links/navbar-links.component.html:32` (desktop Admin button), `:61` (mobile menu Admin item), logo handler `src/app/app.component.html:7` plus `src/app/app.component.ts:87` (`onLogoClick`), routing rule `src/app/services/routing.service.ts:98` (`handleLogoNavigation`)
- F-20261025-14 | 2026-10-25 | visual | high | high | open | The admin media upload page is not visually appealing and needs a UX-level rethink, not a spacing pass. Today it is a toolbar, one intro line, and two tabs whose panels are single-column walls of form fields: file dropzone, title, date, storage name, S3 path preview, icon controls, and action rows stacked with equal weight, and no visible sequence or grouping. Technical plumbing (storage name, S3 keys) sits at the same level as the primary task. | `src/app/components/admin-media/admin-media.component.html:7` (tab shell), video panel `src/app/components/admin-media-upload-video/admin-media-upload-video.component.html:2` (351-line template), audio panel `src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component.html` (265-line template), surface conventions `src/app/components/admin-media/admin-media.component.scss`
- F-20261025-15 | 2026-10-25 | visual | medium | high | open | The admin Photo Albums grid renders album cards far too large: three across at desktop width, with a square cover, so each card runs several hundred pixels tall and only a handful fit on screen. The owner wants four or five per row on a big screen and asked for a UX-level rethink of the density rather than a one-number bump. | `src/app/components/admin-photo-albums/admin-photo-albums.component.scss:66` (`.admin-album-grid`, `repeat(3, minmax(0, 1fr))`), breakpoints at `:134` (2 columns under 992px) and `:140` (1 column under 600px), square cover `:155` (`.album-cover`, `aspect-ratio: 1 / 1`)
- F-20261025-16 | 2026-10-25 | visual | high | high | decided | The white page-title bar (`app-page-toolbar`) does not match the surfaces under it: they render as a flat full-width chrome bar with a hairline bottom edge and square corners, while every card below is a rounded surface. The owner wants rounded card edges to match, plus one consistent gap between a toolbar and the cards beneath it, treated as a UX pass rather than a corner tweak. The gap is currently per-page, not shared. | `src/app/components/shared/page-toolbar/page-toolbar.component.scss:8` (`.page-toolbar`, no radius, `border-bottom` hairline), per-page gap drift `src/app/components/admin-users/admin-users.component.scss:43` (`4px`), `src/app/components/admin-features/admin-features.component.scss:8` (`8px`), `src/app/components/admin-recovery/admin-recovery.component.scss:99` (`12px`), `src/app/components/admin-users/admin-users.component.scss:54` (`16px`), `src/app/components/admin-features/admin-features.component.scss:19` (`20px`) and `:84` (`24px`)
- F-20261025-17 | 2026-10-25 | visual | medium | high | open | The role badges on the admin Users page use a broken, clashing palette. The Admin badge asks for `--color-accent-soft`, a token that does not exist anywhere in the codebase, so it silently falls back to an indigo tint and pairs it with the brand honey text colour - indigo and amber, low contrast, unrelated to every other surface. Member is plain gray and Super is red, which reads as an error state rather than a privilege level. Owner wants role colours chosen from the Material palette, semantically sensible per role, and pleasant together. | `src/app/components/admin-users/admin-users.component.scss:20` (`.role-badge`), `:32` (`.role-badge-admin`, undefined `--color-accent-soft` fallback), `:37` (`.role-badge-super`, error red), markup `src/app/components/admin-users/admin-users.component.html:113` (`role-badge-<role>` class binding)
- F-20261025-18 | 2026-10-25 | data | high | high | open | The admin Families page reports "No families yet" while the People page filter lists families by name. This is not a copy bug: the app has two independent collections and two services for the same concept. Admin reads and writes the `families` node through `FamilyService`; People, Contacts, the person modal, and the CSV importer read and write the `clans` node through `ClanService`. In dev the `clans` node holds the real data and `families` is empty, so the admin page is blank and edits there are invisible to every feature. | `src/app/services/family.service.ts:10` (`FAMILIES_PATH = 'families'`), `src/app/services/clan.service.ts:10` (`CLANS_PATH = 'clans'`), admin reader `src/app/components/admin-families/admin-families.component.ts:130`, people reader `src/app/components/people/people.component.ts:121`, empty state `src/app/components/admin-families/admin-families.component.html:135`
- F-20261025-19 | 2026-10-25 | data | high | high | decided | Owner wants one canonical word for the family/clan concept across the codebase. The split is real and quantified: every rendered label says Family or Families (By Family, Families nav item, Family detail row, Select Family, No families yet), while nearly all code identifiers and the live RTDB node say clan (`Clan`, `clanId`, `ClanService`, `getClanForPerson`, `clanColorHex`, `clans`). Docs contradict each other and no document defines the difference. | see Notes On F-20261025-19 for the census
- F-20261025-20 | 2026-10-25 | visual | medium | high | open | The video upload thumbnail preview renders in a 16:9 widescreen frame while stored thumbnails are square, so the preview misrepresents what the upload will produce. The preview should be 1:1 to match existing thumbnails, and it should drop its rounded corners, consistent with the no-radius rule for media previews. | `src/app/components/admin-media-upload-video/admin-media-upload-video.component.scss:89` (`.media-thumbnail-preview`, `aspect-ratio: 16 / 9`, `border-radius: var(--radius-input)`), markup `src/app/components/admin-media-upload-video/admin-media-upload-video.component.html:90`; sibling preview `src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component.scss:148` (`.media-cover-preview`, already 1:1 but still rounded)

### Notes On F-20261025-01 And F-20261025-02

- Old palette is Chakra: `blue.500 #3182ce`, `red.500 #e53e3e`, `gray.800 #2d3748`, `gray.400 #a0aec0`. One shade darker reads as `blue.600 #2b6cb0` and `red.600 #c53030`.
- Colors are hardcoded hex in the pre-facelift file and tokenized now; the batch should keep the token approach and add semantic calendar tokens rather than reintroduce literals.
- Only `calendar-cell` colors birth versus anniversary; no other surface encodes the distinction, so the change is contained.
- `e2e/specs/calendar.spec.ts:12` asserts the `.event-anniv` class, not color, so the hue change needs a new style assertion to satisfy the coverage rule.
- Left-edge evidence: `.cal-month-view .cal-cell` carries no padding (`node_modules/angular-calendar/css/angular-calendar.css:24`), so the un-inset `width: 100%` tag starts at the cell border.
- Implementation caveat for the inset: adding an inline margin to a `width: 100%` flex child overflows its parent. Set the tag to `width: auto` (or `width: calc(100% - 2 * inset)`) when adding the margin, and check the widest seeded title, because the cell clips overflow.

### Notes On F-20261025-03 And F-20261025-04

- No click-outside or overlay primitive exists in the app; the two nearest precedents for the Escape path are `src/app/components/admin/admin.component.ts:159` and `src/app/components/photo-slideshow/photo-slideshow.component.ts:172`. Pick one dismissal mechanism for all dropdowns rather than a calendar-only document listener.
- `e2e/specs/calendar.spec.ts` has no datepicker coverage at all (five tests, none touch the pill), so the dismissal behavior ships with a new test there.
- F-20261025-04 reading: the nav row is above the grid and the page column owns 24px below the grid. If the owner instead meant the dropdown panel's offset from the pill, that is `src/app/components/calendar/calendar.component.scss:152` (`margin: 0 0 10px`) and the fix moves there. Confirm at batch time with a rendered check before touching spacing.

### Notes On F-20261025-05 And F-20261025-06

- No global dialog spacing or surface layer exists (`mat-dialog` / `mat-mdc-dialog` has no rule in `src/styles.scss` or `src/app/styles/`), so every dialog currently inherits Material defaults. Decide whether the batch sets a shared dialog padding scale or scopes the change to the printer, because other dialogs (photo album upload, person detail) would then look tighter by comparison.
- The toolbar `Print` button (`calendar.component.scss:37`) is already the filled brand CTA; the dialog button should match it rather than invent a new primary recipe.
- `e2e/specs/calendar.spec.ts:39` already opens the dialog and asserts the title and the year button, so the batch extends that test rather than adding a new one.

### Notes On F-20261025-07

- Admin data tables keep their row hover: that is the admin data-grid convention (`docs/discovery/DISCOVERY.md` D-20261022-03 and the admin consistency contract), and the owner scoped this note to the people surfaces. Do not sweep `admin-*` styles with the same change.
- Family cards hover with a pop shadow, not a gray fill (`src/app/components/people/people.component.scss:40`); leave that as is unless the owner says otherwise.
- Coverage: `e2e/specs/people.spec.ts` exists; the batch adds a hover-state assertion there so the no-gray rule cannot silently regress.

### Notes On F-20261025-08

- Withdrawn scope, recorded so the batch does not touch it: no change to the green app bar, no margin or radius on `mat-toolbar`, no change to `--header-height` (`src/styles.scss:96`), and no change to the admin shell `calc(100vh - var(--header-height))` sizing (`src/app/components/admin/admin.component.scss:5`, `:209`).
- The real target is F-20261025-16: the white page-title bar with the page heading and page actions.
- If the green bar later looks inconsistent against a rounded white bar, that is a separate review item, not part of this batch.

### Notes On F-20261025-09

- The contact-card half is a one-line condition: require `person.isLiving` alongside the existing address/phone/email check. The modal already distinguishes deceased elsewhere, so the flag is reliable.
- The death-date half has no data behind it: `Person` carries `isLiving` only, the CSV importer reads a `Living?` column and no death column (`src/app/components/admin-people-import/admin-people-import.component.ts:192`), and no death field appears anywhere in `src/`, `functions/src/`, or the seed. Hiding the row when absent is trivial; showing it needs a source field first. See OQ-20261025-02.
- `calculateAge()` computes against today, so a deceased person currently shows an age that keeps climbing. If a death date lands, the age must compute against it and the label should read as age at death.
- `isLiving` is optional in practice: `src/app/components/people/people.component.ts:365` treats anything that is not `false` as living. The new condition must use `!== false` semantics only if the intent is "unknown counts as living"; the owner asked for deceased people specifically, so gate on `person.isLiving === false`.
- Coverage: `e2e/specs/people.spec.ts` and the modal specs cover the person modal; the batch asserts that a deceased person with contact data shows no Contact card.

### Notes On F-20261025-10

- Render sites: 14 templates use a `close` mat-icon (person modal, contacts, people, photo album detail, photo slideshow, expressions, media search, admin users, admin uploads, admin people import, admin recovery, photo albums, photos legacy). A fix belongs in one global rule, not 14 component styles.
- Measured against the repo's own font (`src/assets/fonts/MaterialIcons-Regular.woff2`, rendered at 24px in Chromium): the `close` glyph ink spans x 5 to 18 of a 24px advance, so its horizontal ink centre is 11.5px against a 12px em centre, about 0.5px left. Sibling glyphs sit on the same 11.5px centre (`menu`, `keyboard_arrow_left`), so the horizontal drift is font-level, not button-level.
- Not yet verified in the running app. The dev project needs owner credentials, so the batch measures the real hover circle in-browser before choosing between a glyph nudge, an explicit flex centring rule on the icon, or a button-level offset. Do not ship a guessed pixel shift.
- `mat-icon` here is the ligature font, not the SVG set, so `text-rendering` and `font-feature-settings: "liga"` in the global rule are in play; a ligature rendered from the wrong font family silently falls back and shifts the glyph.

### Notes On F-20261025-11

- Root cause is by design, not a bug: `controls` hands the entire transport UI to the UA. Chrome and Firefox paint different chrome, and Firefox follows the OS dark preference for media controls, so no amount of wrapper CSS makes the bar identical across engines.
- There is no `prefers-color-scheme` rule anywhere in `src/`, so nothing in app CSS overrides the UA. The light declaration on `html` is the only lever currently in play.
- Two paths, and the owner must choose (OQ-20261025-03). Lighter path pins `color-scheme: light` on the audio element and styles around it: fixes the dark-mode ugliness, leaves Chrome and Firefox visibly different. Fuller path replaces native chrome with custom play/pause, seek, time, and volume controls over a hidden native element: identical everywhere, but it is a component rewrite with keyboard and screen-reader obligations.
- Coverage constraint: `e2e/specs/media.spec.ts:364` asserts `.audio-player-element` exists, carries the `fixture.wav` src, and that `currentTime` advances after a programmatic `play()`. Custom controls must keep a real media element with those semantics, and the batch extends that spec for the new buttons.
- The video surface is a separate iframe player (`video-player-videogular`), so it does not share this defect; scoping this finding to audio only.

### Notes On F-20261025-12

- Four rules carry the radius: `.imageContainer` and `.imageCenterer img` in the base block (`:83`, `:100`) and again in the `media-list-admin` override block (`:147`, `:161`). Removing it in one place only leaves the admin library rounded.
- The card itself (`.media-list-item`, `:117`) keeps its radius; only the thumbnail goes square. Keeping the frame square as well avoids a rounded clipping mask around a square image.
- Separate cause of clipped content: the thumbnails crop with `object-fit: cover` (`:99`, `:160`) in a fixed 72px square, so a wide photo loses its sides. The owner asked about rounded corners, so square corners are the change; switching to `contain` with a letterbox on `--color-surface-muted` is the option if full-image thumbnails are wanted. Recorded as a question rather than assumed.
- Photo grids elsewhere also round and crop (`photo-albums.component.scss:62`, `photo-album-detail.component.scss:20`); the owner scoped this to media cards, so the batch changes media only unless told otherwise.
- Coverage: `e2e/specs/media.spec.ts` renders the media list; the batch asserts the thumbnail computes to a 0px radius.
### Notes On F-20261025-13

- Both Admin entries go, not just the desktop one: the same `isSuperUser` block renders in the inline nav and in the hamburger menu, so removing one leaves a mobile-only entry point that the owner explicitly does not want.
- The logo behaviour already exists and is correct: `handleLogoNavigation` sends a super admin to `/admin` from anywhere else and back to the promoted route when already on an admin route. Only the nav buttons need deleting.
- Accessibility gap this creates: the logo is a bare `<img>` with a click handler (`src/app/app.component.html:7`), no role, no `tabindex`, no key handler. Once it is the sole admin entry point, keyboard and screen-reader users cannot reach admin at all. The batch makes it a real control (button or link wrapper) with an accessible name and a visible focus ring, while keeping the existing `alt` text that already reads `Admin` for super admins.
- Coverage rewrite, not a new file: `e2e/specs/admin.spec.ts:9` asserts the navbar Admin link exists and navigates, and `:21` asserts a staff admin does not see it. Both must become logo-click assertions: super admin lands on `/admin/users`, staff and regular users land on the promoted route, and `nav-admin-link` is absent from the toolbar in every case.
- Nav has a second copy of the links inside the admin sidebar; confirm the sidebar keeps its own admin navigation and only the top toolbar loses the entry.
### Notes On F-20261025-14

- This is the largest item in the ledger and the only one that needs a design decision before code. The batch runs a design pass first: two concrete layout directions for this page, owner picks one, then implementation follows that choice. Do not restyle in place and call it a rethink.
- Direction worth prototyping, stated so the owner can react to something specific: a three-step flow (choose file, describe it, publish) with one primary action visible at a time, metadata grouped into a titled card, and technical fields (storage name, S3 keys, derived paths) collapsed behind an "Advanced" disclosure. The same shell then holds both the video and audio panels, which removes the tab switch as the organising idea.
- Existing invariants to respect: the admin consistency contract entries D-20261022-03 (fixed 64/56px title bar, filters on their own row), `.admin-page` / `.admin-surface` / `.admin-intro` are the shared shell, and admin file layout conventions live in `src/app/styles/admin-data.scss`. A redesign that invents a private surface recipe breaks the nine-page contract.
- Functional fields cannot be dropped: storage name, derived S3 keys, icon selection, and the path-provisional warning are load-bearing. Hide or demote them, never delete.
- Coverage: `e2e/specs/admin-content.spec.ts` and `e2e/specs/media.spec.ts` drive these forms (upload, edit, delete). A structural redesign must keep their selectors reachable or update them in the same change; plan for it rather than treating the suite as collateral.
- Sequencing: land this after the styling findings, as its own commit, so a review revert of the redesign does not drag the smaller fixes with it.
### Notes On F-20261025-15

- Density ladder to prototype: 5 columns at 1600px and up, 4 between 1200 and 1600, 3 between 992 and 1200, 2 under 992, 1 under 600. That reaches five per row on a large display without shrinking the tablet floor the current 3-to-2 step already protects.
- The square cover is what makes the cards read huge: a 1:1 tile at one third of a ~1100px content column is roughly 350px tall before title and actions. A wider-than-tall cover (4:3) buys the extra columns without making thumbnails unreadable.
- Rethink beyond columns: card chrome competes with content now that cards are small. Consider dropping the raised card in favour of a cover tile with title and count underneath, so the grid reads as a contact sheet rather than a wall of panels.
- Scope pairing: apply the same density logic to the photo grid inside an album (`.admin-photo-grid`, `:253`) in the same design pass, or the album list and album contents will disagree about scale.
- Coverage: `e2e/specs/admin-content.spec.ts` exercises the album list; assert the computed column count at a wide viewport so the density cannot regress silently.
### Notes On F-20261025-16

- Scope is wider than admin: `app-page-toolbar` renders on 19 templates, including the user-facing contacts, calendar, chat, expressions, photos, people, media explorer, album detail, and photos-legacy pages. Rounding it for admin only would need a modifier variant and leave two toolbar languages in the app. The owner should choose: one shape everywhere (recommended) or an admin-only modifier.
- The gap is genuinely unowned. Five different values appear as first-card `margin-top` across admin pages (`4`, `8`, `12`, `16`, `20`, `24`px), and some pages get their only spacing from `.admin-intro` (`src/app/styles/admin-data.scss:13`). The batch should give the toolbar a single bottom gap owned by the shared shell, then delete those per-page margins.
- The filter row is part of the same visual block: `.admin-filter-bar` (`src/app/styles/admin-data.scss:48`) carries its own `border-bottom` and full-bleed padding. A rounded toolbar means deciding whether the filter row joins the same surface (shared radius and hairline) or becomes its own card.
- Contract change, not a drive-by: discovery entry D-20261022-03 pins "fixed 64px/56px title bar with filters in a separate fixed row" for all nine admin routes, and `design_specs/2026-10-22_admin_consistency_contract.md` records it. Update both in the same commit, or the repo will document a shape the code no longer has.
- Coverage is already strict here: `e2e/specs/admin-consistency.spec.ts:121` and `:124` assert the exact 64px/56px title-bar heights per route. Keep those heights and the suite survives; change them and the whole consistency matrix needs a coordinated update.
- Owner decisions, 2026-10-25: all 19 pages adopt the treatment, not admin only; the bar is inset on all four sides (not flush with rounded top corners); the green app bar stays untouched (see F-20261025-08).
- Height contract holds: the rounded card keeps 64px desktop and 56px mobile so `admin-consistency.spec.ts` stays meaningful; only the surface (radius, inset, shadow) and the gap below it change.
### Notes On F-20261025-17

- There are three role states, not three exclusive roles: Member (neither flag), Admin, and Super, and a user can be Admin and Super at once, rendering two badges. Colour has to work for a single badge and for the pair side by side, which rules out two similar hues.
- Proposed Material mapping, container and on-container pairs so text stays legible at 0.7rem: Member neutral blue-grey (M3 surface-container-high with on-surface-variant text), Admin blue or indigo (M3 primary-container of an indigo ramp), Super purple (M3 tertiary-container of a purple ramp). Red stays reserved for destructive actions and errors, which is why Super should leave it.
- The badges already carry their role name, so colour is redundant encoding and satisfies WCAG 1.4.1. Do not switch to colour-only dots.
- Contrast floor for these badges is 4.5:1 at 0.7rem/600 weight against their own container. The current dark-on-tint pairing needs an explicit check, not eyeballing.
- Fix the phantom token as part of the work: `--color-accent-soft` is referenced once and defined nowhere, which is how a fallback hex ended up shipping as a brand colour. Either define the role tokens properly or delete the reference; leaving a fallback in place will regress the moment the palette moves.
- Role text also appears uncoloured in the role history table (`roleSummary`, `src/app/components/admin-users/admin-users.component.ts:164`); decide whether history rows reuse the same badge treatment for scanability or stay plain text.
- Coverage: `e2e/specs/admin-system.spec.ts` exercises role changes; the batch asserts the badge classes and a computed contrast-safe colour rather than a raw hex, so a future palette swap does not fail the test for no reason.
### Notes On F-20261025-18

- One concept, two source-of-truth paths. `Family` and `Clan` models are field-for-field identical (`src/app/models/family.ts:1`, `src/app/models/clan.ts:1`); `FamilyService` and `ClanService` are the same CRUD over different paths; both nodes are seeded with the same two records under different ids (`scripts/e2e/seed.mjs:258-265`) so the emulator hides the problem and the real dev project exposes it.
- Imports make it worse: the CSV importer auto-creates missing groups through `ClanService` (`src/app/components/admin-people-import/admin-people-import.component.ts:242-243`), so newly imported families never appear on the admin Families page either.
- Fix direction is the same work as F-20261025-19, not a local patch: pick one collection, migrate the data, delete the loser, then the admin page shows what the features read.
- Verification needed at batch time: confirm node contents in the dev project before migrating, since the migration must not overwrite `families` records an admin created there. Read both nodes, diff by name and colour, then merge.

### Notes On F-20261025-19

- Census, code only, excluding generated output: `clan` appears 304 times across 25 files under `src/` and 15 times in e2e/functions/scripts; `family` appears 317 times across 46 files and 64 times in tests and scripts. Docs split hard: 291 clan hits across 27 files (186 in `design_specs/clans-ads.md` alone) against 153 family hits across 31 files.
- Recommendation: Family wins, and the code moves to it. Reasons: every rendered string already says Family, so the UI already made the choice; the audience is relatives reading a family-history site, where clan reads as anthropology or something Scottish; the two records in real and seeded data are named like family lines (Mignonne, Denis), which read naturally under "By Family" and oddly under "By Clan"; and consolidating on the already-existing `families` node deletes the duplicate rather than preserving it.
- Word-level risk to state plainly: "family" is overloaded, because the whole site is one family and this entity is a group inside it. "By Family" already ships and reads fine, so the ambiguity is theoretical. If sub-grouping is ever needed inside these groups, "Branch" is the escape hatch, not "Clan".
- `lineage` is a third term and is not this concept: it is the ancestry path string on Person (`src/app/models/person.ts:40`) plus ancestry/descendant trees. Leave it alone; do not fold it into the migration.
- Internal identifiers to rename: `Clan` model, `clanId` foreign key on Person (`src/app/models/person.ts:30`), `ClanService` and its path, `clans$`, `getClanForPerson`, `clansByIdMap`, `clansByNameMap`, `clanColorHex`, `selectedClan`, `onClanChange`, `FamilyGroup.clan`, plus CSS classes and the `clan` field on `CardContact`. Query params and the route helper `NavigateToAdminClans` (`src/app/services/routing.service.ts:145`) follow the same rule.
- Rename hazard beyond search and replace: `clanId` is data, not just code. Every Person record carries the old key, so the migration is a code rename plus an RTDB data migration plus a rules change, with the previous ruleset and a data export kept as the rollback.
- Sequencing: do this as its own branch section, after the styling batch. It touches persistence, the importer, seed data, and rules, and mixing it with cosmetic commits makes a failed migration hard to unwind.
- Docs to update in the same change: add one canonical glossary entry, mark `design_specs/clans-ads.md` superseded at the top rather than rewriting history, and add a discovery entry recording the decision.
### Notes On F-20261025-20

- Two changes on the video preview: `aspect-ratio: 16 / 9` to `1 / 1`, and drop `border-radius`. Both live in one rule at `.media-thumbnail-preview`.
- The audio album cover preview is already 1:1 (`admin-media-upload-audio-album.component.scss:151`) but carries the same `border-radius: var(--radius-input)`; remove it in the same commit so both upload previews obey F-20261025-12's square rule and do not look like siblings from different design systems.
- Parity check that matters: stored media icons are square in the media list (72px frame, `object-fit: cover`), which is why a widescreen preview was misleading rather than merely cosmetic.
- `object-fit: cover` on a square frame crops the sides of a widescreen grab. That is correct if thumbnails really are square everywhere; confirm against an existing stored icon before the batch, so the preview shows the same crop the app will show.
- Coverage: `e2e/specs/media.spec.ts` drives the video upload and thumbnail paths; assert the computed aspect ratio and 0px radius on `video-thumbnail-preview`.
## Open Questions

- OQ-20261025-01 | base for the batch branch: `master` at `6f3f9266` carries uncommitted edits in `functions/package.json`, `functions/package-lock.json`, `docs/discovery/DISCOVERY.md`, and `docs/specs/2026-10-22_MediaUploadPipeline.md`; a second worktree sits on `user-flows-polish` at `737e0c55`. Decide whether the batch starts from clean `master` or folds that branch in.- OQ-20261025-04 | RESOLVED 2026-10-25: owner chose Family as canonical everywhere (option A). Plan in "Family Canonicalization Plan" below. Original question: wording and migration for F-20261025-19: recommendation is Family everywhere (UI, code, `families` node, `familyId` FK) with `clan` retired. Owner confirms the word, then the batch migrates `clans` into `families`, repoints every reader and writer, updates rules and seed, and deletes `ClanService` and the `Clan` model. Alternative if the owner prefers the opposite: keep `clan` in code and DB and rewrite every user-facing label to Clan, which is cheaper on data and worse for users.
- OQ-20261025-02 | death date source for F-20261025-09: nothing in the model, importer, rules, or seed stores a death date. Either the source spreadsheet already has a column the importer ignores (name it and the batch wires it through), or the batch adds a `Died` column plus a `Person.deathDate` field, importer parsing, display, and validation. Owner decision needed before the batch, because the second path is a small feature, not a styling tweak.
- OQ-20261025-03 | scope for F-20261025-11: (a) force `color-scheme: light` on the audio element and polish the wrapper, or (b) replace the native transport with a custom play bar that renders identically in Chrome, Firefox, and Safari, including keyboard support and an e2e assertion per engine. (a) is a styling change; (b) is a component rewrite. Owner picks before the batch.
- OQ-20261025-04 | RESOLVED 2026-10-25: owner chose Family as canonical everywhere (option A). Plan in "Family Canonicalization Plan" below. Original question: wording and migration for F-20261025-19: recommendation is Family everywhere (UI, code, `families` node, `familyId` FK) with `clan` retired. Owner confirms the word, then the batch migrates `clans` into `families`, repoints every reader and writer, updates rules and seed, and deletes `ClanService` and the `Clan` model. Alternative if the owner prefers the opposite: keep `clan` in code and DB and rewrite every user-facing label to Clan, which is cheaper on data and worse for users.

## Family Canonicalization Plan

Decision: Family is canonical in UI, code, and data. Clan is removed everywhere. This plan resolves F-20261025-18 and F-20261025-19 together, because the duplicate collection is the bug.

### Code Rename (no data risk)

- Models: delete `src/app/models/clan.ts`; keep `src/app/models/family.ts`. Rename `Person.clanId` to `Person.familyId` (`src/app/models/person.ts:30`).
- Services: delete `src/app/services/clan.service.ts` and its spec; move every consumer to `FamilyService` (`src/app/services/family.service.ts:10`). Consumers: `people.component.ts`, `contacts.component.ts`, `contacts-from-people.service.ts`, `person-detail-modal.component.ts`, `admin-people-import.component.ts`, `calendar.service.ts` and the shared `person-tree` input `clanColorHex`.
- Identifiers: `getClanForPerson`, `getClanByName`, `navigateToClan`, `clansByIdMap`, `clansByNameMap`, `clanColorHex`, `selectedClan`, `onClanChange`, `clearClanFilter`, `FamilyGroup.clan`, `CardContact.clan`, `resolveClanId`, `pendingClans`, `getFamilyColorForClan`.
- CSS and template hooks: `clan`-named classes and the `--clan-color` custom property become `family`-named. Keep the rendered label text as-is; it already says Family.
- Routing: `ADMIN_ROUTE.families` already reads `families`; rename the helper `NavigateToAdminClans` (`src/app/services/routing.service.ts:145`) and its callers.
- Query params: `?clan=` is written by people and contacts (`people.component.ts:165`, `contacts.component.ts:188`). Write `?family=` going forward and accept `clan` as a read-only legacy alias for one release, so existing bookmarks and pasted links keep working, then delete the alias.

### Live Data Changes (these touch the real databases)

1. Export before touching anything: `firebase database:get / --project lecoursville-dev > clans-backup-dev.json` (repeat for `lecoursville` when the prod cutover happens). Keep the file out of git.
2. Read both nodes and diff them by `name` before merging, so records an admin created on the Families page are not overwritten:
   - `clans` holds the real historical data.
   - `families` is empty in dev today but may hold admin-created rows in prod.
   - Merge rule: match by `name`; keep the `clans` record id when the name exists in both; add `families`-only records as-is; on a name collision with a different `hexColor`, keep the `clans` colour and log the conflict for the owner.
3. Copy each `people/<id>/clanId` value to `people/<id>/familyId`, remapping ids when a merged record changed id. Leave `clanId` in place until the gate is green, then delete it in a second pass.
4. Delete the `clans` node only after both steps verify. Do not delete it in the same transaction as the copy.
5. Stale per-person fields from the pre-clan model (`clan` free-text string, `colorHue`, `colorHex`) may still exist on old records; they are not in the current model. Report them, do not silently drop them.
6. Rules: remove the `clans` rule block (`database.rules.json:169`) once the node is gone, and follow the repo's dated snapshot convention under `database-rules/`. Prod rules are known to be drifted (live ruleset dates from 2026-10-04, see D-20261022-02), so the prod rules deploy needs its own sign-off and snapshot rather than a blind `firebase deploy`.
7. No Storage or Functions migration: no `clan` string appears in `functions/src/` or in any storage path builder.

### Verification Gates

- Emulator: seed writes one node only, and `e2e/specs/admin-content.spec.ts` asserts the admin Families page lists the same names the People filter offers.
- Live dev: after migration, the admin Families page count equals the People filter option count, and no console error mentions a missing path.
- Rollback: the exported JSON plus the previous rules snapshot. The batch adds the dated rules snapshot before the first deploy, matching the existing `database-rules/<date>/before.json` pattern.

### Sequencing

- Do this as its own section after the styling batch, and land the data migration as its own commit with the export present, so a failed merge is recoverable without reverting cosmetic work.

## Batch Plan

- Spec: `docs/specs/2026-10-25_DevReviewBatch.md`, approved 2026-10-25. The ledger stays as the finding record; the spec is the implementation contract.
- Branch: `fine-tuning-2026-10-25`, cut from `master` at `6f3f9266`. The four uncommitted working-tree edits stay out of the branch.
- Scope: F-20261025-01 to F-20261025-20. F-20261025-08 is withdrawn (misread: green app bar is out of scope, the white page-title bar is the target, covered by F-20261025-16).
- Decisions carried into the spec: clean master base, custom audio transport, optional `deathDate` plus a tolerant `Died` import column, all 19 pages for the toolbar card, green bar untouched, grouped media upload page with sticky actions, five-step album density ladder, cover-crop thumbnails, indigo and purple role palette, shared dialog scale, nav row top gap, one-release `?clan=` alias, owner-run migration script with a unit-tested transform.
- Rollout: branch, commits by surface, `npm run e2e:gate` green, merge to `master`, owner runs the additive migration on `lecoursville-dev`, `npm run deploy:dev`, owner re-tests, then the cleanup pass removes `clanId`, the `clans` node, and the `clans` rules block.