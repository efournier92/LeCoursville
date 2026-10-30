# Spec: Family Explorer Feedback Batch 2026-10-28

- Source: `docs/critique/2026-10-28_FamilyExplorerFeedback.md` (F-20261028-01 to F-20261028-07)
- Branch: `other-family-explorer`, base `51fd8cdb`, pre-batch head `ca2865ad`
- Status: approved by the owner in session, implementing
- Gate: `npm run e2e:gate`

## Goal

Turn the Family Archives feature into the Family Explorer: a standalone, shareable family tree for the Ferland family, plus an admin page that looks and behaves like the rest of admin, and naming corrected everywhere. One batch, one branch.

## Decisions

- DC-20261028-01 | F-20261028-02, OQ-20261028-02 | The public name, route, code identifiers, docs, feature flag id, and RTDB path all become Family Explorer. Route `/family-explorer/:familyId`; flag id `familyExplorer`; path `familyExplorer/{familyId}`; module `src/app/components/family-explorer/`; service `FamilyExplorerService`; admin route `/admin/family-explorer`. No alias or redirect from the old path: the feature has never shipped.
- DC-20261028-02 | F-20261028-06, OQ-20261028-01 | The explorer is public for published families. No sign-in, no guards, no LeCoursville chrome. A family is visible only when `published === true`; unpublished nodes are not readable anonymously. This is a rules change and requires human sign-off before deploy; the batch ships it enabled on the emulator only.
- DC-20261028-03 | F-20261028-06 | The explorer renders in a chrome-free layout: no toolbar, logo, nav, or sign-in. Implemented as route data checked by the app shell, so the same bundle serves both experiences.
- DC-20261028-04 | F-20261028-03 | Success feedback is one shared inline banner, not a snackbar. It uses `role="status"`, an icon, and lives where the operator is looking; no new global notification primitive.
- DC-20261028-05 | F-20261028-04 | Admin copy uses Title Case for page titles, card titles, column headers, field labels, button labels, and empty-state headlines.
- DC-20261028-06 | F-20261028-05, F-20261028-07 | The explorer reproduces the source poster's information architecture, restyled in LeCoursville tokens. The side detail panel stays.

## Contracts

1. Tokens only. No hex literals outside `src/styles.scss`; no copied poster CSS values, no new fonts.
2. Surfaces. Admin cards use `.admin-surface` and the shared 16px stack. The explorer is a white page ground with hairline-ruled sections, not a stack of surface cards.
3. Tree visibility. The chart shows roots, per-family branches, generation nesting with guide lines and connector ticks, spouse lines, and generation dividers at rest.
4. Access. Public reads are scoped to `familyExplorer/$familyId` and require `published === true`; everything else stays auth-gated.
5. Determinism. No `test.skip`, no sleeps, `retries` 0, console collector from `e2e/helpers/fixture.ts`, fixtures from `scripts/e2e/seed.mjs`.
6. Copy for user-facing text goes through `wordsmith` before landing.

## Work Items

### W1 Rename to Family Explorer (F-20261028-02)

- Route: `src/app/app-routing.module.ts:77` becomes `family-explorer/:familyId`, lazy module `./components/family-explorer/family-explorer.module` exporting `FamilyExplorerModule`; drop `AuthGuardService` and `FeatureFlagGuard` from this route (DC-20261028-02), keep `resolve`-free availability inside the component.
- Admin route `admin/family-archives` becomes `admin/family-explorer`; component directory `src/app/components/admin-family-explorer/`.
- Feature flag id `families` becomes `familyExplorer` in `src/app/config/feature-config.ts:22`, the navbar link table, and the seed. Nav label "Family Explorer", route `/family-explorer/ferland`.
- RTDB path `familyArchive` becomes `familyExplorer` in `database.rules.json`, the service, seed, and admin component.
- Service file to `src/app/services/family-explorer.service.ts` with `FamilyExplorerService`, `FamilyExplorer`, `FamilyExplorerListItem`, `parseFamilyPeople` unchanged in behaviour.
- Rename `docs/specs/2026-10-28_FerlandFamilyArchive.md` to `docs/specs/2026-10-28_FamilyExplorer.md` and update the glossary terms inside.
- Done-check: `grep -ri "familyarchive\|family-archive\|families/:familyId" src e2e scripts database.rules.json docs/specs` returns only intentional historical references in `docs/critique/` and `docs/handoffs/`.

### W2 Chrome-free standalone experience (F-20261028-06)

- Add `data: { layout: 'bare' }` to the explorer route. `src/app/app.component.html:5` wraps the `mat-toolbar` in `@if (layout !== 'bare')`, read from the activated route's route data in `app.component.ts`; `body.app-container` keeps its ground.
- No sign-in affordance, no logo, no nav on the explorer. A small "LeCoursville" text link back is allowed only at the page footer and only if it does not read as nav; default is none.
- Done-check: e2e loads the explorer signed out and asserts zero `mat-toolbar`, no `nav-links`, no Sign In text.

### W3 Public read for published families (F-20261028-06, DC-20261028-02)

