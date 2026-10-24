# Test Suite Hardening

- Branch: feat/admin-facelift
- Status: implementation-ready
- Ledger: docs/critique/2026-10-23_TestSuiteHardening.md
- Goal: make the suite prove pre-deploy regression safety on critical paths, stop false-green tests, and trim runtime without losing confidence.

## Context And Motivation

The gate is green on the recorded artifacts but not trustworthy as a pre-deploy signal. Four independent lenses and a claim attack found:

- The console collector is recorded but never asserted by the shared fixture, and 11 of 20 spec files never assert it.
- The console allowlist `/net::/` swallows every Chromium failed request.
- The deployed Storage ruleset has no executed coverage; the emulator runs an allow-all file instead.
- 22 of 33 security tests are browserless REST calls that run three times.
- Several e2e tests assert optimism, not persistence, or pass if the feature is deleted.
- The baseline gate itself failed once under load on WebKit in `media.spec.ts:525`, then passed focused in 2.8s.
- Critical services, guards, and functions modules have no unit coverage.

The user chose to pin the current Storage policy and document its risk, not change it in this brief. The user chose to characterize non-image public upload acceptance explicitly, not change it.

## Glossary

- Critical path: a flow whose failure loses data, grants or denies access, publishes or deletes content, or blocks a core page.
- False green: a test that passes when the behavior it names is broken.
- Red proof: deliberately breaking the protected behavior, observing the test fail, restoring, and observing it pass.
- Rules pass: an emulator run whose Storage or RTDB ruleset is the deployed one, not the local open rules.
- Seed: `scripts/e2e/seed.mjs`, the deterministic emulator dataset.
- State restore: returning every mutated seed record to its seeded value in a `finally` or `afterEach`.
- Browserless test: a Playwright test that uses the `request` fixture only and never needs a browser engine.

## Current State

- Gate: `scripts/e2e/gate.sh:11-30` builds, runs Angular unit tests, builds and tests functions, then one `emulators:exec` that reseeds before each browser project.
- Playwright: `playwright.config.ts:4-27` has `workers: 1`, `retries: 0`, 60s timeout, three browser projects.
- Counts: 217 e2e per browser, 501 Angular unit, 244 functions unit (`.gate-results/*.json`, `.gate-results/unit-tests.txt`, `.gate-results/functions-tests.txt`).
- Fresh baseline run: chromium 217 passed, webkit 216 passed and 1 failed (`media.spec.ts:525`), firefox did not run because the chain stopped.
- Fixture: `e2e/helpers/fixture.ts:9-14` creates the collector but registers no `afterEach`.
- Console: `e2e/helpers/console.ts:24-30` allowlists `/net::/` and `/ERR_ABORTED/`.
- Storage: `firebase.json:26-30` points the emulator at open `storage.rules:9`; `scripts/deploy.sh:14-34` ships `storage.rules.prod` through a temporary config.
- Security: `e2e/specs/security.spec.ts` has 22 tests with no `page` fixture.
- Unit boilerplate: 12 component specs have exactly one assertion, `expect(component).toBeTruthy()`.
- Coverage tooling: no `@vitest/coverage-v8`; `istanbul-lib-coverage` and `istanbul-lib-instrument` exist as transitive packages only.

## Goals

1. Every critical path has a test that fails when its behavior breaks.
2. The console guard actually fails tests on app errors, with a narrow allowlist.
3. The deployed Storage ruleset is executed at least once per gate.
4. Browserless rules tests run once, not three times.
5. Weak tests are rewritten to assert behavior or deleted with a named replacement.
6. The gate stays green on chromium, webkit, and firefox with zero skips, retries, and flaky results.
7. A policy and checklist make the next behavior change carry its tests.

## Non-Goals

- No numeric coverage threshold.
- No CI workflow.
- No change to `storage.rules.prod` posture in this brief.
- No change to public upload content-type acceptance in this brief.
- No production, development, console, real S3, or CloudFront access.
- No push and no deploy.

## Prerequisites

