# Calendar Print (Generated Year and Month PDF)

Branch context: builds on the existing member calendar at `/calendar`. Makes the generated, print-ready calendar the default member flow and keeps the uploaded-PDF flow behind a `legacyCalendarPdf` kill switch. No backend schema changes. All derivation is client-side from live `people` data.

## Context And Motivation

The family has a legacy desktop program that emits one landscape letter PDF per month, titled `May 2018 Birthdays and Anniversaries`. The reference sample is a Sunday-first 7-column grid, bold day numbers in the top-left of each cell, and entries rendered as `Name - age` for birthdays and `A and B Surname - years` for anniversaries, inside a framed serif title band.

The mother is attached to that layout. The goal is to keep the structure and modernize the craft, not redesign it.

Today the app does not generate anything. An admin manually uploads one PDF per year into the RTDB `calendars` node (`src/app/components/admin-calendars/admin-calendars.component.ts`), and the member print dialog just opens that uploaded file (`src/app/components/calendar-printer/calendar-printer.component.ts:72`). That flow is stale by construction: it only reflects data as of the last manual upload, and it cannot honor the toggle state the member already set on the calendar page.

This feature derives the calendar from live data on every request.

## Decision: On The Fly, Not Precompiled

Generated at request time, always. Rationale, confirmed by adversarial review:

- The source is a single `people` list already loaded client-side by `PeopleService` (`src/app/services/people.service.ts:24`). A few hundred records across 12 month grids is tens of milliseconds of work.
- The data is mutable. Names, living status, dates, and imports all change. A precompiled artifact is invalidated by every edit, which is exactly the failure mode of the current `calendars/cal-YYYY` uploads.
- Every toggle multiplies the artifact space. Include-deceased cross birthdays cross anniversaries cross any-year cross single-month is a matrix of variants.
- Ages change every January 1, so even a "static" yearly artifact needs annual regeneration.

Output mechanism is a dedicated print route rendered with HTML and CSS, followed by the browser's print-to-PDF. This is a deliberate reversal of a recent removal: commit `68a67bcd` deleted `jspdf`, `html2canvas`, and a hand-written jsPDF layout service. Adding a PDF drawing library back would mean rebuilding text measurement, line breaking, clipping, and page overflow by hand, and losing the DOM assertions that protect the layout. The browser text engine gives wrapping, kerning, and font fallback for free, and the repository already has a print pipeline (`src/styles.scss:603` and the named `@page song` at `src/styles.scss:608`).

To keep the future open, the page model is a pure function separated from the renderer. If a one-click downloadable or emailed file is later required, add server-side `page.pdf()` of the same route (Chromium pinned) rather than a second typesetter.

## Legacy Fallback Toggle

The generated path ships with a kill switch. A new feature flag `legacyCalendarPdf` (default OFF) restores the pre-generated PDF flow when flipped ON, so a broken generated calendar is one admin toggle away from the old behavior.

- Flag key: `legacyCalendarPdf`. Stored at `features/legacyCalendarPdf`, `defaultEnabled: false`. Added to `FEATURES` in `src/app/config/feature-config.ts:10-23` and to the `Content` group ids in `src/app/components/admin-features/admin-features.component.ts:21-25`, so it renders as a toggle on `/admin/features`. It must also be added to `FEATURE_IDS` in `scripts/e2e/seed.mjs:42-45`.
- The flag shares the `/calendar` route with the `calendar` feature, so the navbar dedupes it and no extra nav button appears (`src/app/components/navbar-links/navbar-links.component.ts:57-66`, the same pattern as `enablePhotoAlbums` in `feature-config.ts:20-21`).
- Flag ON is a full revert for members: the calendar page Print button opens the existing uploaded-PDF picker (`CalendarPrinterComponent`) instead of routing to `/calendar/print`, and `/calendar/print` redirects to `/calendar`. The legacy component and its files are therefore retained, not deleted.
- Admin sidebar: the `Calendars` item gets `featureFlag: 'legacyCalendarPdf'` in `ADMIN_NAV` (`src/app/admin/admin-nav.ts:46`), so `visibleAdminNav` hides it while the flag is off. Per decision, the route itself stays reachable at `/admin/calendars` for admins who know the URL. No route guard is added.

## Glossary

**Calendar Entry**

