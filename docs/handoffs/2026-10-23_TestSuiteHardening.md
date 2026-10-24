# Test Suite Hardening Handoff

- Date: 2026-10-23
- Branch: feat/admin-facelift
- Topic: redteam, specify, and harden the test suite for pre-deploy regression safety
- Status: complete, all gates green, nothing pushed

## Current State

Done. Four waves shipped in five local commits on `feat/admin-facelift`:

- `a827cbb9` redteam ledger plus target-suite spec
- `9b3d8244` Wave 1: unit and functions coverage
- `7a313e0f` Wave 2: e2e critical flows, false-green fixes, gate restructure
- `ff24bbf5` Wave 3: test policy, review checklist, AGENTS pointer
- final docs commit: this handoff plus discovery entries

Working tree clean. Nothing pushed, no deploy, no `ship-changes` offered.

## Before And After

| Measure | Before | After |
|---|---|---|
| E2E per browser | 217 tests | 187 tests, 0 skipped, 0 flaky |
| Once-run rules tests | 0 (ran x3 in security.spec) | 11 in `e2e/specs/rules.spec.ts` |
| Prod Storage rules tests | 0 | 7 in `e2e/specs/storage-rules.spec.ts` |
| Chromium duration | 171.6s | 155.6s |
| WebKit duration | 232.2s | 216.9s |
| Firefox duration | 231.8s | 220.3s |
| Slowest test | 7.9-9.9s reload stress | 5.1-6.6s reload stress |
| Angular unit | 80 files, 501 tests | 92 files, 573 tests |
| Functions unit | 19 files, 244 tests | 23 files, 277 tests |
| Console guard | asserted in 9 of 20 specs | asserted for every spec by `e2e/helpers/fixture.ts:16` |
| Arbitrary sleeps | 5 | 0 |
| Truthy-only component specs | 12 | 0 |
| Prod rules coverage | none | once per gate via `scripts/e2e/prod-rules-config.mjs` |

Final gate evidence: `.gate-results/chromium.json`, `webkit.json`, `firefox.json` each 187 expected, 0 skipped, 0 unexpected, 0 flaky, stamped 2026-10-24T00:24-00:31Z; `.gate-results/unit-tests.txt` 573 passed; `.gate-results/functions-tests.txt` 277 passed.

## Key Decisions

- Ledger verdict CONVERGED: 30 findings, 10 high, all addressed or rejected with evidence. `docs/critique/2026-10-23_TestSuiteHardening.md`. Spec: `docs/specs/2026-10-23_TestSuiteHardening.md`. Policy: `docs/testing/TEST_POLICY.md`.
- Prod Storage posture pinned, not changed: any signed-in user may create and delete photos and videoScreenshots and delete userUploads. User decision 2026-10-23; accepted risk recorded in `e2e/specs/storage-rules.spec.ts` and D-20261023-02.
- Non-image public upload kept as explicit characterization with a stored record and Storage object assertion. User decision 2026-10-23.
- Browserless rules tests run once; callable behavior belongs to functions specs (D-20261023-06).
- Each browser project boots its own `emulators:exec`: DB reseeds alone do not clear Storage objects or emulator process state, and the shared exec produced intermittent WebKit and Firefox expect-timeouts (D-20261023-03, D-20261023-04).
- Three load-bound waits carry documented 30s timeouts with the ledger id: the video replace poll, toast, and sink poll in `e2e/specs/media.spec.ts`; the album confirm-dialog visibility waits in `e2e/specs/admin-content.spec.ts`; the reload-stress content waits in `e2e/specs/loading.spec.ts`.
- Coverage tooling unavailable without a new dependency (`@vitest/coverage-v8` missing); none installed; the spec risk matrix is the signal and no numeric threshold exists.

## App Fixes Surfaced By New Tests

- `src/app/components/user-edit/user-edit.component.ts`: roles normalized to all three booleans before the profile write; previously the rules denied the follow-up write after `changeUserRole` and the dialog showed PERMISSION_DENIED.
- `src/app/components/admin-photo-albums/admin-photo-albums.component.ts` plus `src/app/services/photos.service.ts`: album delete now removes each photo's Storage object, and `deletePhoto` targets `photo.path || photo.url`.
- `src/app/services/people.service.ts`: unreachable `wipeAllPeopleAndCalendarEvents` deleted.

## Deleted Tests And Replacements

- 10 security callable duplicates -> `functions/src/request-password-reset.spec.ts`, `admin-generate-reset-link.spec.ts`, `submit-recovery-request.spec.ts`, `change-user-role.spec.ts`, `create-user-upload.spec.ts`.
- security no-enumeration -> `e2e/specs/account-recovery.spec.ts` UI banner test.
- admin-system recovery-close -> `e2e/specs/account-recovery.spec.ts` close flow.
- account-recovery default flow and global cap -> `functions/src/submit-recovery-request.spec.ts`.
- admin.spec 8 ranges -> admin-system, admin-people, admin-content, feature-flags, auth specs.
- feature-flags duplicate disabled-page test -> merged.
- media delete object-state asserts -> `functions/src/delete-media.spec.ts`; the UI click, confirm, and toast stay.
- security non-image probe -> stronger characterization in `e2e/specs/public-upload.spec.ts`.
- 12 truthy-only component specs rewritten in place.

## Next Actions

1. User reviews the four commits and pushes when ready; push was out of scope for this brief.
2. Optional follow-up: tighten `storage.rules.prod` delete paths behind an admin custom claim; needs ops sign-off and claim plumbing (D-20261022-11 still open).
3. Optional follow-up: install `@vitest/coverage-v8` if a numeric coverage signal is ever wanted; policy forbids gating on it.

## Verify Commands

Run from the repository root:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
npm --prefix functions run build
npm --prefix functions test
CI=true npm test -- --watch=false
npm run e2e:gate
```

All four ran green on the final tree on 2026-10-24. Expected: functions build silent, 277 functions tests, 573 unit tests, and the gate green on chromium, webkit, and firefox with 187 each plus 11 rules and 7 storage-prod, 0 skipped, 0 flaky.

## Open Risks

- Prod Storage rules remain permissive by decision; the pins in `storage-rules.spec.ts` fail if the posture drifts in either direction.
- Real AWS prerequisites for the media pipeline remain human-only (D-20261022-18).
- The three 30s documented waits are load insurance, not load immunity; a fourth distinct load-timeout site means the per-browser emulator boots are no longer sufficient and the load profile itself needs investigation.