- `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` for every emulator run.
- The e2e bundle already builds with `npx ng build --configuration=e2e`.
- No new runtime dependency. If a coverage provider is missing, record the signal as unavailable; do not install one.

## Design Principles

- Risk first. Rank by user-visible blast radius, not by file count.
- Assert stored state and visible state, not the request that was sent.
- One behavior, one owner. Rules and callable logic are tested once at the lowest layer that can prove them.
- A test that cannot fail is deleted or rewritten.
- Deterministic waits only. Wait on a UI or network condition that proves readiness.
- Every mutation restores seed state, even on failure.

## Risk-Ranked Gap Inventory

| Rank | Gap | Unproven behavior | Primary path |
|---|---|---|---|
| 1 | Storage prod rules untested | Deployed member and stranger boundaries on photos, screenshots, uploads | `storage.rules.prod:13-29` |
| 2 | Console guard dead | App errors cannot fail 11 specs | `e2e/helpers/fixture.ts:9` |
| 3 | Request failure allowlist | A dropped backend request passes | `e2e/helpers/console.ts:28` |
| 4 | Role mutation UI path | Dialog to callable payload and audit on grant and revoke | `src/app/components/user-edit/user-edit.component.ts:80` |
| 5 | Media upload authorization | Admin gate, metadata validation, alert fan-out | `functions/src/media/auth.ts:10`, `functions/src/media/metadata.ts:17`, `functions/src/update-alert-recipients.ts:9` |
| 6 | Album cascade delete | Photo records and Storage objects removed with an album | `src/app/services/photo-albums.service.ts:60` |
| 7 | Upload path safety | Traversal, size, approve move, reject cleanup | `src/app/services/user-upload.service.ts:29` |
| 8 | Data shape services | RTDB list and snapshot shape, name formatting, message payloads | `src/app/services/rtdb.service.ts:58`, `name-utils.service.ts:13`, `message.service.ts:82` |
| 9 | People import and lineage | Dedupe, preserve, cycle guard, descendants | `src/app/services/people.service.ts:55-140` |
| 10 | Feature-flag guard | Default OFF, enabled allow, fallback redirect | `src/app/services/photo-albums-feature.guard.ts:22` |
| 11 | Chat author self-edit | Rules gated on `authorId` have no UI test | `database.rules.json:32` |
| 12 | Optimistic expression writes | Create and edit pass without persistence | `e2e/specs/expressions.spec.ts:23` |
| 13 | Seed restore and order | Chat edit and cross-user order dependence | `e2e/specs/chat.spec.ts:111` |
| 14 | Load-sensitive media replace | Timeout under WebKit gate load | `e2e/specs/media.spec.ts:554` |
| 15 | Weak unit specs | 12 component specs prove wiring only | `src/app/components/chat/chat.component.spec.ts:27` |

## Test Matrix By Layer

| Layer | Owns | Does not own |
|---|---|---|
| Angular unit (`src/**/*.spec.ts`, vitest via `ng test`) | Pure transforms, guards, payload builders, path safety, RTDB shape, component template behavior with mocked services | Real RTDB, real callables, real Storage |
| Functions unit (`functions/src/*.spec.ts`, vitest) | Callable authorization, validation, stored state, audit rows, caps, alert fan-out | Browser UI, real AWS or email |
| E2E rules (`e2e/specs/rules.spec.ts`, once per gate) | RTDB rules enforcement through REST, callable denial that cannot be proven in unit mocks | Visual layout |
| E2E storage (`e2e/specs/storage-rules.spec.ts`, once per gate, prod rules config) | Deployed Storage rule boundaries | App UI |
| E2E browser (chromium, webkit, firefox) | User-visible flows, guards, routing, rendering, persistence through the real UI | Logic that a unit test can prove |
| Contract seam | Seed shape used by both functions and e2e | Production data |

## Work By Wave

### Wave 1: Unit And Functions

#### 1. Shared e2e fixture and console guard

File: `e2e/helpers/fixture.ts`.

