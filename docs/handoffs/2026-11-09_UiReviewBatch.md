# Handoff: 2026-11-08 UI Review Batch

- Date: 2026-11-09
- Branch: `2026-11-08_UxReview`
- Mode: autonomous build and per-workstream redteam, commit-only, no push or merge
- Ledger: `docs/critique/2026-11-08_UiReviewRedteam.md`

## Current State

All eight workstreams of the UI review batch are implemented, redteamed, and gate-green on the branch. Nothing is pushed or merged.

- Items UI-001 through UI-031 implemented across WS1, WS2, WS3, WS4, WS5, WS6, WS7, and WS8.
- Ledger has 160 findings: 158 addressed, 2 rejected with evidence (C-46, C-47), none open.
- Final gate on code HEAD: 507 passed per browser on Chromium, WebKit, and Firefox, zero skipped, zero unexpected, zero flaky.
- Unit suite 921 passed across 114 files. Theme check and PII canary clean.
- Working tree clean at `7c9f82c3`.

## Commit Series

28 commits from `07165afc` to `7c9f82c3`, one implement and one fix pair per workstream. The latest study commits:

- `07165afc` plan, specs, and handoff
- `c64537c5` WS1, `a17b4179` WS1 fixes, `051d4114` WS1 ledger
- `e2565ed3` WS2, `b47a749f` WS2 fixes, `9a04e61f` WS2 ledger
- `63458457` WS4, `1e1d76b7` WS4 fixes, `48eb4974` WS4 ledger
- `f609e7d3` WS5, `aa448978` WS5 fixes, `ecd89bcb` WS5 ledger
- `14ca72c3` WS6, `6de9f3f8` WS6 fixes, `d772a1ea` WS6 ledger
- `3b61c314` WS7, `906afab7` WS7 fixes, `6bfca580` WS7 ledger
- `01111d75` WS3, `6f8f0555` WS3 fixes, `4dc5b1ef` WS3 ledger
- `996a479b` UI-005, `4926f5fb` UI-005 fixes, `6f7c2037` UI-005 ledger
- `8d72e0ac` UI-008, `3204ee28` UI-008 fixes, `b62a5a31` ledger, `7c9f82c3` ledger status fix

## Follow-up Commits

- `7bb624d2` next production deploy checklist and handoff update
- `c6046a86` dev seed Expressions attribution fix, the C-88 re-scope
- `6e06c5a3` split footer copy and UI
- `509104ba` family-voice footer copy
- `fb4189e0` footer draft marker removed on sign-off

## Key Decisions

- Open email signup is only safe because `messages` read now requires an approved user (`roles/user === true`). This was a deliberate rules-contract change, logged D-20261109-10.
- The `users/$uid` create rule binds stored `id` to `$uid` and `email` to `auth.token.email`.
- `/account` was added as a real route so the UI-029 pending-route allowlist does not 404 and new-tab targets are deep-link safe.
- UI-005 hard delete is an operator script, not a client write. Client deletes of `dataRequests` are denied. Grant and audit are one atomic update.
- UI-013 migration reads deployed rules via `Database.getRules()` and refuses when any contacts write grant exists. Migration is not run.
- UI-008 dev seed is guarded to `lecoursville-dev`, requires `--confirm`, and verifies download buffers before upload. Dev seed is not run.

## Verification

```bash
cd /Users/e/mnt/bnk/cs/lecoursville
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
npm run e2e:gate
npm run test -- --watch=false
npm run theme:check
npm run pii:check
```

Expect 507 e2e passing per browser with no skips, 921 unit passing, theme and PII clean.

## Open Human Decisions

- UI-005 final legal copy is signed off. The footer uses the family-voice split copy for Update, Remove, and Contact, and the draft marker was removed in `fb4189e0`.
- UI-008 first dev seed run and the license ledger sign-off. Nothing was downloaded or seeded.
- UI-008 `--clean` and the live download path are implemented and unit-tested but not executed.
- UI-013 migration dev then prod runs. The script, dry run, runbook, and rules snapshot are ready. Prod backup export before deletion remains your call.
- UI-027 deploy version bump is deploy-affecting and needs sign-off. `deploy.sh` was not run.
- C-88 was re-scoped. The owner meant Expressions in the dev seed, not video captions. The seed now carries the real author and year and the card dedupes the author, fixed in `c6046a86`.
- Deployment tasks are consolidated in `docs/runbooks/2026-11-09_NextProdDeployChecklist.md`. It lists every blocking sign-off, the environment contract, the dev then prod deploy order, migration ordering, post-deploy verification, and rollback.

## Open Risks

- The `.ogv` exclusion and smallest-derivative choice in the dev seed are fixed in code but unproven by a live fetch.
- The Library of Congress checksum gap is documented, not verified.
- Two low findings were rejected by design: the friendly duplicate-account message (C-46) and the client-only 8-character minimum (C-47, emulator accepts 6).

## Discovery

Logged by ID in `docs/discovery/DISCOVERY.md`: D-20261109-01 through D-20261109-10. Key traps are the RTDB ancestor-write override, the slide-toggle name binding, the gitignored env files, and the auth emulator accepting 6-character passwords.

## Resume Prompt

```text
The 2026-11-08 UI review batch is implemented and redteamed on branch
2026-11-08_UxReview in /Users/e/mnt/bnk/cs/lecoursville. Read
docs/handoffs/2026-11-09_UiReviewBatch.md and
docs/critique/2026-11-08_UiReviewRedteam.md. The batch is commit-only and not
pushed. Confirm the final gate is green, then walk the human decisions: UI-005
legal copy, UI-008 dev seed and license sign-off, UI-013 migration runs, UI-027
deploy sign-off, and the escalated C-88 captions finding.
```
