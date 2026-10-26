# Dev Review Batch: Remaining Findings Handoff

- Date: 2026-10-25
- Topic: implement the remaining findings of the dev review batch on `review/dev-feedback-2026-10-25`
- Source spec: `docs/specs/2026-10-25_DevReviewBatch.md` (committed, authoritative)
- Source ledger: `docs/critique/2026-10-25_DevReview.md` (F-01 to F-20)

## Current State

- Branch `review/dev-feedback-2026-10-25`, pushed, tracking origin:
  - base `6f3f9266` (reviewed dev build)
  - `e830cd16` on `master`: batch spec, critique ledger, glossary (committed before the branch cut)
  - `45ca3602`: F-20261025-21, DONE and verifier-passed. Cold-cache `compareAndSet` priming fix (`functions/src/helpers.ts:148-169`), `MediaUploadError.detail` + `mapMediaError` fill, `finalizeReason` bands and `[media-finalize]` logging in both upload components, console allowlist (`e2e/helpers/console.ts:31`), e2e reason assertions in `e2e/specs/media.spec.ts`, cold-cache regression tests. Gate artifact: `.gate-logs/e830cd16-F21-20261025-162601.md`.
- Working tree: clean except untracked `docs/critique/2026-10-25_SignIn.md` (owner's live sign-in review; never touch, never commit).
- `stash@{0}` `agent-f21-1792959358-11736-runtime-bump-holdout`: the owner's Node 24 / `firebase-functions` 7 bump plus `DISCOVERY.md` D-20261025-09/D-10 lines. Never pop, apply, or drop on this branch; the spec excludes it.
- Remaining work: F-01 to F-20 minus withdrawn F-08, the Family canonicalization series, the migration transform + runner, seed collapse, contract doc update, the full unit + e2e test plan, and the final `npm run e2e:gate`.

## Key Decisions And Why

- F-21 landed first and alone so it can revert independently; it deploys with the batch, not separately (owner decision, spec Rollout step 2).
- Frozen surface from F-21: the emulator branch of `compareAndSet` stays byte-identical; `FINALIZE_FAILURE` copy stays unchanged; the `role="alert"` band and testids `video-finalize-reason` / `album-finalize-reason` must survive the F-14 upload-page reorg.
- Discovery: D-20261025-11..13 committed with F-21; D-09/D-10 are held in the stash, so the next free ID is `D-20261025-14`.
- The `rules.spec.ts` post-cleanup assertions (`clans` denied) belong to the owner's cleanup pass after dev sign-off, not this batch; both node rules stay during cutover.
- No new dependencies anywhere (spec Non-Goals); the audio transport uses native media APIs + existing Material only.

## Next Actions

Ordered commits on `review/dev-feedback-2026-10-25`, one finding group per commit, following spec Rollout steps 3-4. Requirements live in the spec sections; do not restate them here.

1. Toolbar chrome (F-16): card surface + shared 16px gap + admin padding retune; update `design_specs/2026-10-22_admin_consistency_contract.md` in the same commit; `e2e/specs/admin-consistency.spec.ts` updates.
2. Calendar (F-01 to F-06): event tag tokens + inset, shared picker dismissal mechanism, nav rhythm, global dialog scale, print button.
3. People and person modal (F-07, F-09): hover affordances; `Person.deathDate` model, `Died` CSV column, deceased modal behavior, death-aware age.
4. Media and audio (F-12, F-20, F-11): square unrounded thumbnails and previews; custom audio transport keeping `.audio-player-element` semantics.
5. Admin media upload page (F-14): grouped sections + sticky bar; preserve every `data-testid` and the F-21 error band.
6. Admin albums (F-15): density ladder, 4:3 covers, in-album grid, skeleton ladder.
7. Role badges (F-17): container/on-container token pairs; delete `--color-accent-soft` outright.
8. Navigation (F-13): remove Admin nav entries; logo becomes the keyboard-accessible admin entry.
9. Close icon centering (F-10): one global rule; measure first.
10. Family canonicalization series (F-18, F-19), its own commit series: model/service rename and deletions; importer + `?family=` with read-only `?clan=` alias; migration transform + runner + unit tests; seed collapse and e2e updates; contract + discovery docs.
11. Batch integration: `npm run e2e:gate` until green; fix fallout; the F-21 media assertions run for the first time here.

## Verify Commands

- `git log --oneline -3` shows `45ca3602` on top of `e830cd16`, `6f3f9266`.
- `git status --porcelain` shows only `?? docs/critique/2026-10-25_SignIn.md`.
- `npm --prefix functions run build && npm --prefix functions test` green (23 files / 284 tests at F-21).
- `npx ng test --include src/app/components/admin-media-upload-video/admin-media-upload-video.component.spec.ts --include src/app/components/admin-media-upload-audio-album/admin-media-upload-audio-album.component.spec.ts --include src/app/services/media-upload.service.spec.ts` green (68 tests at F-21).
- Full gate, needs Java: `export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` then `npm run e2e:gate`.

## Open Risks And Blockers

- The two F-21 e2e assertions in `e2e/specs/media.spec.ts` are written but never executed; if `video-finalize-reason` does not show at the gate, debug the detail mapping (reason renders only when the raw server text differs from the mapped copy); never weaken the assertion.
- WebKit replace flake: see D-20261025-06; rerun the gate, do not widen waits.
- `:has()` fallback for the toolbar/filter-bar join and the 360px dialog overflow check carry their own mitigations in spec Production Risks.
- E2E non-negotiables: import `test` from `e2e/helpers/fixture.ts`; deterministic waits only; `retries` stay 0; restore mutated state (chat flag seeded OFF); any intentional console output needs an allowlist entry beside `[media-finalize]`.
- Deploy (`npm run deploy:*`), real Firebase projects, and running the migration against `lecoursville-dev` are owner-only. Never do them.
