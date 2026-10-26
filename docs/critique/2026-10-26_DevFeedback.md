# Critique Ledger: Dev Feedback Batch 2026-10-26

- Goal: capture the owner's feedback in this session as findings, then apply every accepted item as one batch on this branch.
- Started: 2026-10-26
- Batch branch: `2026-10-26_DevFeedback`, cut from `master` at `c033a3df`
- Status: collecting findings

## Findings

Format: `ID | date | area | severity | impact | status | finding | location or repro`

- F-20261026-01 | 2026-10-26 | visual | low | medium | open | The calendar month picker nav row still has unequal vertical margins: 24px above it (from `app-page-toolbar` to the row) versus 10px below it (to the calendar grid). Owner wants the top and bottom margin equal, so the row sits centred in its own band rather than crowded against the grid. Follows F-20261025-04, which added the 24px top gap but left the 10px bottom. | `src/app/components/calendar/calendar.component.scss:71` (`.calendar-nav-row`, `margin: 24px 0 10px`), mobile top override `:287` (`margin-top: 16px`, bottom stays 10px), grid start `src/app/components/calendar-view/calendar-view.component.scss` (no top margin on the weekday header)

## Notes

_None yet._

## Open Questions

_None yet._