One printable line on a day cell: either a birthday or an anniversary, with an optional suffix. _Avoid_: event, item, record.

**Lifespan Suffix**

The parenthesized birth and death years that replace the age suffix for a deceased person, for example `(1935-2015)`. _Avoid_: marker, dagger, ghost.

**Calendar Page**

One printed landscape sheet for a single calendar month. A full year is twelve Calendar Pages. _Avoid_: sheet, slide, view.

**Primary Record**

A `people/<id>` record whose id does not end in `-S`. Virtual spouse records end in `-S` and are not Primary Records. _Avoid_: real person, base record.

## Current State

- Member calendar route `/calendar`: `src/app/app-routing.module.ts:32-37`, guarded by `AuthGuardService`, `ApprovedGuardService`, `FeatureFlagGuard`, `data.featureId: 'calendar'`, lazy `CalendarFeatureModule`.
- Calendar feature module and its child route: `src/app/components/calendar/calendar.module.ts:18-23` declares a single `path: ''` route to `CalendarComponent`.
- Calendar view is month-only angular-calendar plus a custom cell: `src/app/components/calendar-view/calendar-view.component.html:53`.
- Filters already exist as `showBirthdays`, `showAnniversaries`, `showNotLiving` (`src/app/components/calendar/calendar.component.ts:37-39`) and default to living only.
- Print button: `src/app/components/calendar/calendar.component.html:25-26` calls `printPdf()`, which opens `CalendarPrinterComponent` (`src/app/components/calendar/calendar.component.ts:238-254`).
- Uploaded-PDF picker: `src/app/components/calendar-printer/calendar-printer.component.ts:37-77`, reads RTDB `calendars` and `calendars/cal-<year>`, then `window.open(url)`.
- Event derivation lives in `CalendarService.deriveEventsFromPeople` (`src/app/services/calendar.service.ts:40-78`). It emits birthdays for all records including `-S` virtual spouses (`:45`), and anniversaries only for non-`-S` records (`:58`). It builds local `Date` objects (`:51`, `:70`).
- Filtering and year projection: `CalendarService.updateEvents` (`src/app/services/calendar.service.ts:120-147`).
- `CalendarCellComponent` reads `getUTCFullYear()` off a locally built `Date` (`src/app/components/calendar-cell/calendar-cell.component.ts:24`), a timezone mismatch trap.
- Data model: `src/app/models/person.ts:27-45`. `birthday` is a required `PersonDate` of numeric `{year, month, day}` (`:3-7`, month 1-based). `anniversaryDate` and `deathDate` are nullable `PersonDate` (`:33-34`). `spouseId` is a single id pointer (`:32`). `isLiving` is a boolean (`:42`).
- Unknown birth year is stored as `year: 0` (`src/app/services/calendar.service.ts:45`).
- Print CSS contract: global `@media print` at `src/styles.scss:603`, a default `@page { margin: 14mm }`, a named `@page song` at `:608`, toolbar suppression, white paper ground, and a dark-theme token override for print at `:641-668`.
- Playwright print precedents: `window.print` is stubbed and asserted in `e2e/specs/songs.spec.ts:544-566`. Print media is emulated and PDF page count read in Chromium at `e2e/specs/songs.spec.ts:740-756`. `pdfContent()` inflates PDF streams at `e2e/specs/songs.spec.ts:13-30`.
- E2E seed people: `scripts/e2e/seed.mjs:262-282`. `person-e` is Edith Evans, born 1935-01-10, died 2015-06-15, `isLiving: false`. `person-f` is Frank Foster, born 1940-02-20, `isLiving: false`, `deathDate: null`. `person-c` and `person-d` are spouses with an anniversary in the seeded current month.
- Feature flag path `features/{id}` via `src/app/services/feature-flags.service.ts`. The `calendar` flag is already seeded on (`scripts/e2e/seed.mjs:42-45`).

## Goals

1. Generate a print-ready landscape letter calendar for any year, 12 pages.
2. Generate a single month on request, one page.
3. Offer one obvious Print button using sensible defaults, plus a collapsible rich configuration panel.
4. Support toggles for birthdays, anniversaries, inclusion of deceased people, and the lifespan suffix.
5. Keep the legacy structure while modernizing typography, spacing, and rules.
6. Keep the derivation pure, unit-testable, and independent of the renderer.
7. Ship Playwright coverage in the same change.
8. Provide a `legacyCalendarPdf` kill switch that reverts members to the uploaded PDF flow and hides the admin Calendars nav entry while it is off.

