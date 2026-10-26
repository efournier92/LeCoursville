# Critique Ledger: Dev Feedback Batch 2026-10-26

- Goal: capture the owner's feedback in this session as findings, then apply every accepted item as one batch on this branch.
- Started: 2026-10-26
- Batch branch: `2026-10-26_DevFeedback`, cut from `master` at `c033a3df`
- Status: collecting findings

## Findings

Format: `ID | date | area | severity | impact | status | finding | location or repro`

- F-20261026-01 | 2026-10-26 | visual | low | medium | open | The calendar month picker nav row still has unequal vertical margins: 24px above it (from `app-page-toolbar` to the row) versus 10px below it (to the calendar grid). Owner wants the top and bottom margin equal, so the row sits centred in its own band rather than crowded against the grid. Follows F-20261025-04, which added the 24px top gap but left the 10px bottom. | `src/app/components/calendar/calendar.component.scss:71` (`.calendar-nav-row`, `margin: 24px 0 10px`), mobile top override `:287` (`margin-top: 16px`, bottom stays 10px), grid start `src/app/components/calendar-view/calendar-view.component.scss` (no top margin on the weekday header)
- F-20261026-02 | 2026-10-26 | visual | medium | medium | open | The custom audio transport paints its controls in brand green: the play/pause button is a green fill, both sliders take a green `accent-color`, and the active track's icon is green. Owner wants a tasteful neutral gray instead, because the transport is chrome, not a primary action, and green competes with the cover art and the page's own primary buttons. UX direction for the batch: one dark neutral for the filled toggle (`--color-ink` `#232A32`, white glyph, hover one step lighter) and one mid neutral for the sliders and active-track icon (`--color-ink-2` `#5B6470`); both already exist as tokens, so no new palette entry is needed. Keep hover and focus-visible affordances, and keep contrast against `--color-surface` `#FFFFFF` at or above 3:1 for the filled control. | `src/app/components/audio-player/audio-player.component.scss:82` (`.audio-player-toggle` green fill), `:86` (green hover), `:99` (`.audio-player-seek` `accent-color`), `:104` (`.audio-player-volume` `accent-color`), `:143` (`.audio-player-track.active` icon), tokens `src/styles.scss:69` (`--color-ink`), `:70` (`--color-ink-2`); rendered in `src/app/components/media-explorer/media-explorer.component.html:90`
- F-20261026-03 | 2026-10-26 | visual | high | high | open | The public Upload Files page does not look like the rest of the app: it is a bare 600px column of controls floating directly on the page ground, with a centred `h1` and subtitle, where every other user-facing page uses the shared `.page-ground` + `.page-content` column and sits its content on white `.surface-card` sheets with the card radius, hairline border, and card shadow. The drop zone reads as the page surface rather than as a well inside a sheet, and the complete and error states inherit the same bare treatment. Owner wants the page rebuilt on one white card styled from the existing shared conventions, using UX judgment rather than a new visual language. Direction for the batch: root gets `page-ground page-content`; one `.surface-card` sheet holds the whole flow (form, file list, complete state, error state) so the page does not jump between surfaces; a capped inner column keeps the single-action focus; the drop zone becomes an inset well on `--color-surface-muted` with a dashed `--color-border` inside the sheet rather than the page background showing through. | `src/app/components/public-upload/public-upload.component.scss:3` (`.upload-container` — `max-width: 600px`, `padding: 40px 20px`, no surface), `:11` (`h1` ad-hoc heading), `:23` (`.drop-zone` no fill), `:119` (`.file-list` uses `--color-surface-muted` as if it were the card), `:258` (`.error-message`), `:310` (`.complete-message`), template root `src/app/components/public-upload/public-upload.component.html:1`; shared conventions `src/styles.scss:358` (`.surface-card`), `:366` (`.page-ground`), `:376` (`.page-content`); peers `src/app/components/contacts/contacts.component.html:1`, `src/app/components/expressions/expressions.component.html:136`

## Notes

_None yet._

## Open Questions

_None yet._
