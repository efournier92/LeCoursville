# Critique Ledger: Admin Edits

- Goal: Validate the admin change set that gates the Calendars nav behind legacyCalendarPdf and adds its feature toggle.
- Started: 2026-11-07
- Branch: dynamic-calendar
- Lens set: correctness, testing

## Findings

- C-20261107-60 | 2026-11-07 | testing | high | high | addressed | No spec clicks admin-nav-link-calendars, flag-on coverage only asserts visibility, so a wrong href passes | e2e/specs/admin.spec.ts:129, e2e/specs/admin-system.spec.ts:272, e2e/specs/calendar-print.spec.ts:558
- C-20261107-61 | 2026-11-07 | testing | high | high | addressed | The legacyCalendarPdf feature row is proven only by total counts, no test asserts its toggle id or that toggling changes the flag | e2e/specs/admin-content.spec.ts:392-405, src/app/components/admin-features/admin-features.component.spec.ts:63-126
- C-20261107-62 | 2026-11-07 | testing | medium | high | addressed | Replacing the literal 10 with FEATURES.length makes render-count assertions self-referential, so a dropped FEATURES entry stays green | src/app/components/admin-features/admin-features.component.spec.ts:103,126
- C-20261107-63 | 2026-11-07 | testing | medium | high | addressed | FEATURE_GROUPS puts legacyCalendarPdf under Content but no test asserts membership, so moving the row to People still passes | src/app/components/admin-features/admin-features.component.ts:19, admin-features.component.spec.ts:78-83