## User Stories

1. As a family member, I want to open Print from the calendar page so I can get a paper calendar without configuring anything.
2. As a family member, I want one click to print the current year with birthdays and anniversaries for living relatives, because that is the common case.
3. As a family member, I want to choose any year, including past years, so I can reprint an old calendar.
4. As a family member, I want to print a single month so I can pin one page.
5. As a family member, I want to exclude birthdays and keep anniversaries, or the reverse.
6. As a family member, I want to include relatives who have passed, so the year is complete.
7. As a family member, I want deceased relatives to be visually distinct without a symbol, so the page still reads calmly.
8. As a family member, I want a deceased entry to show the lifespan rather than an age, so the dates are correct and dignified.
9. As a family member, I want a person with an unknown birth year to still appear on their day, with no invented age.
10. As a family member, I want couples' anniversaries to read as one line with the years married.
11. As a family member, I want the month title to name the family and the month, so the page is recognizable.
12. As a family member, I want the printed page to fill a landscape letter sheet with no clipped entries and no stray pages.
13. As a family member, I want the on-screen preview to match the printed page so I can trust what I am about to print.
14. As a family member, I want the configuration panel collapsed by default so the page is not intimidating.
15. As a family member, I want my chosen options to update the preview immediately.
16. As a family member, I want a warning when a day has more entries than fit, so I know something was truncated.
17. As a family member, I want the page to print correctly in light and dark theme, because paper is always light.
18. As an admin, I want the generated calendar behind the existing `calendar` feature flag, so disabling the feature removes both the calendar and its print route.
19. As a maintainer, I want the derivation in a pure function with unit tests, so formatting rules are provable without a browser.
20. As a maintainer, I want the generated calendar to be the only member path while everything works, so there is one path members can trust.
21. As an admin, I want a single toggle that reverts members to the uploaded-PDF picker, so a broken generated calendar is not an outage.
22. As an admin, I want the Calendars upload entry to appear in the admin sidebar only while the legacy toggle is on, so the retired flow is out of the way but still reachable by direct URL.

## Non-Goals

- No new database schema, node, or migration.
- No server-side rendering, Cloud Function, or headless browser.
- No downloadable `.pdf` file in this change. Browser print-to-PDF is the deliverable. A server-side `page.pdf()` of the same route is the documented follow-up if a real download is later required.
- No cover page. The generated output is month pages only.
- No in-memoriam list page.
- No deletion of the legacy upload flow. `CalendarPrinterComponent` and the admin `calendars` page are retained and reachable behind `legacyCalendarPdf`.
- No new top-level navigation entry. The print route is reached from the calendar page and is directly addressable.
- No route guard on `/admin/calendars`. Only the sidebar entry is flag-gated.
- No authentication, approval, or feature-flag redesign. The print route reuses the calendar route guards.
- No change to the month grid on the existing `/calendar` screen.

## Prerequisites

- Node and Angular toolchain as configured in `package.json` (Angular 22).
- Firebase Emulator Suite for the e2e gate, with `JAVA_HOME` exported per `AGENTS.md`.
- No new npm dependency. Inter is already installed (`package.json`, `@fontsource-variable/inter`).

## Design Principles

- One visual source of truth: the same DOM renders the preview and the paper.
- Fixed geometry over flowing documents: every Calendar Page is an explicit fixed-size sheet, so one month cannot reflow into the next.
- Content carries meaning: the deceased distinction is a date range, not a glyph.
- Pure derivation: no `Date` arithmetic for bucketing. Work with `{year, month, day}` numbers directly to avoid timezone drift.
- Legacy skeleton, modern craft: same grid, title band, and entry grammar, updated type, rules, and spacing.
- Progressive disclosure: the default path is one button. Depth is opt-in.

## Backend Requirements

There is no backend change. This section is the data resolution contract the implementation must follow. It is normative and is the unit-test surface.

### Inputs

`Person[]` from `PeopleService.getPeople()` (`src/app/services/people.service.ts:32`) plus these options:

```
CalendarPrintOptions {
  year: number;              // 1900..2100 inclusive
  months: number[];          // 1..12; twelve entries for a full year
  includeBirthdays: boolean;
  includeAnniversaries: boolean;
  includeDeceased: boolean;
  showLifespan: boolean;     // lifespan suffix for deceased entries
}
```