- Register `test.afterEach(async ({ collector }) => { collector.assertClean(); })` at module scope so every imported spec asserts.
- Keep the `collector` fixture as is.
- Update the doc comment to describe the real behavior.

File: `e2e/helpers/console.ts`.

- Remove `/net::/` from `ALLOWLIST`.
- Keep `/\[Emulator\]/`, `/ERR_ABORTED/`, `/drive\.google\.com/`, and the auth emulator host entry.
- Add no new entry until a run shows a legitimate expected failure; add it with a one-line reason.

File: `e2e/helpers/flags.ts`.

- Before reading `aria-checked`, wait for the flags skeleton to disappear: `await expect(page.getByTestId('features-loading')).toHaveCount(0);`.
- Then wait for the toggle to be visible and enabled before the snapshot.

#### 2. New functions specs

`functions/src/media/auth.spec.ts`:

- Missing auth returns `unauthenticated`.
- A user with no roles returns `permission-denied`.
- `admin: true` returns the uid.
- `super: true` returns the uid.
- Reads `users/<uid>/roles` once per call.

`functions/src/media/metadata.spec.ts`:

- Title is trimmed and accepted from 1 to 200 characters.
- Empty or 201-character title is `invalid-argument`.
- Date is trimmed and accepted from 4 to 40 characters.
- Duration accepts `3:45` and `1:02:03`, rejects `3:4`, `abc`, and `3:45:6`.
- Booleans accept only literal `true`.
- `normalizeTrackTitles` rejects a non-array, a wrong length, an empty title, and a title over 200 characters; trims accepted titles.

`functions/src/media/config.spec.ts`:

- `isMediaEmulator` is true only when `FUNCTIONS_EMULATOR === 'true'`.
- `mediaBaseUrl` returns the production base outside the emulator and an emulator URL containing `GCLOUD_PROJECT` inside it.
- `emulatorMediaUrl` falls back to `lecoursville-dev` when `GCLOUD_PROJECT` is unset.

Exempt: `functions/src/media/batch.ts` is type-only with no runtime behavior. Do not create a spec that asserts TypeScript types at runtime; record this reason in the spec and the commit message.

`functions/src/update-alert-recipients.spec.ts`:

- Missing auth returns `unauthenticated`.
- A plain user returns `permission-denied`.
- A super without admin returns `permission-denied` (the helper checks `roles/admin`).
- `emails` must be an array, at most 25, each valid after trim and lowercase.
- An empty list writes `null` to `config/adminAlertRecipients`; a whitespace-only entry is `invalid-argument` after trim.
- A valid list writes trimmed lowercase emails.
- Every success writes one `recoveryAudit` row with action `update_recipients`, the actor uid, and the token email.
- Returns `{ ok: true }`.

Use `functions/src/test-support.ts` fake DB and the invocation pattern at `functions/src/change-user-role.spec.ts:11-19`.

#### 3. New Angular unit specs

`src/app/services/user-upload.service.spec.ts`:

- `safeSegment` strips `..`, `/`, `\`, control characters, and caps at 120 characters.
- `validatedUploadPath` rejects a path outside `uploads/`.
- `destinationFileName` rejects an unsafe file name.
- `uploadFile` rejects a file over 50MB before creating a record.
- `approveUploadToAlbum` moves the object, creates a photo with `albumId`, marks the upload approved, and updates the album.
- `rejectUpload` deletes the stored object before the record.
- `deleteUpload` removes both.

`src/app/services/people.service.spec.ts`:

- `importPeople` dedupes repeated ids, preserves existing fields not present in the import, and sends one root update.
- `getAncestors` stops on a cycle.
- `getDescendants` includes children and grandchildren and excludes ids ending in `-S`.
- No test for `wipeAllPeopleAndCalendarEvents`; delete the method (see deletions).

`src/app/services/message.service.spec.ts`:

- Payload builders force `isEditable: false` and numeric timestamps.
- Expression payload adds attribution and year.
- `normalizeMessage` clones likes and recursively normalizes replies.
- `toArray` accepts a map or an array.
- `deleteMessage` removes only `messages/<id>`.

`src/app/services/rtdb.service.spec.ts`:

- List ref maps null to `[]` and an object to its values.
- `snapshotChanges` keeps keys.
- `createPushId` delegates once.

`src/app/services/name-utils.service.spec.ts`:

- One person returns one name.
- A shared last name returns `A & B Last`.
- Different last names return both names.
- `getCoupleNames` returns null when a person has no name.

`src/app/services/photo-albums-feature.guard.spec.ts`:

- A missing or disabled `enablePhotoAlbums` flag redirects to `route.data.fallbackUrl` or `/photos` (default OFF).
- An enabled flag allows activation.
- Waits for `flagsReady()` before deciding.
- This guard has no timeout; do not assert fail-open behavior here.

`src/app/services/media.service.spec.ts`:

- `deleteMedia` removes listing children before the media record.
- `filterByTypes` drops hidden types.
- `filterByQuery` lowercases values.
- Paging stops at the first item that should not load.

`src/app/services/addresses.service.spec.ts`, `family.service.spec.ts`, `clan.service.spec.ts`, `admin-badge.service.spec.ts`:

- Addresses maps ids, no-ops without an id, saves, updates, deletes.
- Family and clan save, update, delete by id, and create push ids.
- Admin badge counts pending uploads and open recovery requests.

`src/app/services/cloud-functions.service.spec.ts`:

- `appActionUrl` is `origin + '/auth/action'`.
- Callable wrappers return `.data`.
- `createUserUpload` returns the server id and path.

#### 4. Rewrite boilerplate component specs

Rewrite each file to assert the template behavior named here. Keep the TestBed setup; remove the single `toBeTruthy` test.

| File | Assert |
|---|---|
| `src/app/components/chat/chat.component.spec.ts` | New Message calls `onCreate`; empty state renders; load error renders retry |
| `src/app/components/expressions/expressions.component.spec.ts` | Search filters; admin sees Create; sort icon flips; Show All resets |
| `src/app/components/photo-album/photo-album.component.spec.ts` | Empty album hides; deprecation link points to `/photos`; grid renders photos |
| `src/app/components/photos-legacy/photos-legacy.component.spec.ts` | Search, clear, sort menu, upload control, load more |
| `src/app/components/media-list/media-list.component.spec.ts` | Count pluralization; admin filter; skeleton; selection emits |
| `src/app/components/media-search-input/media-search-input.component.spec.ts` | Typing emits; clear appears only with a value |
| `src/app/components/media-types-checkboxes/media-types-checkboxes.component.spec.ts` | Each type toggles and emits selected ids |
| `src/app/components/file-input/file-input.component.spec.ts` | Multiple input; label; clear emits |
| `src/app/components/video-player-videogular/video-player-videogular.component.spec.ts` | Renders video with `urls.download`; shows no-video message otherwise |
| `src/app/components/audio-player/audio-player.component.spec.ts` | Title and artist render; selecting a track sets current track |
| `src/app/components/media-audio/media-audio.component.spec.ts` | Renders explorer with audio type and Music title |
| `src/app/components/media-video/media-video.component.spec.ts` | Renders explorer with video type and Videos title |

#### 5. Red proofs

For every new high-risk test, run the focused spec, break the protected line, observe a failure naming the behavior, restore, and rerun green. Record the command and result in the commit body. Required proofs:

- `requireMediaAdmin` denies a non-admin.
- `normalizeMetadata` rejects an invalid duration.
- `updateAlertRecipients` rejects a 26th recipient.
- `safeSegment` strips traversal.
- `approveUploadToAlbum` links the album.
- `getAncestors` terminates a cycle.
- `deleteMedia` removes listing children first.

Done check: `npm --prefix functions run build`, `npm --prefix functions test`, and `CI=true npm test -- --watch=false` are green.

### Wave 2: E2E And Critical Flows

#### 1. Split browserless rules tests

New file: `e2e/specs/rules.spec.ts`.

Move the rules-only tests from `security.spec.ts`:

- `:209` server-only nodes reject unauthenticated reads.
- `:216` user cannot rewrite own roles record.
- `:232` user can update own profile fields.
- `:376` staff cannot mutate features or promotedRoute.
- `:399` super-only nodes reject staff reads and allow super reads.
- `:422` roleAudit is super-read only and rejects client writes.
- `:566` featureFlagAudit is super-create and super-read only.
- `:973` messages deny forged authors, nested rewrites, and cross-author changes.
- `:1173` message identity is pinned to the writer profile name.
- `:1242` users is own-record or super, not the roster.
- Merge `:553` and `:1262` into one signed-out media versus clan test.

Delete these callable duplicates whose behavior is owned by a functions spec:

- `:282` owned by `functions/src/request-password-reset.spec.ts:77`.
- `:300` owned by `functions/src/admin-generate-reset-link.spec.ts:77`.
- `:327` owned by `functions/src/submit-recovery-request.spec.ts:85`.
- `:458`, `:473`, `:530` owned by `functions/src/change-user-role.spec.ts:57,104,177`.
- `:611` and `:689` owned by `functions/src/create-user-upload.spec.ts`.
- `:756` owned by `functions/src/create-user-upload.spec.ts` plus `admin-alert-created.spec.ts`.
- `:1283` owned by `functions/src/admin-generate-reset-link.spec.ts:155` and `e2e/specs/account-recovery.spec.ts:392`.

New helper: `e2e/helpers/rules.ts` holds `signIn`, `put`, `patch`, `del`, role fixtures, and the DB namespace. Both `rules.spec.ts` and the remaining browser tests import it instead of copying helpers.

Config: `playwright.config.ts` gains:

- `rules` project, `testMatch: /(^|\/)rules\.spec\.ts$/`, chromium, `testIgnore`-free.
- `storage-prod` project, `testMatch: /storage-rules\.spec\.ts$/`, chromium.
- Browser projects add `testIgnore: [/rules\.spec\.ts$/, /storage-rules\.spec\.ts$/]`.

`gate.sh` runs `rules` once after seed and runs `storage-prod` in a separate prod-rules emulator pass.

#### 2. Deployed Storage rules pass

New file: `scripts/e2e/prod-rules-config.mjs`.

- Writes a temporary Firebase config to the OS temp directory with absolute paths to `storage.rules.prod`, `database.rules.json`, `functions`, and `dist/lecoursville/browser`, and the emulator ports from `firebase.json`.
- Prints the config path.
- Never references a real project or credential.

New file: `e2e/specs/storage-rules.spec.ts`.

Pin the current deployed policy explicitly, with a header comment naming the accepted risk and the ledger id:

- Anonymous get on a seeded `photos/...` object succeeds.
- Anonymous write on `photos/...` is denied.
- A signed-in member can create and delete `photos/...` (current policy, accepted risk).
- Anonymous create on `userUploads/...` up to the size condition succeeds (current policy, accepted risk).
- A signed-in member can delete `userUploads/...`.
- Anonymous list on `photos/...` is denied.
- Any path outside the three matched roots is denied.

Use Storage REST at `http://127.0.0.1:9199/v0/b/lecoursville-dev.appspot.com/o` with auth tokens from the Auth emulator. Do not change `storage.rules.prod`.

