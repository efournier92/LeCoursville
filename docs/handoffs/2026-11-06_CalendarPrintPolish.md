# Handoff: Calendar Print Design Polish

- Date: 2026-11-06
- Branch: `dynamic-calendar`
- HEAD: `73fcb35f` (all calendar-print work is uncommitted)
- Design mode: expression (printed family artifact)

## Current State

Done and verified this session:

- `/calendar/print` now uses a single-rule masthead. Month 34pt, year 11pt
  letterspaced beside it, family mark 9.5pt uppercase on the right, one 2pt
  rule under it.
- The rejected ledger blank is replaced by a bracket tag: half-height 0.75pt
  square brackets with 0.75pt top and bottom stubs, 0.018in horizontal padding,
  no fill, no row-height change.
- Footer is `LECOURSVILLE.COM` right-aligned, no rule, no family mark.
- E2E spec rewritten for the badge contract and extended with a shared-right-edge
  and lifespan-no-clip test plus a dark-theme print test.
- Spec doc updated to the final design.
- Full gate green: 413 passed, 0 skipped, 0 flaky.

Working tree: the whole `src/app/components/calendar-print/` directory and its
e2e spec are pre-existing untracked work from the earlier feature build. This
session changed only the allowed files. Unrelated modified files elsewhere
(admin, songs, seed, models, feature flags, legacy printer) predate this session.
Nothing is committed or pushed.

## Key Decisions

- Winner is the bracket tag (variant 14-stub-tight). It was the only shape that
  read as a subtle tag, kept the right-aligned column, added no row height, and
  survived the 1-bit simulation.
- Weight-only numerals (runner-up) were rejected as the plainness the user
  already rejected.
- Full box, lone underline, top-and-bottom tag, full-height rails, and corner
  bracket were killed on print degradation or UI-chip read.
- Masthead rule settled at 2pt. 1.5pt loses authority, 3pt goes broadsheet.
- Bracket padding capped at 0.018in so a long lifespan token does not wrap the
  name.

## Next Actions

1. Human review of the rendered sheets in `/tmp/calendar-design/final/`.
   Decide whether the bracket tag is the wanted tag language, or whether to
   move to weight-only.
2. If approved, commit through `ship-changes` (user-initiated, never unprompted).
   Suggested commit split: component html/scss, e2e spec, spec doc, critique
   ledger.
3. Optional: a true 300 DPI printer proof of the dense July 4 cell and the
   Edith Evans lifespan cell. The 6pt name floor is the only fragile edge.

## Verify Commands

```bash
cd /Users/e/mnt/bnk/cs/lecoursville
npx ng test --watch=false --include=src/app/components/calendar-print/calendar-print.model.spec.ts --include=src/app/config/calendar-holidays.spec.ts
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
firebase emulators:exec --project lecoursville-dev --only auth,database,storage,hosting,functions \
  "node scripts/e2e/seed.mjs && npx playwright test e2e/specs/calendar-print.spec.ts"
```

Expect 40 unit passing and 63 e2e passing (21 tests x 3 browsers).

## Open Risks

- The bracket marks can read as pipe punctuation at arm's length. Stubs reduce
  this, but a true-size proof is the honest test.
- Entry text floors at 6pt on dense cells. That meets the contract but is the
  first thing to smear on a cheap copier.
- Dark theme prints black on white, covered by e2e test 21.

## Resume Prompt

```text
Resume the calendar-print design polish in /Users/e/mnt/bnk/cs/lecoursville.
Read docs/handoffs/2026-11-06_CalendarPrintPolish.md and
docs/critique/2026-11-05_CalendarPrintAutonomous.md first. Run the verify
commands in the handoff and note any divergence before changing anything. The
working tree is uncommitted on branch dynamic-calendar. Do not commit unless I
ask.
```