Defaults: current year, months 1 through 12, birthdays true, anniversaries true, includeDeceased false, showLifespan true.

### Deceased Classification (Canonical)

A person is deceased when `isLiving === false` OR `deathDate != null`. A missing `isLiving` value is treated as living. This single rule is the only definition used by this feature, and it reconciles the three signals in the repository (`isLiving`, `deathDate`, `deathDate.year === 0`).

`deathDate` with `year === 0` is treated as unknown, not as a death year.

### Record Selection

1. Process only Primary Records for entries: skip any `person.id` ending in `-S`. This applies to birthdays and anniversaries. The current `CalendarService` emits birthdays for `-S` records (`src/app/services/calendar.service.ts:45`), which would double-list spouses. This feature must not reuse it.
2. Birthday entry is included when `includeBirthdays` is true, the person is not a `-S` record, and `birthday.month` is 1 through 12 and `birthday.day` is valid for that month in the target year.
3. Anniversary entry is included when `includeAnniversaries` is true, the person is a Primary Record, and `anniversaryDate` is non-null with a valid month and day for the target year.
4. When `includeDeceased` is false, exclude a birthday or anniversary whose subject is deceased. For an anniversary, exclude when EITHER the person or the resolved spouse is deceased.
5. Leap day: a `02-29` birthday or anniversary renders on February 28 in non-leap years. It never disappears.

### Age And Year Rules

- Birthday age = `options.year - birthday.year`. This is the age the person turns on that date in the printed year.
- If `birthday.year === 0`, render the name with no suffix.
- Anniversary years = `options.year - anniversaryDate.year` when `anniversaryDate.year > 0`. If the year is unknown, render the couple line with no suffix.

### Entry Text

Living birthday: `Name - age`, where `Name` is `firstPreferred || firstGiven` plus `last`, trimmed. A missing last name renders the first name only. A missing first name renders the last name only.

Deceased birthday with `showLifespan` true: replace the entire age suffix with a lifespan suffix.

- Both birth and death years known: `Name (1935-2015)`, using a hyphen-minus for print safety and a single space before the opening parenthesis.
- Birth year unknown, death year known: `Name (d. 2015)`.
- Death year unknown, birth year known: `Name (b. 1935)`.
- Both unknown: `Name`.
- Never stack an age and a lifespan. `Name - 62 (1956-2018)` is forbidden.

Deceased birthday with `showLifespan` false: render like the living form, `Name - age`, with no lifespan.

Anniversary: `A and B Surname - years` when both spouses share a last name and both are known. Otherwise `A Last and B Last - years`. When `spouseId` does not resolve, render the primary person's name only, with the years suffix.

Deceased spouse inside an anniversary, when `includeDeceased` is true: place the lifespan immediately after that spouse's name, never after the couple and never on the surname. Examples: `Mignonne (1949-2018) and Vincent LeBlanc - 63`, or `Mignonne and Vincent (1951-2022) LeBlanc - 63`.

### Ordering, Bucketing, and Pages

- Bucket entries by `month` then `day` of the target year.
- Within one day: birthdays before anniversaries, then alphabetical by the rendered entry text, case-insensitive.
- Every Calendar Page is a Sunday-first grid of exactly 6 rows by 7 columns. Lead and trail cells outside the month are empty, not neighboring-month days. A 5-week month still renders 6 rows so page heights are constant.
- Months with zero entries still render a page with an empty grid.
- Full-year output is 12 pages in calendar order. Single-month output is exactly one page.

### Overflow Rule

A day cell fits at most 4 entry lines at the base size. The renderer may step the entry font down through 7.5pt, 7pt, 6.5pt and fit up to 8 lines. Beyond that, render the first fitting entries followed by a `+N more` line. The page model returns, per day, the entries that fit and a `moreCount`. The control panel surfaces a warning naming every day with `moreCount > 0` so data loss is never silent.

### Pure Function Contract

```
buildCalendarPages(people: Person[], options: CalendarPrintOptions): CalendarPage[]
formatBirthdayEntry(person: Person, spouse: Person | null, options): string | null
formatAnniversaryEntry(person: Person, spouse: Person | null, options): string | null
isDeceased(person: Person): boolean
```