`gate.sh` adds, before the browser runs:

```
PROD_CONFIG=$(node scripts/e2e/prod-rules-config.mjs)
firebase emulators:exec --project lecoursville-dev --config "$PROD_CONFIG" \
  --only auth,database,storage,hosting,functions \
  "node scripts/e2e/seed.mjs && npx playwright test --project=storage-prod"
```

#### 3. Role grant and revoke through the UI

Add to `e2e/specs/admin-system.spec.ts`:

- Login as super, open `/admin/users`, click Edit on `user@e2e.local`.
- Check `mat-checkbox[name="user-roles-admin"]`, click Save, confirm with the `Save` dialog button.
- Assert the stored `users/<uid>/roles/admin` is true and a `roleAudit` row records actor, target, before, and after.
- Reopen the editor, uncheck admin, Save, confirm.
- Assert the stored role is false and a second audit row exists.
- In `finally`, restore the target roles and delete the audit rows created by the test.

The confirmation dialog label is `Save`; the editor controls are at `src/app/components/user-edit/user-edit.component.html:100-115`.

#### 4. Album cascade delete with photos

Seed additions in `scripts/e2e/seed.mjs`:

- Album `album-3`, title `E2E Delete Album`, no cover reference from other fixtures.
- Photo `photo-3-1`, `albumId: 'album-3'`, path `photos/album-3/photo1.png`.
- Upload the PNG object to Storage.

