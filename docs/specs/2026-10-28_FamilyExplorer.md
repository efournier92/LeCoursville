# Family Explorer (Ferland First)

## Context & Motivation

A second family's genealogy exists as a self-contained interactive poster
(`build--poster--interactive.html` in the private `TanteMariette_FamilyTreeMaker_FerlandFamily`
output tree, outside this repo: 487 lines, 1.2 MB, 348-person JSON blob, vanilla-JS IIFE,
base64-embedded photos). We want that content, minus photos, exposed as a page on the
LeCoursville domain, styled like the rest of the site, with the personal data kept out of
the checked-in codebase.

Decisions already made with the user:

- No photos in the finished product. The `photos` / base64 payloads are dropped at ingest.
- Data lives in Firebase Realtime Database under a new path; no personal data is committed.
- Access: any signed-in user (AuthGuardService), plus a feature flag so the area can be
  disabled without a deploy.
- Page is ported into Angular (no iframe, no off-brand poster CSS).
- Navbar link points directly at `/family-explorer/ferland`.
- Initial and subsequent data loads happen through an admin upload UI (paste/upload JSON),
  not a script and not manual CLI.
- Routing is generic: `family-explorer/:familyId`, with `ferland` as the first family. The admin
  UI can dynamically introduce further families; no code change per family.
- Gating: one feature flag `familyExplorer` for the whole area, plus a per-family `published`
  field on each explorer node.
- Verified at the e2e seam only (`e2e/specs/`).

## Glossary

- **Family Explorer**: one RTDB subtree at `familyExplorer/{familyId}` holding an ingested,
  photo-free person set. First explorer: `familyExplorer/ferland`. _Avoid_: family tree,
  poster data.
- **familyId**: the URL slug naming an explorer (`family-explorer/ferland`); lowercase
  `[a-z0-9-]+`, chosen at upload time. _Avoid_: family name, route param.
- **Ingest**: the admin-side transform from the poster JSON blob into the RTDB explorer
  shape (drops photos, keeps vital fields). _Avoid_: import, upload (upload is the UI act).

## Current State

- Routes: flat `Routes` array at `src/app/app-routing.module.ts:20`; flag-gated pattern
  is `canActivate: [AuthGuardService, FeatureFlagGuard]` + `data: { featureId }`
  (`src/app/app-routing.module.ts:29-30`); wildcard at `:105`.
- Feature flags: RTDB `/features` tree, `{enabled, promotedRoute?}` per id
  (`src/app/services/feature-flags.service.ts:23`); `FeatureFlagGuard` redirects to
  `/feature-disabled` when `enabled !== true` and fails open after 10 s
  (`src/app/services/feature-flag-guard.service.ts:17`).
- Navbar: links filtered by the same flags map
  (`src/app/components/navbar-links/navbar-links.component.ts:49`).
- RTDB access: `RtdbService.object<T>(path)` observable wrapper
  (`src/app/services/rtdb.service.ts:127`); precedent for a DB-served details page is
  `people.service.ts:24,37`.
- Database rules: global read requires `roles/user === true`
  (`database.rules.json:4-13`). A new top-level path needs an explicit rule entry.
- Admin: parent route `canActivate: [AuthAdminGuardService, SuperAdminGuard]`
  (`src/app/app-routing.module.ts:88`); sidebar driven by `ADMIN_NAV` in
  `src/app/admin/admin-nav.ts:31` (group `'Content'` fits this feature).
- Styling: global token system and shared page patterns
  (`.surface-card`, `.page-ground`, `.page-content`) at `src/styles.scss:56-116,347-402`;
  Material M3 green theme at `src/styles.scss:121`.
- E2e: full reset then single `ref().set(tree)` in `scripts/e2e/seed.mjs:195,490`;
  features seeded at `:425`; fixture imports `test` from `e2e/helpers/fixture.ts`.
- Source poster: person fields are
  `id, given, surname, name, suffix, sex, birthDate, birthPlace, deathDate, deathPlace,
  burialDate, burialPlace, occupation, fatherId, motherId, spouseIds, childIds,
  marriageYears, note, photos` (JSON blob at `:182` of the generated HTML).