`CalendarPage` carries `{ year, month, monthName, title, weeks: CalendarDay[][], entriesById }` with `CalendarDay = { day: number | null, entries: string[], moreCount: number }`. No function in this module may construct a `Date`. Bucketing uses the numeric `PersonDate` fields directly.

## Frontend Requirements

### Route

Add a child route inside `CalendarFeatureModule`'s `routes` (`src/app/components/calendar/calendar.module.ts:18-23`):

```
{ path: 'print', component: CalendarPrintComponent }
```

The parent `/calendar` route remains the guard boundary (`src/app/app-routing.module.ts:32-37`). No new top-level route, no new nav entry. `/calendar/print` must be directly addressable and must not depend on `/calendar` having been visited, except while `legacyCalendarPdf` is on.

While `legacyCalendarPdf` is ON, the child `print` route redirects to `/calendar` so members cannot reach a generated page in revert mode.

### Entry Points

1. `src/app/components/calendar/calendar.component.html:25-26` Print button keeps the `print` icon and label. With `legacyCalendarPdf` OFF it navigates to `/calendar/print` with the current `year` and `month` as query parameters, so the print route opens on what the member was viewing. With the flag ON it opens `CalendarPrinterComponent` exactly as today (`src/app/components/calendar/calendar.component.ts:238-254`).
2. `CalendarPrinterComponent` stays declared and imported in `calendar.module.ts:14,33`. It is the revert target, not dead code. Gate it behind the flag so it does not appear in the generated flow.
3. Add the flag to the calendar component as a subscription through `FeatureFlagsService`, defaulting to OFF until `flagsReady()` resolves, so the first paint does not briefly offer the wrong path.
4. Log `calendar_print_open` on print route load, `calendar_print_run` with the options on Print, and `calendar_print_legacy_open` when the flag routes a member to the picker.

### Page Anatomy

Each Calendar Page is a fixed `11in by 8.5in` landscape sheet, `box-sizing: border-box`, `overflow: hidden`, `break-after: page`.

Inside, in order:

1. Outer frame: a single 1px solid rule inset from the page edge. Drop the legacy double rule and the corner ticks.
2. Title band: a bordered box centered at the top, full inner width, containing the title `LeCoursville Family - <Month> <Year>`.
3. Weekday header row: `Sunday` through `Saturday`, italic or small caps, centered over each column.
4. The 6 by 7 grid. Each cell has a day number in the top-left, bold, and the entry list below it with a hanging indent and a 6px shared left inset from the cell rule. The inset exists so day numbers and entries do not fuse with the rule when photocopied.
5. No printed page footer, no page numbers, no legend. The legend lives in the on-screen configuration panel only.

### Typography

- Title: serif stack `Georgia, 'Times New Roman', serif`, bold, 26pt equivalent.
- Weekday headers and day numbers: the app sans (Inter), day numbers bold.
- Entries: Inter at 7.5pt base, line-height 1.25, `font-variant-numeric: tabular-nums` so ages align. All text pure black on white. No gray text anywhere in print.
- Grid rules: 1px solid black at the page edge and 0.5pt hairlines internally, which survive a home laser printer and a photocopy.

### Control Panel And Preview

Layout: a page toolbar carrying the heading `Print Calendar`, then a compact options card, then the scaled page preview.

- Primary action: a filled `Print` button, always visible above the fold. It prints using the current options. Collapsed configuration means defaults.
- A `Customize` disclosure, collapsed by default, reveals:
- Year: previous and next stepper buttons plus a numeric input, 1900 to 2100, default current year.
- Scope: radio group `Full year` and `Single month`. Selecting `Single month` reveals a month select, defaulting to the month from the query parameters or the current month.
- Checkboxes: `Birthdays`, `Anniversaries`, `Include relatives who have passed`, `Show lifespans for deceased`. The lifespan checkbox is disabled and forced on while `Include relatives who have passed` is off.
- Preview area: every Calendar Page rendered at screen scale so a full year is a scrollable stack of 12 sheets. Scale with a CSS transform on a wrapper. The transform must not apply in print media.
- A live status line states the page count, for example `12 pages`, and lists any truncated days as `3 entries did not fit on May 21`.
- Print handler: `await document.fonts.ready` then `window.print()`. Never print before fonts resolve, because a late font swap reflows the grid.