Test in `e2e/specs/admin-content.spec.ts`:

- Login as admin, open `/admin/photo-albums`, delete `E2E Delete Album`, confirm.
- Assert the album record is null, the photo record is null, and the Storage object is absent.
- Assert the seeded albums and photos are unchanged.
- Reseed is the restore mechanism per browser project; do not delete seeded albums that other tests use.

#### 5. Chat state restore and author self-edit

Seed addition:

- Message `msg-4`, author `user@e2e.local`, `isEditable: true`, body `E2E author editable`, title `Author Editable`.

Rewrite `e2e/specs/chat.spec.ts`:

- `afterEach` restores the seeded body of `msg-2`, removes messages created by the test, resets likes, and restores chat OFF in a `try/finally` that cannot throw before the flag write.
- The cross-user visibility test creates its own message as the user and then signs in as other, or asserts the seeded `msg-3`; it must not depend on an earlier test.
- New test: the author signs in as user, edits `msg-4` through the UI, reloads, and asserts the new body persists.
- New test: another user cannot see an Edit control on `msg-4`.

#### 6. Persistence over optimism

`e2e/specs/expressions.spec.ts`:

- Create test: reload after Save, assert the new expression is present, delete it in `finally`.
- Edit test: capture the seeded text, edit, reload, assert the new text, restore the seeded text in `finally`.
- Empty-state test unchanged.

Any other create or edit flow that asserts only in-place text gains a reload before the assertion. Search with `rg -n "Save|Create|Delete" e2e/specs`.

`e2e/specs/calendar.spec.ts:29`:

- Capture the current month label, click next, assert the exact expected next month, then click previous and assert the original label. Do not assert only that text changed.
- Restore the original month before the test ends.

`e2e/specs/edge-cases.spec.ts:11`:

- Remove the swallowed second click. Assert that the submit control is disabled or shows its saving state between clicks, then assert exactly one auth request was sent.
- If the control is not observable as disabled, drive the second click through the UI and assert one request; do not catch and ignore.

#### 7. Deterministic waits

Replace only when the replacement is at least as strong:

- `e2e/specs/security.spec.ts:117`, `:131`: wait for the payload text to be visible, assert no rendered element carries an `onerror` attribute containing `__xss`, and assert `window.__xss` is 0. Angular sanitizes the handler but may keep an `img` element, so element absence is not the contract. Remove the sleep.
- `e2e/specs/security.spec.ts:172`: after each `goto`, wait for the route content selector from `loading.spec.ts:8-23` and then `page.waitForLoadState('networkidle')`. Remove the 600ms sleep.
- `e2e/specs/public-upload.spec.ts:55`: assert the Upload Files heading is visible, wait for `networkidle`, then assert the upload button count is 0 and no `:9199` request exists. Remove the 500ms sleep.
- `e2e/specs/edge-cases.spec.ts:92`: wait for the imported `Probe` text, assert no rendered element carries an `onerror` attribute containing `__xss`, and assert `window.__xss` is 0. Remove the sleep.

#### 8. Trim e2e fat

