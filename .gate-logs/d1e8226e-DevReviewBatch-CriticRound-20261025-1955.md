# Quality Gate - Dev Review Batch, Critic Round

- Commit context: d1e8226e on review/dev-feedback-2026-10-25
- Date: 2026-10-25T19:55:00-0400
- Scope: adversarial review of the unpushed batch, then fixes

## GREEN-PROOF

- `npm run e2e:gate` -> exit 0.
- Angular unit: 92 files, 606 tests passed.
- Functions: 24 files, 298 tests passed (14 transform cases).
- Prod Storage rules: 7 passed. RTDB rules: 11 passed.
- Chromium, WebKit, Firefox: 212 expected each, 0 skipped, 0 unexpected,
  0 flaky.
- JSON reporters: `.gate-results/{chromium,webkit,firefox}.json`.
- Full log: `/tmp/gate-final6.log`.

## CRITIC FINDINGS AND DISPOSITION

- Duplicate-name merge. Rejected as a bug: the spec keeps the clan record
  and id when names overlap, and the colour conflict is reported. The
  ignored duplicate now gets a `duplicate-name` conflict.
- Key collision reverted an admin rename. Confirmed and fixed.
- Key-collision skip starved a same-name family. Confirmed and fixed.
- Same-key colour edit lost without a conflict. Confirmed and fixed.
- Same-key `sortOrder` edit lost without a conflict. Confirmed and fixed.
- People pointing at a replaced family id kept a dangling reference.
  Confirmed and fixed.
- People pointing at an ignored duplicate-name family kept a dangling
  reference. Confirmed and fixed.
- Zero-year `deathDate` produced a negative age. Confirmed and fixed.
- `?clan=` self-heal pushed a history entry. Fixed with `replaceUrl`.

## RED-PROOF

The six transform cases and the modal case were run before their fixes:

- Key collision: families copy reverted the rename, no conflict.
- Skipped clan: `families/abc` missing from output.
- Same-key colour: clan copy kept, `conflicts: []`.
- Same-key `sortOrder`: clan copy kept, `conflicts: []`.
- Replaced family id: `p1.familyId` stayed `abc` after `abc` disappeared.
- Duplicate loser id: `p3.familyId` stayed `def` after `def` was ignored.
- Zero-year death: age rendered `-35` for a 1935 birth.

Each test asserts the post-fix state and fails against the pre-fix source.
Functions suite after the fixes: 298 passed.

## CRITIC PROBES AFTER FIXES

- Skipped-clan probe: keys `['xyz','abc']`, `familiesOut: 2`,
  `familiesOnly: 2`.
- Recolour probe: clan hex wins, `color` conflict with both hexes.
- Remap probe: `familyId: 'abc' -> 'zzz'`, `familyIdsRemapped: 1`.
- Duplicate loser probe: `familyId: 'def' -> 'abc'`, remapped count 1.
- Reruns stable for skip and collision shapes; ordering deterministic.

## REMAINING RISK

- `--apply` writes the whole `families` node from a snapshot. Admin edits
  made while the script runs are outside the merge and can be overwritten.
  The runner exports before writing and the spec forbids admin edits during
  the run; the owner must keep that rule.
- A rerun reports a persistent `key-collision` for a renamed family. That
  is stable reporting, not loss.
- The app is deployable now. The migration must still run as the spec says:
  dry run, review, export, apply, verify, then a second apply.