### Print CSS

Add a named page and shell rules inside the existing `@media print` block (`src/styles.scss:603`), or in the print component's stylesheet, scoped so the song print contract is untouched.

- `@page calendar { size: letter landscape; margin: 0; }`
- The print root sets `page: calendar`.
- The app toolbar, control panel, and any screen chrome are hidden in print.
- The preview transform is reset to none in print.
- The dark-theme print token override at `src/styles.scss:641-668` already forces light surfaces. Extend it so Calendar Page text stays black on white.
- Do not rely on background colors for any printed element. Use borders and text only, so a user who prints without "Background graphics" still gets the frame.

### Test IDs

- `calendar-print-print-button`
- `calendar-print-customize`
- `calendar-print-year`
- `calendar-print-month`
- `calendar-print-scope-year`, `calendar-print-scope-month`
- `calendar-print-toggle-birthdays`, `calendar-print-toggle-anniversaries`, `calendar-print-toggle-deceased`, `calendar-print-toggle-lifespan`
- `calendar-print-page` (one per page)
- `calendar-print-title` (one per page)
- `calendar-print-entry` (one per entry line)
- `calendar-print-status`
- `calendar-print-overflow-warning`
- `calendar-legacy-picker` on the retained `CalendarPrinterComponent` dialog container, so the revert path is assertable

### Accessibility

- The year input has a visible label and an `aria-describedby` for validation.
- The disclosure uses `aria-expanded` and `aria-controls`.
- The scope radio group has a `fieldset` and `legend`.
- The status line is `aria-live="polite"` so page count and truncation announce.
- All controls are keyboard reachable. The preview is not focus-trapped.

### Error And Empty States

- Invalid year (outside 1900 to 2100): inline validation, Print disabled, no navigation or crash.
- Zero people or zero matching entries for a month: still render the page with an empty grid. Never show a blank screen.
- People load failure: reuse the existing `LvLoadErrorComponent` pattern already imported in `calendar.module.ts:13`.

## Production Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Browser print variance across Chromium, WebKit, Firefox (margins, scale, page size) | Fixed-size page shells, `@page calendar` with zero margin, `overflow: hidden`, no reliance on flowing document pagination. Manual Safari and Firefox print-preview smoke before sign-off. |
| A cell overflows and pushes an extra blank page | Fixed 6-row grid, fixed sheet height, clamp with the overflow rule, and assert `scrollHeight <= clientHeight` in print media in e2e. |
| Late font load reflows the grid during print | Await `document.fonts.ready` before `window.print()`. |
| Dark theme prints white-on-white or with a dark page band | Reuse and extend the existing dark print token override at `src/styles.scss:641-668`. |
| Background graphics disabled by the user | Frame, rules, and text are borders and glyphs only, never background fills. |
| `-S` virtual spouse records duplicate birthdays | Skip `id.endsWith('-S')` in the page model, with a unit test. |
| Deceased classification disagrees between screens | Single canonical rule in the page model, with tests for `isLiving` false, `deathDate` present, and both missing. |
| Timezone drift shifts an entry to the wrong day | The page model never constructs a `Date` for bucketing. Unit tests assert numeric bucketing. |
| jsPDF and html2canvas removal is reversed by habit | No new dependency. The print route is the deliverable. |
| Feature disabled mid-session | The existing `FeatureFlagGuard` on `/calendar` covers `/calendar/print`. Add an e2e assertion. |
| Silent truncation on dense days | `moreCount` from the model, a visible warning in the panel, and an e2e case with a seeded dense day. |
| Print dialog exposes the wrong route title | Set `document.title` to the month title (or `LeCoursville Family Calendar`) before printing and restore it after, matching the songs precedent at `e2e/specs/songs.spec.ts:544-566`. |
| Generated calendar breaks in production and members cannot print | Flip `legacyCalendarPdf` ON. The Print button returns to the uploaded-PDF picker and the admin Calendars entry reappears in the sidebar. No deploy needed. |
| Kill switch flickers the wrong print path on first paint | Hold the calendar print affordance in a neutral disabled state until `flagsReady()` resolves, and default the flag to OFF. |
| Admin cannot find the upload page while the flag is off | The route stays reachable at `/admin/calendars` by direct URL. The sidebar entry is the only thing gated. |

## Rollout Plan

