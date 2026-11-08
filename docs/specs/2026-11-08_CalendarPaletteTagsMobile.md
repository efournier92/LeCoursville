# Calendar Palette Tags And Mobile

Spec for UI-003, UI-006, and UI-018. Workstream WS5. Depends on WS1, including the UI-026 switch conversion and the settled brand tokens.

## Goal

Align the calendar with the brand palette, put the family color on each event tag, make the today marker brand, keep wrapped tags flush left, and make the month grid usable on a phone.

## Non-Goals

- No change to event derivation rules beyond resolving family color.
- No new calendar data node.
- No change to the print page model.

## Current State

- `RecurringEvent` has no family color (`src/app/interfaces/recurring-event.ts:4-29`). `CalendarService.deriveEventsFromPeople` sets no color (`calendar.service.ts:52-118`). `Family.hexColor` exists (`models/family.ts:4`).
- Calendar tokens are birth blue and anniversary red (`styles.scss:128-130`, `:186-188`).
- `calendar-cell.component.html` picks `border-birth`, `border-holiday`, or `border-anniv`.
- Today is honey: `.cal-today .cal-day-number` uses `--color-accent-strong` (`styles.scss:853-865`) with a stale honey comment.
- Tag labels use a hanging indent: `padding: 1px 4px 1px 12px` and `text-indent: -8px` (`calendar-cell.component.scss:55-56`, `:92-93`).
- Mobile grid forces `min-width: 700px` (`calendar-view.component.scss:127,139,159`) and 160px day cells (`styles.scss:763,769`). `.cal-month-view` clips with `overflow: hidden` (`styles.scss:828`).

## Behavior And Acceptance Criteria

### UI-003 Tag Accent And Today

- The left accent bar uses the event's family `hexColor`, resolved during derivation by joining `person.familyId`, not in the template.
- Missing family falls back to `var(--color-brand-primary)`.
- Holidays keep the neutral ink bar.
- Type stays distinguishable by icon, label, or the years-since tint, not by the bar color.
- Today circle uses `--color-brand-solid` with `--color-on-brand-solid` ink, and the cell uses a brand wash via `color-mix`.
- The stale honey comment is removed.

### UI-003 Dark Pass

- Today circle in dark uses a lighter-on-dark marker, for example `--color-brand-primary` `#8CCDA3` fill with dark ink, or a ring plus tint.
- The cell wash uses a higher mix or a dedicated dark token so it reads on `#1B1F24`.
- Family accents in dark are adapted, for example mixed toward the surface for bars and a lightened text variant.
- Verify grid lines, out-month numbers, hover, today, tag fill, tag bar, label text, holiday ink, and list view in both modes.

### UI-006 Tag Wrap

- Drop the hanging indent. Use uniform left padding and `text-indent: 0` on person and holiday labels.
- First and wrapped lines share the same left edge. The `.anniv-first-line` ampersand row still aligns.
- Single-line look does not shift more than a couple of pixels.

### UI-018 Mobile Grid

- Under 768px, `.cal-day-headers .cal-cell` and `.cal-day-cell` use `flex: 1 1 0`, `min-width: 0`, and `width: calc(100% / 7)`. No 700px or 160px minimum.
- Weekday labels shorten to one letter under about 480px.
- Cell min-height about 64px. Day number shrinks. `+N more` handles overflow.
- Header and cells share width by construction. No clipping. If any horizontal scroll remains, header and body scroll together.
- Touch targets at least 44px.

## Data Model And Rollout

- Add `familyColor` or an equivalent resolved hex to the derived `RecurringEvent`. No RTDB schema change.
- No migration. Roll back by branch revert.

## Light, Dark, And Print

- Print re-declares light values (`styles.scss:675-702`). Family bars and label text must stay legible on paper. Do not rely on background fill for print.
- Verify all four combinations: light, dark, print light, and the 3:1 bar and 4.5:1 text contrast.

## Accessibility

- Tag color is not the only distinguisher. Labels and icons carry type.
- Mobile day cells keep 44px targets.
- Contrast holds for label text on the tag fill.

## E2E Coverage Matrix

| Change | Spec file | Assertion |
|---|---|---|
| Family tag accent | `e2e/specs/calendar.spec.ts` | A seeded family event has the family hex on its bar, fallback for no family |
| Brand today marker | `e2e/specs/calendar.spec.ts` | Today circle computed background is brand solid in light |
| Dark pass | `e2e/specs/dark-mode.spec.ts` | Today marker and tag bars read in dark |
| Tag wrap alignment | `e2e/specs/calendar.spec.ts` | First and second line left offsets are equal, `text-indent` is 0 |
| Mobile grid | `e2e/specs/calendar.spec.ts` | Phone viewport shows all seven columns, header and cell left edges match, Saturday visible with no horizontal scroll |

## Seed And Test Updates

- Seed families with distinct hex colors and events tied to them.
- Seed a long tag label for the wrap assertion.

## Resolved Decisions And Open Questions

- Resolved: family color fallback is `--color-brand-primary`.
- Resolved: mobile pattern is the fluid seven-column grid.
- Open: whether to add an agenda toggle if dense days stay unreadable. Default is no.