## Goals

1. Signed-in users can open `family-explorer/ferland` and browse the Ferland genealogy:
   chart of branches, person detail panel, live name search, keyboard navigation.
2. The same route/component serves any future explorer at `family-explorer/{familyId}` with zero
   code change; a new family is added purely via admin upload.
3. Zero Ferland personal data in git: no names, dates, places, or notes in any
   committed file (source, seed, or spec fixtures use synthetic data only).
4. The page looks native to LeCoursville (tokens, fonts, surface cards, M3 theme),
   not like the poster.
5. A super-admin can create or replace any family's explorer through `/admin` by
   uploading the poster's JSON blob; ingest strips photos and stores a display title,
   slug, and published state.
6. The area is flag-gated (`familyExplorer`) in the route and navbar; individual families
   publish/unpublish via their explorer node.

## Non-Goals

- Photos in any form (no Storage, no base64).
- Editing individual person records in the admin UI; upload replaces the whole explorer.
- Genealogy research features beyond what the poster already does (search, pin, panel).
- Making the explorer UI advertise a public family catalog; nav goes straight to
  `/family-explorer/ferland` per user decision. A future `/family-explorer` landing is a non-goal.
## Prerequisites

- The poster JSON (person array extracted from
  `build--poster--interactive.html`'s `#people` script tag) available to the admin as a
  file for upload. Extraction is a manual step in the private repo; this repo never
  stores it.
- Flag `familyExplorer` set to `{enabled: true}` in the target RTDB after deploy.

## Design Principles

- Reuse before writing: guards, flag service, `RtdbService`, admin module patterns,
  `surface-card` page scaffolding.
- Personal data crosses the trust boundary only at the admin upload; everything
  downstream reads from RTDB.
- Port behavior, not code: reimplement the poster's interactions as Angular template +
  component logic; do not paste in the IIFE.
- Minimal diff: one lazy-loaded feature module, one service, one admin page, one spec.

## Backend / Data Requirements

### RTDB shape

```
familyExplorer/{familyId}: {
  title: string,              // display title, e.g. "Ferland Family"
  published: boolean,         // per-family visibility switch
  updatedAt: number,          // server ts set at upload
  updatedBy: string,          // admin uid
  people: { [id: string]: FamilyPerson }
}
```

`familyId` is a slug matching `^[a-z0-9-]+$` (validated at upload).

`FamilyPerson` (all fields except `id` optional-null; poster fields minus photos):

```
id, given, surname, name, suffix, sex, birthDate, birthPlace, deathDate,
deathPlace, burialDate, burialPlace, occupation, fatherId, motherId,
spouseIds: string[], childIds: string[], marriageYears: {[spouseId]: number}, note
```

Ingest rule: `photos` is dropped and never stored. Unknown extra fields in the uploaded
JSON are dropped. Ingest fails (inline admin error, nothing written) when: JSON parse
fails, top-level is not an object with a `people`-equivalent array, fewer than 2 records,
any record lacks `id` / has a duplicate `id`, `familyId` fails the slug regex, or `title`
is empty/missing. A successful upload to an existing `familyId` replaces that explorer
node wholesale (metadata + people).

### Rules

Add to `database.rules.json` alongside the existing global read rule:

- `familyExplorer`: read requires `roles/user === true` (same predicate as existing rules
  at `database.rules.json:4-13`); write requires `roles.super === true`.

### Service

`src/app/services/family-explorer.service.ts`:

- `FamilyPerson` and `FamilyExplorer` interfaces (shapes above).
- `getExplorer(familyId: string): Observable<FamilyExplorer | null>` via
  `RtdbService.object<FamilyExplorer>('familyExplorer/' + familyId)`.
- `listExplorers(): Observable<Record<string, {title, published, updatedAt}> | null>` for
  the admin list.
- `ingest(familyId: string, title: string, published: boolean, rawJson: string):
  Promise<void>` (admin only): validates familyId slug, title, and JSON per the ingest
  rule, maps `photos` out, writes the full node (metadata + people, `updatedBy` from
  current auth uid) via `RtdbService` set.

### Admin upload page

- New admin route key `familyExplorer` in `ADMIN_ROUTE`/`ADMIN_NAV`
  (`src/app/admin/admin-nav.ts:4,31`), group `'Content'`, no `featureFlag` field.
- Page has two states:
  - **List**: existing explorers (title, familyId, published toggle, updatedAt); "New /
    replace" form.
  - **Upload form**: fields `familyId` (slug; preselects existing ids as a datalist),
    `title`, `published` checkbox, textarea or file input for the JSON, preview count of
    parsed persons before submit ("348 people"), inline validation errors from the
    ingest rule, confirm button, success shows person count + timestamp.
- Follow existing admin form styles (`src/app/styles/admin-forms.scss`).
- The published toggle on the list writes only `familyExplorer/{id}/published`.

## Frontend / UI Requirements

### Route

Append to `src/app/app-routing.module.ts` routes (after `people`, ~line 74):

```
{
  path: 'family-explorer/:familyId',
  loadChildren: () => import('./components/family-explorer/family-explorer.module')
    .then(m => m.FamilyExplorerModule),
}
```

Unknown or unpublished `familyId` resolves inside the component (not a guard): the page
shows a "This family explorer is not available" empty state, so adding families needs no
route changes. The route parameter name is `familyId`.

### Module / components

`src/app/components/family-explorer/` (lazy module, mirroring `media`/`calendar`):

- `FamilyExplorerComponent`: page shell using `.page-ground` / `.page-content` /
  `.surface-card` scaffolding; reads `familyId` from the route; toolbar shows the
  explorer `title` and the live name search input (poster behavior `applySearch`,
  filters lineage/branches).
- `FamilyChartComponent`: roots row + branch sections rendered from the
  people map; person units are buttons; hover reveals details after the poster's timer
  behavior; click pins (`setPinnedUnit` equivalent); keyboard navigation across units.
- `FamilyPanelComponent`: side `<aside>` detail panel showing name, vital
  dates/places, burial, occupation, note, parents/spouses/children as clickable links
  (re-select), marriage years.
- Empty/loading/error states: while RTDB resolves, skeleton; explorer node null or
  `published !== true` -> "This family explorer is not available" empty state, not an
  error.

### Styling

- All component SCSS uses tokens from `src/styles.scss:56-116` and the M3 theme; no
  copied poster CSS values, no inline base64, no new font imports.
- Branches/units layout may use CSS grid; visual language (radius, shadow, green
  primary, Inter) matches other list pages (people, contacts).

### Navbar

Add a nav entry in the navbar links table filtered by the flags map
(`src/app/components/navbar-links/navbar-links.component.ts:49`), label "Ferland Family",
linking directly to `/family-explorer/ferland`, visible only when `familyExplorer.enabled === true`.
Later families get their own entry the same way (one line each), which is the accepted
cost of the direct-link decision.

### Enum/label mapping

- `sex`: `M` -> "Male", `F` -> "Female", other/null -> blank.
- Dates render as-is (strings from the poster); blank-safe.

## Production Risks & Mitigations

- **Data leakage via commit**: mitigation, no real data in repo; e2e seeds synthetic
  records only; review gate on this spec's summary.
- **Overwrite blast radius**: admin upload replaces the whole node; a bad upload bricks
  that family's page. Mitigation - preview + confirm in the admin UI; ingest validation
  floors (>= 2 persons, slug, title) prevent empty wipes from a stray paste.
- **Flag fails open** (guard 10 s timeout): acceptable; consistent with existing
  features, rules still block data reads for unauthenticated users, and `published`
  gives a second, DB-side kill switch per family.
- **Large dataset UX**: 348 nodes is fine for one RTDB node without photos (~ tens of
  KB); no pagination needed.

## Rollout Plan

1. Merge code (routes, guards, module, admin page, rules, seed, spec) with flag absent
   (disabled by default: `enabled !== true` redirects).
2. Deploy via `scripts/deploy.sh` gate as usual.
3. Super-admin sets `familyExplorer` flag true in `/admin/features`.
4. Super-admin uploads the extracted poster JSON at `/admin/family-explorer` with
   familyId `ferland`, title "Ferland Family", published on.
5. Page live at `/family-explorer/ferland`. Future families: admin upload only, then a one-line
   navbar entry if desired.

## Test Plan

Single seam: `e2e/specs/family-explorer.spec.ts` (import `test` from
`e2e/helpers/fixture.ts`, deterministic waits, restore flags).

Seed additions (`scripts/e2e/seed.mjs` tree): synthetic explorers,
`familyExplorer/ferland` (6-8 fake persons across 2 branches with parent/spouse/child
links and one note, `published: true`) and `familyExplorer/wolf` (2 fake persons,
`published: false`) to prove the publish switch and multi-family routing; flag
`familyExplorer: {enabled: true}`.

Cases:

1. Unauthenticated visit to `/family-explorer/ferland` does not show family content (auth gate).
2. Signed-in non-admin with flag on: `/family-explorer/ferland` renders branches and person
   units count matches seed.
3. Search input filters units live; clearing restores (poster `applySearch` behavior).
4. Clicking a unit opens the panel with name, dates, note; clicking a relative link in
   the panel re-selects that person.
5. Keyboard navigation moves focus between units; Enter opens the panel.
6. Flag off (toggle in test, restore after): route redirects to `/feature-disabled`;
   navbar link hidden when off, visible when on.
7. Unpublished family: `/family-explorer/wolf` shows the "not available" empty state; toggling
   `published` on (restore after) makes it render.
8. Unknown familyId: `/family-explorer/nosuch` shows the "not available" empty state.
9. Admin upload happy path: sign in as seeded super-admin, open the admin page, create
   familyId `test` with a small valid synthetic JSON, preview shows count, confirm
   writes and `/family-explorer/test` shows the new data.
10. Upload validation: malformed JSON, duplicate-id JSON, bad slug ("Test!"), and empty
    title each show inline errors and leave existing data unchanged.
11. Replace flow: uploading again to `ferland` replaces data (person count updates).
12. No console errors on any of the above (fixture collector).

## Summary Of Changes

- [ ] `src/app/app-routing.module.ts`: add lazy `family-explorer/:familyId` route without guards; the route is public.
- [ ] `src/app/components/family-explorer/` module: shell, chart, panel components with
      site-token styling, search, pin, keyboard nav, empty states.
- [ ] `src/app/services/family-explorer.service.ts`: `FamilyPerson`/`FamilyExplorer`,
      explorer read, explorer list, validated photo-stripping ingest.
- [ ] `src/app/admin/`: new `familyExplorer` route/page: list with publish toggles +
      create-or-replace upload form with preview and validation.
- [ ] `src/app/admin/admin-nav.ts`: nav entry, group `'Content'`.
- [ ] Navbar links entry "Ferland Family" -> `/family-explorer/ferland`, flag-filtered on
      `familyExplorer`.
- [ ] `database.rules.json`: `familyExplorer` read (user) / write (super) rules.
- [ ] `scripts/e2e/seed.mjs`: synthetic `familyExplorer/ferland` (published) and
      `familyExplorer/wolf` (unpublished) + `familyExplorer` flag.
- [ ] `e2e/specs/family-explorer.spec.ts`: cases 1-12.
- [ ] No real Ferland data anywhere in the diff.

## Verification Steps

1. `npm run e2e:gate` green.
2. `git grep -iE "ferland|TanteMariette" -- src e2e scripts` returns only synthetic
   identifiers, no real person names.
3. Manual: emulator up, flag on, upload synthetic JSON in admin, browse
   `/family-explorer/ferland`.

## Open Questions

None. All frontier decisions resolved with the user (data hosting, access, port shape,
nav, ingestion, route, seam).