Single deployable change. There is no migration and no backfill.

1. Add the `legacyCalendarPdf` key to `FEATURES`, the admin `Content` group, and `scripts/e2e/seed.mjs`.
2. Add the pure page model and its unit spec.
3. Add `CalendarPrintComponent`, its template, its styles, and the child route.
4. Repoint the calendar Print button behind `legacyCalendarPdf`, branching between the print route and the retained `CalendarPrinterComponent`.
5. Add `featureFlag: 'legacyCalendarPdf'` to the `Calendars` entry in `admin-nav.ts`.
6. Extend `scripts/e2e/seed.mjs` with the fixtures listed in the test plan.
7. Add the e2e spec. Update `e2e/specs/calendar.spec.ts` where it asserts the old print dialog so it asserts the generated route with the flag off and the picker with it on.
8. Run the gate. Manual print-preview smoke in Chrome and Safari.
9. Ship with `legacyCalendarPdf` OFF. Two rollback levels exist: flip `legacyCalendarPdf` ON for an immediate member revert without a deploy, or disable the `calendar` flag to remove the calendar and its print route together.

## Test Plan

### Unit: `src/app/components/calendar-print/calendar-print.model.spec.ts`

1. A living person with a known birth year renders `Name - age` and the age equals `options.year - birthday.year`.
2. A person with `birthday.year === 0` renders the name with no suffix.
3. A `-S` virtual spouse record is excluded from birthdays.
4. A `-S` record's anniversary date is never emitted as a second anniversary.
5. `isDeceased` returns true when `isLiving === false`, true when `deathDate` is non-null with a valid year, false when both are absent, and false when `deathDate.year === 0` but `isLiving` is true.
6. Deceased people are excluded when `includeDeceased` is false, for birthdays and anniversaries.
7. An anniversary is excluded when either spouse is deceased and `includeDeceased` is false, and included when true.
8. Lifespan suffix, both years: `Name (1935-2015)`.
9. Lifespan suffix, unknown birth year: `Name (d. 2015)`.
10. Lifespan suffix, unknown death year: `Name (b. 1940)`.
11. Lifespan suffix, both unknown: `Name`.
12. `showLifespan` false renders the deceased entry as `Name - age`.
13. Age and lifespan never stack.
14. Anniversary, shared surname: `A and B Surname - years`.
15. Anniversary, different surnames: `A Last and B Last - years`.
16. Anniversary, unresolved `spouseId`: primary name plus years suffix.
17. Anniversary where one spouse is deceased and lifespan is on: the lifespan sits after that spouse's name, not after the couple.
18. `02-29` birthday renders on February 28 in a non-leap target year.
19. Day buckets are Sunday-first and every month page has exactly 6 rows of 7 cells.
20. Leading and trailing cells outside the month are empty.
21. Within a day, birthdays precede anniversaries, then alphabetical order.
22. A month with no entries still yields one page with an empty grid.
23. Single-month options yield exactly 1 page, full-year options yield 12.

### E2E: `e2e/specs/calendar-print.spec.ts`

Import `test` from `../helpers/fixture`. Use `login(page)` from `../helpers/auth`. No arbitrary sleeps. No `test.skip`. Any flag mutation restores in `afterEach` via `writeDb` per `docs/discovery/DISCOVERY.md` D-20261030-10.

