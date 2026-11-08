# Critique Ledger: Calendar Print Autonomous Polish

- Goal: Make `/calendar/print` sleek, professional, polished, modern, and printable on any quality printer.
- Started: 2026-11-05
- Branch: dynamic-calendar
- Lens set: visual, correctness, testing, maintainability

MODE: expression. This is a printed family artifact, not a web app. Web-only
checklist items (viewport, motion) are out of scope.

## Baseline

Snapshot of the rejected ledger variant:
`/tmp/calendar-print-rejected-20261105-230559/`

Rejected variant traits: heavy-thin double rule (`2.25pt / 0.75pt`), brand in
footer, entry token as right-aligned number on a lone `0.75pt` bottom rule with
a fixed `15pt` blank.

What to preserve: dynamic 4-6 week rows, fixed sheet geometry, adaptive entry
and day scale, 8-line cell cap with `+N more`, per-cell fit guard, weekend
italics, curly apostrophes, kind differentiation without gray or fill, pure
black ink on white.

User signal (verbatim): "overall, I liked the old version better: the last
version was more sleek and modern with the masthead, single horizontal line up
top, etc. I like the idea of aligning the numbers on the right-hand side, but
we need to rethink that style (I'm still thinking subtle tag/badge elements?)."

## Findings

<!-- findings appended below -->

## Findings

- C-20261105-01 | 2026-11-05 | visual | high | high | addressed | First divergence renders were contaminated: injected CSS lost to Angular scoped selectors, so the rejected underline persisted under every variant | `/tmp/calendar-design/00-ledger/jul5-cell.png`; re-rendered with !important
- C-20261105-02 | 2026-11-05 | visual | high | high | addressed | Bare vertical rails read as pipe punctuation or broken markdown rather than a tag | `/tmp/calendar-design/10-short-brackets/jul5-cell.png`; added 0.75pt top and bottom stubs per side (variant 14)
- C-20261105-03 | 2026-11-05 | visual | high | high | rejected | A four-sided box reads as a UI chip or checkbox column, not a family almanac mark | `/tmp/calendar-design/12-tight-box/jul5-cell.png`; brief bans boxed UI chips
- C-20261105-04 | 2026-11-05 | visual | high | high | rejected | A lone bottom rule repeats the rejected ledger blank and becomes a ruled ladder in dense cells | `/tmp/calendar-design/04-underline/jul5-cell.png`; same failure family as the user-rejected variant
- C-20261105-05 | 2026-11-05 | visual | high | high | rejected | Paired horizontal tag rules fuse into dark bands at 1-bit and compete with the single-rule masthead | `/tmp/calendar-design/09-tag/jul5-cell.png`; 12 rules per dense cell
- C-20261105-06 | 2026-11-05 | visual | high | high | addressed | Full-height brackets can fuse across rows and dominate 7pt names in a dense cell | `/tmp/calendar-design/02-brackets/jul5-cell.png`; half-height stub brackets keep 7px vertical clearance
- C-20261105-07 | 2026-11-05 | visual | high | high | addressed | Wider tag padding wraps a long name beside a lifespan token | `/tmp/calendar-design/18-bracket-pad/jan-lifespan-cell.png`; padding held to 0.018in, Edith Evans stays on one line
- C-20261105-08 | 2026-11-05 | visual | low | medium | rejected | Weekday band sits closer to the grid than to the masthead rule | `/tmp/calendar-design/real-A/feb4.png`; labels belong to the grid, and the close coupling is intentional
- C-20261105-09 | 2026-11-05 | visual | medium | medium | rejected | Holiday italics thin out at 6pt on a photocopy | `/tmp/calendar-design/final/jul5-copy150.png`; italic is the only no-gray differentiator, weight 500 holds at 1-bit
- C-20261105-10 | 2026-11-05 | visual | medium | low | rejected | Cell dividers measured about 0.5pt in a raster critique | `src/app/components/calendar-print/calendar-print.component.scss:234`; CSS declares 0.75pt, which is 1px at 96 DPI
- C-20261105-11 | 2026-11-05 | visual | medium | low | rejected | Entry text measured about 5pt in a raster critique | `src/app/components/calendar-print/calendar-print.component.scss:126-149`; scale vars bottom out at 6pt
- C-20261105-12 | 2026-11-05 | testing | high | high | addressed | E2E test 19 pinned the rejected ledger blank (bottom rule, 18px fixed width) | `e2e/specs/calendar-print.spec.ts:149`; rewritten to assert the bracket contract
- C-20261105-13 | 2026-11-05 | correctness | high | high | addressed | Spec doc still described the double rule, footer brand, and ledger blank | `docs/specs/2026-11-03_CalendarPrint.md:184,254,266`; spec and test plan updated to the final design
- C-20261105-14 | 2026-11-05 | maintainability | high | high | addressed | Temporary screenshot spec would run in the gate | `e2e/specs/zz-calendar-shots.spec.ts`; deleted after renders
- C-20261105-15 | 2026-11-05 | maintainability | low | high | addressed | Footer gap and brand text-align became dead after the brand moved to the masthead | `src/app/components/calendar-print/calendar-print.component.scss:201,361`; removed

## Variants

- 00-ledger: lone 0.75pt bottom rule with a fixed blank. Killed, the user-rejected baseline.
- 01-box: full 0.75pt box. Killed, reads as a UI chip or checkbox.
- 02-brackets: full-height left and right rails. Killed, fuses across rows and dominates names.
- 03-tick: single vertical rule. Killed, detached, reads as a column divider.
- 04-underline: rule hugging the digits. Killed, still a ledger blank.
- 05-corner: top rule plus right rule. Killed, reads as a stray crop mark.
- 06-letterspaced: tracked numeral plus underline. Killed, lighter glyphs and a taller stack.
- 07-weight: bold tabular numeral only. Runner-up, cleanest print but delivers no tag.
- 08-superscript: raised numeral plus underline. Killed, baseline shift hurts legibility.
- 09-tag: top and bottom rules. Killed, rules fuse into bands at 1-bit.
- 10-short-brackets: half-height rails. Advanced, then refined, bare pipes read as punctuation.
- 12-tight-box: tight full box. Killed, UI chip.
- 13-stub-brackets: brackets with stubs. Advanced.
- 14-stub-tight: tight stub brackets. Winner: reads as a tag, no wrap, survives 1-bit.
- 15-foot-corner: bottom plus right rule. Killed, asymmetric stray mark.
- 16-utag: open-top U. Killed, tray shape, no tag read.
- 17-pentag: open-bottom shelf. Killed, shelf shape, no tag read.

Masthead weights compared at 1.5pt, 2pt, 2.25pt, and 3pt. Winner: single 2pt rule.
1.5pt looks lighter but loses authority. 3pt goes broadsheet.

## Decision

Winner: the 14-stub-tight bracket tag, a pair of half-height 0.75pt brackets with
0.75pt top and bottom stubs and 0.018in horizontal padding. It is the only candidate
that reads as a subtle tag, keeps the right-aligned numeric column, adds no row
height, and survives 150 DPI and 1-bit rendering.

Runner-up 07-weight was rejected because it removes the existing treatment without
replacing it, which the user already called too plain.

Evidence: `/tmp/calendar-design/final/feb4.png`, `may6.png`, `jul5.png`, `dec.png`,
`leap.png`, `jul5-cell.png`, `jan-lifespan-cell.png`, and the 1-bit copies
`feb4-copy150.png`, `jul5-copy150.png`, `jul5-cell-copy200.png`.

## Verification

- Unit: `npx ng test --watch=false --include=src/app/components/calendar-print/calendar-print.model.spec.ts --include=src/app/config/calendar-holidays.spec.ts` -> 40 passing.
- Calendar print e2e: 21 tests x chromium, webkit, firefox -> 63 passing.
- Full gate: `npm run e2e:gate` -> 413 passed, 0 skipped, 0 flaky.
- Claim critic: 10 of 11 claims passed as stated. Claim 10 was re-scoped:
  this redesign touched only the allowed files. The model, feature flag, route,
  legacy printer, and seed edits in the working tree predate this session and
  come from the earlier uncommitted calendar-print feature build.
- Photocopy simulation: ImageMagick grayscale, 150 DPI upscale, blur, 50%
  threshold. Brackets and digits survive as discrete black shapes. The 6pt
  name floor is the known fragile edge on a cheap copier.
