# Admin Consistency Contract (2026-10-22)

One page skeleton and one set of primitives for all nine `/admin` routes, the
admin shell, and every dialog opened from admin. Existing tokens and Material
base stay; this normalizes and refines, it does not redesign.

## Page skeleton

Every admin page renders, in order:

1. `app-page-toolbar` — the title bar. Fixed height, never grows.
2. Optional `admin-filter-bar` — search/sort/segmented controls, fixed height,
   rendered only when the page has filters.
3. Page content.

The admin shell owns page width and gutters. Pages must not re-declare
`max-width`, `margin: auto`, or horizontal padding.

## Title bar

- Desktop height 64px, mobile (<=600px) 56px, `box-sizing: border-box`.
- Padding 0 16px; no vertical padding.
- Title: 1.25rem, weight 600, line-height 1.2, single line, ellipsis.
- Actions slot: right-aligned, vertically centered, control height 36px
  (desktop) and 36px (mobile). Never more than one primary action plus icon
  buttons in the bar.
- No inputs, filters, sort menus, or segmented controls inside the title bar.
- Optional one-line subtitle sits inside the 64px bar under the title at
  0.8125rem, ink-2; its presence must not change the bar height.
- Background: `--color-surface`; 1px `--color-border` bottom border; no
  radius, no shadow (the bar is chrome, not a card).

## Filter bar

- Only when the page has search, sort, or segmented filters.
- Desktop 56px, mobile 52px; padding 8px 16px; flex, wrap disabled at desktop.
- Search field on the left, flex 1, max-width 420px, height 36px.
- Sort control and segmented filters on the right, height 36px.
- Mobile: search takes the full first row; sort/segments wrap to a second row
  inside the bar. The bar may grow to 96px on mobile, never beyond.
- Same white-fill outlined field recipe as the title-bar-era fields; one
  shared class, no per-page `::ng-deep`.

## Surfaces

- One `.admin-surface`: `--color-surface`, `--radius-card`,
  `--shadow-card`, `border: 1px solid var(--color-border)`.
- Every admin card, table container, form card, and empty/error state uses it.
- No `mat-elevation-z*` on admin surfaces.
- Section heading inside a surface: 20px/600, 0 0 12px.

## Spacing and type

- Add spacing tokens on `:root`: `--space-1: 4px`, `--space-2: 8px`,
  `--space-3: 12px`, `--space-4: 16px`, `--space-5: 24px`, `--space-6: 32px`.
- Add `--header-height: 64px` and `--filter-bar-height: 56px`; the admin shell
  references them instead of hardcoding 64px.
- Body copy 0.875rem; metadata 0.8125rem; eyebrow 0.7rem uppercase.
- One intro style `.admin-intro`, present on every page that has explanatory
  copy, directly under the filter bar (or title bar when there is no filter).

## States

- Error banners: `.admin-error` in `styles/admin-data.scss`, mounted directly
  under the toolbar/filter bar, full content width.
- Loading: existing `.admin-skeleton-rows`; no page-specific skeletons.
- Empty: `app-no-results-message` with page-specific title and hint; never the
  people-search default copy on a non-people page.

## Lists

- Tables use `.admin-table`. Desktop row height 44px, 0.875rem.
- Pagination: card footer, `Showing x-y of z` on the left, Prev/Next on the
  right. No floating paginator, no extra "Page 1 of 1" counter.
- Users becomes a table: Name, Email, Last Active, Registered, Roles, Actions.
  Row Edit opens the existing editor in a dialog; Delete lives in the row.
- Lists that can grow without bound paginate: recovery requests, recipients,
  and audit rows.

## Dialogs

- All admin dialogs use `mat-dialog-title`, body, `mat-dialog-actions
  align="end"`, primary action last.
- Album create/rename use the existing `PhotoAlbumEditDialogComponent`.
- Media audio/video upload keeps in-page tabs (not dialogs) but uses
  `.admin-surface` and the same action row as dialogs: 36px buttons, right
  aligned, no full-width buttons.

## Mobile

- Workable at 360px wide with no horizontal overflow.
- Title bar: title + at most one icon action; primary actions that do not fit
  move to the filter bar or content header.
- Any action row with 3+ controls wraps.
- Tables collapse to cards below 600px using the existing `.admin-table`
  responsive contract; label only ambiguous fields.

## Naming

- Nav label and page title match exactly. `People Import` becomes `People`.
- One term per concept: use "Search" for text filtering, "Filter" only for
  structured facets.

## Verification

- Unit suite green; `npx ng build --configuration=e2e` green.
- Chromium e2e for changed routes green after each increment.
- Full gate (unit + chromium/webkit/firefox) at phase end.
- Title-bar height is asserted in e2e at desktop and mobile for all nine pages.