1. Navigate to `/calendar/print` as an approved user. Exactly 12 `calendar-print-page` elements render and the first title reads `LeCoursville Family - January <year>`.
2. The one-click Print button is visible without opening Customize. Stub `window.print`, click, assert one call, assert `document.title` is set for the print and restored afterward.
3. The Customize disclosure is collapsed on load and expands on click.
4. Switching scope to `Single month` and choosing May renders exactly one page with title `LeCoursville Family - May <year>`.
5. Year stepper changes the rendered year, and an out-of-range value disables Print and shows validation without navigation.
6. Deceased are absent by default: the seeded `person-e` name does not appear.
7. With `Include relatives who have passed` on, `person-e` appears with the lifespan suffix `(1935-2015)`, and `person-f` appears with `(b. 1940)`.
8. Turning `Show lifespans for deceased` off renders `person-e` as `Edith Evans - <age>` with no parenthesis.
9. `Include birthdays` off removes birthday entries, and `Include anniversaries` off removes the `person-c` and `person-d` couple line.
10. Print media emulation: each page reports `scrollHeight <= clientHeight` and a computed width of 11in and height of 8.5in.
11. Chromium only: `page.pdf({ preferCSSPageSize: true })` yields a Pages count of 12 for a full year, using the same regex as `e2e/specs/songs.spec.ts:750-756`.
12. A seeded dense day renders at most 8 entry lines plus a `+N more` line and the panel shows the overflow warning.
13. Disabling the `calendar` flag and navigating to `/calendar/print` lands on `/feature-disabled`.
14. `legacyCalendarPdf` OFF: the calendar page Print button lands on `/calendar/print` and no `calendar-legacy-picker` appears. The admin sidebar does not list `Calendars`, while `/admin/calendars` still loads by direct URL.
15. `legacyCalendarPdf` ON: the calendar page Print button opens `calendar-legacy-picker` and does not navigate to `/calendar/print`. Direct navigation to `/calendar/print` redirects to `/calendar`.
16. `legacyCalendarPdf` ON: the admin sidebar lists `Calendars` again.
17. Restore `legacyCalendarPdf` to OFF in `afterEach` via `writeDb` (`features/legacyCalendarPdf/enabled`, false), per the flag-restore rule in `docs/discovery/DISCOVERY.md` D-20261030-10.
18. The console-error collector stays clean across the flow.

### Seed Additions (`scripts/e2e/seed.mjs`)

Add to the `people` map, using the existing `person()` factory at `scripts/e2e/seed.mjs:236`:

- `person-g`: unknown birth year, `birthday: { year: 0, month: 3, day: 3 }`, living. Proves the name-only rule.
- `person-h`: a dense day fixture. Five people sharing an absolute date such as `{ month: 7, day: 4 }` if needed to force the overflow path, or one person with five entries is not possible, so seed five people sharing one day.
- A same-surname spouse pair with a known anniversary date for story 10, if the existing `person-c` and `person-d` pair does not already cover the shared surname branch.

Absolute dates are used for `person-e` and `person-f` so assertions do not depend on the seed's relative month math.

### Update Existing Spec

`e2e/specs/calendar.spec.ts` currently asserts the uploaded-PDF print dialog. Replace that assertion with navigation to `/calendar/print` and the presence of `calendar-print-page`.

## Summary Of Changes

- New pure page model and formatter, `calendar-print.model.ts`, with a unit spec.
- New `CalendarPrintComponent` with options panel, live preview, and print handler.
- New child route `/calendar/print` inside `CalendarFeatureModule`, inheriting the existing guards and `calendar` flag.
- Calendar page Print button branches on `legacyCalendarPdf`: generated print route when OFF, retained `CalendarPrinterComponent` when ON, carrying year and month.
- New `legacyCalendarPdf` feature flag, default OFF, listed on `/admin/features` and seeded for e2e.
- `Calendars` admin sidebar entry gated by `legacyCalendarPdf`. The route stays reachable by direct URL.
- New named `@page calendar` and scoped print styles.
- E2E seed extended with an unknown-birth-year person, a dense day, and a same-surname couple fixture.
- New `e2e/specs/calendar-print.spec.ts` and an updated `e2e/specs/calendar.spec.ts`.
- `docs/GLOSSARY.md` gains Calendar Entry, Lifespan Suffix, Calendar Page, and Primary Record.
- No new dependency, no schema change, no server work.

## Verification Steps

1. `npx ng test --watch=false` or the project's unit runner, confirming the new model spec passes.
2. `npx ng build --configuration=e2e`.
3. Fast local e2e: `firebase emulators:exec --project lecoursville-dev --only auth,database,storage,hosting,functions "node scripts/e2e/seed.mjs && npx playwright test --project=chromium"` then the full `npm run e2e:gate` matrix.
4. Manual: open `/calendar/print` in Chrome and Safari, print preview, confirm landscape letter, 12 sheets, no blank page, no clipped cell, and legible black text on white.
5. Manual: repeat with the app in dark theme, confirming the paper stays light.
6. Manual: flip `legacyCalendarPdf` ON in `/admin/features`, confirm the Print button opens the picker, `/calendar/print` redirects, and `Calendars` returns to the admin sidebar. Flip it OFF and confirm the generated flow returns and the sidebar entry disappears.

## Open Questions

None. All material decisions are resolved above.
