# Quality Gate - Dev Review Batch (F-01 to F-20, Family Series)

- Commit context: 607ebb8e on review/dev-feedback-2026-10-25
- Date: 2026-10-25T19:35:57-0400
- Scope: every finding except withdrawn F-08, plus F-21 already landed

## GREEN-PROOF

- `npm run e2e:gate` -> exit 0.
- Angular unit suite: 92 files, 606 tests, all passed.
- Functions suite: 24 files, 291 tests, all passed.
- Prod Storage rules pass: 7 passed.
- RTDB rules project: 11 passed.
- Chromium: 212 expected, 0 skipped, 0 unexpected, 0 flaky.
- WebKit: 212 expected, 0 skipped, 0 unexpected, 0 flaky.
- Firefox: 212 expected, 0 skipped, 0 unexpected, 0 flaky.
- JSON reporters: `.gate-results/{chromium,webkit,firefox}.json`.
- Full log: `/tmp/gate-final5.log`.

## RED-PROOF

- F-16 filter-row join: the new assertion read a 16px filter top radius
  until the sibling selector was fixed. `admin-consistency.spec.ts` then
  passed on chromium, webkit, and firefox (15 each).
- F-14 replace upload: the WebKit replace test failed focused with
  `Upload asset not found.` because the client read `thumbnailBlob` after
  batch creation. Snapshotting the declared assets fixed it.
- F-17 role badges: restoring the old admin rule failed the unit case.
- F-09 tree hover: the row-hover assertion failed with `none` before the
  CSS change.
- F-10 close icon: removing the global rule failed the centre assertion
  with a 2px offset.
- F-21 cold-cache proof stays with 45ca3602 and was not re-run here.

## CRAP

CRAP-UNAVAILABLE: no coverage provider and no AST complexity tool are
installed for either project.

## Verification Steps

1. Gate green end to end: PASS, evidence above.
2. Cold-cache helper case: owned by 45ca3602, unchanged here.
3. `git grep -n "clan" -- src functions scripts e2e`: 146 lines, all in the
   allowed set.
   - `functions/src/maintenance/clan-to-family.*` (migration and its spec).
   - `scripts/migrations/clan-to-family.mjs` (runner).
   - `?clan=` readers and temporary-alias comments in people and contacts.
   - `e2e/specs/{people,contacts}.spec.ts` alias assertions.
   - `e2e/specs/rules.spec.ts` cutover assertions. Both rules nodes stay
     until the owner's cleanup pass.
4. `git grep -n "color-accent-soft"`: zero under `src`. Four hits remain in
   `docs/specs/2026-10-25_DevReviewBatch.md` and
   `docs/critique/2026-10-25_DevReview.md` as historical prose. The
   unscoped command cannot be empty without editing those documents.
5. Title bar card, radius, and 16px gap: asserted on every admin route and
   one feature page in `admin-consistency.spec.ts`.
6. Album grid: 5 columns at 1600px, 4 at 1280px, 1 at 390px asserted in
   `admin-content.spec.ts`.
7. Audio bar in Firefox: no `prefers-color-scheme` rule exists under `src`,
   the bar renders only from tokens, and the Firefox suite is green. An
   OS-level dark-mode visual check was not run by an agent.

## Notes

- Two unrelated documentation commits from a parallel session landed on this
  shared branch between batch commits: d4562465 and 9fed9e11.
- `docs/critique/2026-10-25_SignIn.md`, the session handoff, the email docs,
  and the uncommitted `package.json` edit belong to other sessions and were
  left untouched.
- The migration runner was never executed against any project. No deploy or
  push was performed.
