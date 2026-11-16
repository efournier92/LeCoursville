# Admin People Browser

Spec for UI-014. Workstream WS2. Depends on WS1.

## Goal

Make `/admin/people` a dense, scannable browser of every person, with CSV import still reachable. This is the admin default people surface and the People surface preserved when legacy contacts retire in UI-013.

## Non-Goals

- No person editing in this change. View and navigate only.
- No new People data model.
- No rewrite of the CSV import flow. It moves behind a toolbar action or tab.

## Current State

- `/admin/people` maps to `AdminPeopleImportComponent` (`admin.module.ts:62-63`). The page is a CSV upload and validation flow (`admin-people-import.component.html:1-23`).
- `PeopleService.people$` is live (`people.service.ts:19`).
- The reference admin table is `admin-users.component.html:96-146` with search, sort, `admin-table`, and pagination. Shared styles live in `src/app/styles/admin-data.scss`. Pagination helpers live in `src/app/admin/pagination.ts`.
- `Person` is `src/app/models/person.ts:1-34`.

## Behavior And Acceptance Criteria

- Default surface is a dense table of all people with columns: name, family, generation, born, died, anniversary, spouse, contact summary, address summary, living, updated.
- Cells are single line with ellipsis and a title tooltip. No card layout. Tight row height.
- Client-side search across name, family, and contact values.
- Sort on name, family, generation, born, updated.
- Pagination matches the admin users table page size.
- Row click opens the person record in `person-detail-modal` for view.
- CSV import is reachable from the same page as a toolbar action or tab.
- Empty, loading, and error states reuse the admin skeleton and `app-load-error`.
- On mobile the table scrolls horizontally or stacks, with no clipped column.

## Route And Data Changes

- Keep route `ADMIN_ROUTE.people`. The route component becomes a browser component that hosts the import as a secondary tab or action.
- No data model change. No migration.
- Rollback is a branch revert.

## Light, Dark, And Print

- Table, header, and pagination follow the admin table tokens.
- No print requirement. Do not add a print stylesheet.

## Accessibility

- Table uses real `table`, `thead`, `th`, and scope.
- Search and sort controls are labeled.
- Row navigation is keyboard reachable and announces the target.

## E2E Coverage Matrix

| Change | Spec file | Assertion |
|---|---|---|
| Table renders all people | `e2e/specs/admin-people.spec.ts` | Seeded people all present, columns visible |
| Search, sort, pagination | `e2e/specs/admin-people.spec.ts` | Search narrows rows, sort changes order, pagination moves pages |
| Row opens detail | `e2e/specs/admin-people.spec.ts` | Click opens `person-detail-modal` with the right person |
| Import still reachable | `e2e/specs/admin-people.spec.ts` | CSV import action opens the existing flow |
| Empty and error states | `e2e/specs/edge-cases.spec.ts` | Empty collection shows an empty state, load failure shows `app-load-error` |

## Test Data

- Extend `scripts/e2e/seed.mjs` with enough people to exercise pagination, or reuse the existing people set if it already spans a page.

## Resolved Decisions And Open Questions

- Resolved: detail is the existing `person-detail-modal`.
- Resolved: CSV import moves to a toolbar action on the same page.
- Resolved: pagination page size matches the users table.
- Open: whether editing ships as a follow-up admin route. Default is follow-up.