- `database.rules.json`: remove the blanket read at `familyExplorer` and place reads per child.
  - `familyExplorer/$familyId/.read`: `data.child('published').val() === true || (auth != null && root.child('users').child(auth.uid).child('roles/user').val() === true)`.
  - Keep `.write` at the parent for `roles/super`.
  - Listing: admin needs the parent collection, so add `familyExplorer/.read` for `roles/admin` (or `roles/super`) only; document why a parent grant is safe here (it only widens authenticated admin reads).
- `published` toggling writes `familyExplorer/$familyId/published` through the rules above.
- Done-check: e2e signed out reads published `ferland`; signed out read of unpublished `wolf` fails; signed out write fails.

### W4 Admin page rebuild (F-20261028-01, F-20261028-04, DC-20261028-05)

- Two white `.admin-surface` cards on the shared 16px stack, each with an `.admin-card-title`: "Archives" (the list) and "Upload Archive" (the form). No nested `.form-section` inside the list card; delete `margin-top` shims.
- Intro line stays directly under the toolbar as `.admin-intro`, in Title Case headline plus one sentence.
- List card: card title, then the shared `.admin-table`; headers Title, Family ID, Published, Updated; empty state in the card body; publish toggle stays a compact 36x20 switch with an `aria-label`.
- Form card: `admin-forms.scss` conventions; fields `Family ID`, `Title`, `Published`; file row keeps a real drop/choose affordance; preview count; `Confirm Upload` primary; `Reset` secondary. Validation errors use `.admin-error`; both are inside the form card above the button row.
- Title Case for every label, header, button, and empty-state headline. Replace the em dash for a missing date with a neutral "Not yet updated".
- Done-check: every section is inside a white card, exactly one 16px gap between the two cards, no sentence-case labels remain, and the page matches the admin conventions in `src/styles.scss` and `src/app/styles/admin-data.scss`.

### W5 Confirmation feedback (F-20261028-03, DC-20261028-04)

- Add `.admin-success` to `src/app/styles/admin-data.scss`: 12px/16px padding, 4px left border in `--color-success` or `--color-brand-success-dark`, muted tint background, icon slot, `--radius-sm`.
- Use it in the admin family-explorer page as `<div class="admin-success" role="status" aria-live="polite">` in the Upload Archive card, above the button row, with a check icon and copy naming the archive and the count: `Uploaded the <title> archive with <N> people.` Keep it visible after the form resets.
- Move focus and scroll to the banner after success where the platform allows, using a template ref plus `scrollIntoView({ block: 'nearest' })` and no timers.
- The list card updates from its existing subscription; assert the new row appears in the same test.
- Done-check: e2e uploads a synthetic archive, asserts the status region is visible with the right copy and that the row appears in the list.

### W6 Explorer tree rendering (F-20261028-05, F-20261028-07, DC-20261028-06)

- Page: white ground, poster masthead adapted to LeCoursville (archive title, subtitle counts, labelled search), a full-width Roots row, then the chart. No `.surface-card` wrapper around the chart.
- Chart: masonry columns (`columns: 300px`, `break-inside: avoid`) of per-family branch cards. Each branch has a numeral row (tint dot, uppercase numeral, family label), a head unit with a left tint border and larger name, a `.kids` nested subtree with one indent per generation, a vertical hairline guide per generation, a 6px tick per child, spouse lines under the blood line, memo chips for marriage years, and a generation divider with an uppercase label and right-aligned count.
- Family colours: reuse the People page's family colour tokens so a family keeps its accent; the tint dot and head border use it.
- Side panel: fixed 360px on `min-width: 1024px`, sticky masthead padding adjusted to match; below 1024px it becomes an inline card below the chart. Uppercase field labels, linked relatives that re-select, note block, marriage years.
- Search filters units live and restores on clear; keyboard navigation across units stays; hover detail follows the poster's timer behaviour without arbitrary sleeps in tests.
- Availability states: skeleton while loading, "This family archive is not available" for null or unpublished, styled as a page-level state, not an error.
- Done-check: e2e asserts the tree structure (roots row, at least two generations nested, a guide element, a tick element, generation dividers), the side panel content for a selected person, and that the page is chrome-free. Structural assertions by `data-testid` survive restyling.

## E2E Coverage

- `e2e/specs/family-explorer.spec.ts` (renamed from `family-archives.spec.ts`): public access, unpublished denial, tree structure, panel, search, keyboard, responsive panel at 390px, chrome-free shell.
- `e2e/specs/admin-family-explorer.spec.ts` (new): list, publish toggle, upload success banner, upload failure, Title Case spot checks, card stack gap.
- `e2e/specs/security.spec.ts`: anonymous write to `familyExplorer` is denied; unpublished familyId is not readable anonymously.

## Out Of Scope

- Authentication for relatives, invite links, or per-visitor accounts.
- Photos, or any re-import of base64 assets.
- Deploy. The rules change ships to the emulator only until the owner signs off.

## Rollback

The batch is code plus rules plus seed. Reverting the branch restores the previous naming and the auth-gated read rule; the emulator holds no persistent data.
