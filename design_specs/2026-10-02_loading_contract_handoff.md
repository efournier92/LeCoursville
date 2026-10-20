# Loading Contract Handoff: remaining work

Repo: /Users/e/mnt/bnk/cs/lecoursville. Date: 2026-10-02.

## Current state

Landed (committed, on master and in current HEAD):

- `03516d52` Enforce the loading contract across user-facing pages: contract doc, `LvLoadErrorComponent`, status machines across calendar, chat, contacts, expressions, media, people, photo, message; `message.service.ts` error channel plus retry; `feature-flag-guard.service.ts` 10s fail-open; `navbar-links` flags-pending state; `loading.spec.ts` (content, reload stress, empty state, nav); sparse seed user plus `login(page, 'sparse')`.
- `53b081d1` Make the photos albums page honest about loading.
- `50983484` Cut perceived cold-load latency in nav and sign-in.

Not done:

- Batch E, the service-side `loaded$` first-emit flag. `grep "loaded$" src/app/services/` returns nothing. Consequence: a cold route into a genuinely empty dataset can still sit on skeleton forever, because each service seeds its BehaviorSubject with `[]` and a replayed seed is indistinguishable from a server-confirmed empty list. `e2e/specs/loading.spec.ts` test 3 currently dodges this by warming the stream before nulling the nodes (comments around lines 59-68); the test passes but the underlying bug remains.
- The full gate has no run recorded after these commits. Green `ng build` and `playwright --list` are not runtime proof.

Working tree, do not disturb:

- Current branch `feat/account-recovery` carries unrelated in-progress account-recovery work: `src/app/components/auth-action/`, `recovery-request/`, `admin-recovery/`, `functions/`, `database.rules.json`, plus changes to auth/user-view/firebase.json/scripts. Not part of this task. Never revert, stash, or commit it on this task's behalf.

## Key decisions and why

- Four-state contract (loading, error, empty, ready) is the source of truth: `design_specs/loading-contract.md`. Error callbacks are mandatory on every data subscribe; no `setTimeout` dismissal; no inferring loading from array length.
- Shared UI is only `LvLoadErrorComponent`; per-page skeletons stay inline and keep their existing markup and `data-testid`s.
- Top-nav is three-way through `authResolved$` (flips on the first `onAuthStateChanged` callback): resolving shows skeleton pills, signed-out shows Sign In, signed-in shows links. Known corner: a signed-in user can briefly see Sign In while the RTDB user record loads.
- Feature-flag guard fails open after 10s with one `console.warn`; a hung route is worse than an unflagged one.
- Batch E belongs in the services, not the components: a `loaded$` flag set true on the first Firebase callback, any payload, resolves both directions (seed replay reads as loading, server-confirmed empty reads as empty).

## Next actions

1. Batch E. In the services that own `contacts$`/`people$`/`clans$`/`albums$`/`mediaObservable` (under `src/app/services/`): add `loadedSource = new BehaviorSubject<boolean>(false)`, set `true` exactly once on the first underlying Firebase callback, expose `loaded$`. In contacts, people, photo-albums, media-list/media-explorer: require the matching `loaded$` before the ready/empty transition; skeleton stays until it or an error.
2. Update `e2e/specs/loading.spec.ts` test 3: delete the warm-up workaround, assert a cold sparse-user navigation straight to the nulled nodes shows the empty-state. Keep the node null/restore in `finally`.
3. Run the gate: `export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` then `npm run e2e:gate` (emulator-only per AGENTS.md; chromium, webkit, firefox with reseeds).
4. If red, inspect first: the `nav-links-skeleton` transient assertion and the empty-state node null/restore logic in `loading.spec.ts`.
5. No commits unless the user asks; the account-recovery WIP shares the tree.

## Verify commands

- `grep "loaded\$" src/app/services/` (expect hits once Batch E lands; zero now).
- `npx ng build --configuration=e2e` (expect exit 0).
- `npx playwright test --list` (baseline was 210 tests in 15 files before account-recovery.spec.ts was added).
- `npm run e2e:gate` (the only runtime proof).

## Open risks and blockers

- Subagent dispatch hit a 5-hour usage limit at session end (resets 2026-10-02 03:52), which is why Batch E was never implemented. A fresh session can dispatch it immediately.
- The account-recovery work touches `auth.service.ts`; the contract's `authResolved$` must survive that refactor.
- Pre-existing leak noted during the audit: `media-explorer` re-subscribes `userObservable`/`queryParams` on every media emit. Left as-is, out of scope.