- `e2e/specs/admin.spec.ts`: delete line ranges `9-20`, `230-236`, `261-271`, `273-286`, `295-300`, `333-340`, `342-360`, `362-367`. Keep the unique badge, drawer, skip link, redirect, scroll, nav, and media-header tests. Replacements: `admin-system.spec.ts:8,263`, `admin-people.spec.ts:23,61`, `admin-content.spec.ts:88`, `feature-flags.spec.ts:32`, `auth.spec.ts:101`, `security.spec.ts:260`.
- `e2e/specs/feature-flags.spec.ts`: merge tests one and two into one disabled-page test; move the mutation restore into `afterEach` with `try/finally`.
- `e2e/specs/loading.spec.ts`: one reload per route in both reload-stress tests, not three.
- `e2e/specs/account-recovery.spec.ts`: delete `:223` and `:602` (owners named above); keep the UI flow tests. Add a top-level `afterEach` `collector.assertClean()`.
- `e2e/specs/media.spec.ts`: in the delete test, keep the UI click, confirmation, and toast; remove the `sinkHead` object assertions owned by `functions/src/delete-media.spec.ts`. Keep record-null polling only if it proves the UI refreshed.
- `e2e/specs/security.spec.ts:183` no-enumeration duplicates `account-recovery.spec.ts:150`; keep the account-recovery UI version.
- `e2e/specs/admin-system.spec.ts:373` recovery-close duplicates `account-recovery.spec.ts:433`; keep the account-recovery version.

#### 9. Media replace flake

Diagnose `e2e/specs/media.spec.ts:525` before changing it. The failure was a 15s wait for `video-upload-success` after replace. Fix only with evidence:

- If the replace callable is slow under load, raise nothing; wait on the stored record change first with `expect.poll`, then assert the toast.
- Ensure the test does not reuse the shared `fixture` row while another test mutates it; use the created record's own title and row.
- Keep `retries: 0`.

#### 10. Characterize non-image public upload

Move the probe from `e2e/specs/security.spec.ts:136` into `e2e/specs/public-upload.spec.ts` as an explicit characterization test titled `characterization: a text file is accepted today (accepted risk)`.

- Upload `notes.txt` with `text/plain` through `/upload`.
- Assert `Thanks For Sharing!` is visible.
- Read the created `userUploads` record through `e2e/helpers/admin-db.ts` and assert it is pending with `fileName: 'notes.txt'` and a server-owned path.
- Assert the Storage object exists at that path through the Storage emulator REST endpoint.
- Delete the created record and object in `finally`.
- Add a comment naming the accepted risk and ledger id C-20261023-13.

#### 11. Seed auth password restore

In `scripts/e2e/seed.mjs`, when an auth user already exists, reset its password to `E2e-pass-2026` instead of leaving it unchanged. Any recovery test that changes a password restores it in a `finally` that cannot throw before the restore, so a failed assertion cannot leak mutated credentials into the next browser project.

Done check: Chromium media and affected domain specs pass first, then the full gate is green on three browsers.

### Wave 3: Mechanism And Trim

#### 1. Policy

New file: `docs/testing/TEST_POLICY.md` with these sections:

- Coverage bar: risk-based critical paths, trust boundaries, data integrity. No numeric threshold.
- Layer routing table from this spec.
- Red proof: required for every high-risk test; include the command and observed failure.
- No skip, no fixme, no only, no retries. Flakes are fixed, not retried.
- Deterministic waits: wait on content, state, or network quiescence; no arbitrary sleeps.
- State restoration: every mutation restores seed state in `finally` or `afterEach`.
- Seed changes: add fixtures to `scripts/e2e/seed.mjs`; never hand-edit the emulator.
- Console collector: imported from `e2e/helpers/fixture.ts`; asserted for every test by the fixture; allowlist entries need a reason.
- Deletion rule: delete only with evidence of redundancy or non-behavior, plus a named replacement or a stated reason no replacement is needed.
- Gate: `npm run e2e:gate` blocks deploy; emulator only; `JAVA_HOME` required.
- Review checklist mapping new behavior, changed behavior, bug fix, rules change, data migration, and UI-only change to required tests and evidence.

#### 2. AGENTS pointer

Add to `AGENTS.md`, under the e2e coverage rule:

- Read `docs/testing/TEST_POLICY.md` before changing behavior.
- Every user-visible change adds or updates its e2e spec and records the red proof or behavior assertion in the commit.

Do not remove or weaken the existing mandatory e2e, emulator-only, deploy sign-off, or `JAVA_HOME` rules.

#### 3. Coverage signal

Attempt `CI=true npm test -- --watch=false --coverage`. If it fails because a provider package is missing, do not add a dependency; record the signal as unavailable in the policy and use the risk matrix as the signal. If it works, record the before and after per-directory percentages without a gate.

#### 4. Obsolete code and tests

- Delete `wipeAllPeopleAndCalendarEvents` from `src/app/services/people.service.ts:32`; no caller exists. No replacement test is needed because the method is unreachable.
- Complete the e2e deletions named in Wave 2 and record the replacement for each.
- Do not delete `storage.rules.prod` or the open emulator rules.

#### 5. Before and after report

Produce a table with: spec and unit file count, assertion count, per-browser test count, per-browser runtime, slowest five tests, deleted tests with replacements, and gaps closed. Put it in the handoff.

## Deletions With Evidence

| Deletion | Evidence | Replacement |
|---|---|---|
| `security.spec.ts` 11 callable duplicates | Functions specs named above assert the same behavior with stored state | Named functions spec per test |
| `security.spec.ts:183` | `account-recovery.spec.ts:150` asserts the same banner through the UI | account-recovery UI test |
| `admin-system.spec.ts:373` | `account-recovery.spec.ts:433` asserts the same close flow through the UI | account-recovery UI test |
| `account-recovery.spec.ts:223,602` | `submit-recovery-request.spec.ts` owns default flow and global cap | functions spec |
| `admin.spec.ts` ranges above | Successor tests named above | Named successor |
| `feature-flags.spec.ts:14-19` | First test covers the same disabled page | Merged test |
| `media.spec.ts` object-state asserts | `delete-media.spec.ts` owns object removal | functions spec; UI toast stays |
| 12 boilerplate unit tests | Rewritten, not deleted | Behavior assertions in the same file |
| `wipeAllPeopleAndCalendarEvents` | No caller in `src` or tests | Unreachable; no test |
| `media/batch.ts` spec | Type-only module with no runtime behavior | Written exemption |

## Runtime Measurements

Before (recorded artifacts):

- Chromium 217 tests, 171.6s.
- WebKit 217 tests, 232.2s.
- Firefox 217 tests, 231.8s.
- Slowest: loading reload stress 7.9s to 9.9s, nav cached session 5.7s to 6.1s, outbound walk 5.4s to 6.0s.

Target:

- Browserless rules tests run once instead of three times.
- Reload stress reloads once instead of three times.
- Duplicate admin and recovery tests removed.
- New prod-rules pass costs one extra emulator boot.
- No hard cap; measure after each wave and do not trade confidence for a number.

## Future Coverage Mechanism

- `docs/testing/TEST_POLICY.md` is the single policy.
- `AGENTS.md` points to it and keeps the mandatory e2e rule.
- The review checklist lives in the policy and is required in every behavior-change commit or PR body.
- The deploy-blocking gate stays `npm run e2e:gate`.
- No CI workflow and no coverage threshold.

## Verification Steps

Run from the repository root:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
npm --prefix functions run build
npm --prefix functions test
CI=true npm test -- --watch=false
npm run e2e:gate
```

Acceptance:

- All four commands exit 0.
- Gate shows 0 skipped, 0 unexpected, 0 flaky on chromium, webkit, and firefox.
- No `test.skip`, `test.fixme`, `.only`, or retries.
- Every high-risk new test has a recorded red proof.
- Every deletion has a replacement or a written reason.
- `docs/testing/TEST_POLICY.md` and the `AGENTS.md` pointer are committed.

## Open Questions

None. The two human-only decisions are settled:

- Storage prod policy: pin current behavior and document risk. Source: user answer, 2026-10-23.
- Non-image upload: characterize acceptance explicitly. Source: user answer, 2026-10-23.
