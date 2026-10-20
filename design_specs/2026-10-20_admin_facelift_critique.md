# Admin Facelift Visual Critique Ledger

Rendered review of every admin route at 1440x900 and 390x844. Renders live
outside the repo in `/tmp/af-shots6/`; nothing image-based is committed.

Method: full-page captures with the shell content expanded, reviewed in three
critique rounds plus a targeted fix-verification pass. Round one used viewport
captures, which hid content below the fold; later rounds used expanded
full-page captures.

## Round One

Findings included: clipped captures (tooling), raw user record IDs as card
crowns, twin solid-primary and destructive buttons, media form fields
indistinguishable from the panel and stretching full width, mixed content
widths across pages, calendar URLs wrapping character by character, features
encoding state twice, recovery subtitle hierarchy and run-on mobile rows,
inconsistent dropzones, orphaned ACTIONS header, ragged album mobile header.

Fixes applied: shared content width, card surface and shadow, de-emphasized
destructive actions, 640px capped media form, URL wrapping, chip removal,
recovery row structure, neutral dropzones, header alignment, album mobile
header order, 24px bottom padding.

## Round Two

Residuals: people page still narrower than the shell, people dropzone still
sage-tinted, media filter toolbar looked empty, tab strip floated on the
ground, date and ID placeholders italic, album cards had 6px corners, section
titles outweighed page titles.

Fixes applied: people width and dropzone, media toolbar title plus live count,
surface tab strip, roman placeholders, 16px album radius, 20px section titles,
centered recovery empty states, families mobile label alignment, features copy.

## Round Three

One high-severity report was a capture artifact: the screenshot harness made
the sidebar static, pushing mobile content off-canvas. The app itself never
rendered that way; the harness now hides the sidebar for content captures.
Remaining mediums: media card alignment, empty-state centering, families COLOR
column width, dropzone icon consistency, users sort toggle width.

Fixes applied: all five, verified by measurement.

## Round Four (Convergence)

Verdict: no high-severity findings across 18 renders. Four mediums remained:
photo albums full-bleed gutter, recovery recipient action alignment, families
mobile swatch column, timestamp format drift.

All four were fixed. Targeted verification pass: PASS on all four, no
regression, overall `CONVERGED`.

## Consciously Declined

- Full visual-regression tooling. The repo has none; adding it would be a new
  test system, not part of this overhaul. Screenshots stay in scratch.
- A new empty-state component. The shared `no-results-message` plus admin
  alignment rules covers every page; adding a second component would split the
  inventory.
- M3 switch conversion for feature flags. The copy now says "Changes save
  immediately"; rewriting nine toggles to switches would change testids and
  behavior for a copy-level mismatch. Logged for a future pass, not a blocker.
