# Account Recovery Review Handoff (2026-10-04)

## Current State

Main checkout `/Users/e/mnt/bnk/cs/lecoursville`, branch `feat/account-recovery`, all changes still uncommitted (nothing staged, nothing pushed). A red-team critic reviewed the WIP, its resolvable findings were routed to builders, and the full gate is now green: `94 passed` on each of Chromium, WebKit, Firefox (exit 0).

Done this pass:
- Critic (claim-critic) read the spec, runbook, all functions, `database.rules.json`, the deploy/gate changes, and the new components/specs. Findings: 0 blockers, 5 HIGH, 5 MEDIUM, 2 LOW, plus decision items.
- Functions hardening: audit written before email with a separate send outcome; `requestId` now required and mint target bound to the request record; alternate-contact email validated in both callables; lock before mint and resolve after mint; callable unit tests added (39 pass).
- Frontend and coverage: admin "Mark closed" action wired to `closeRecoveryRequest`; Google popup-blocked and mobile in-app `signInWithRedirect` fallback; `sendPasswordResetEmail` fallback narrowed to transport errors so it no longer leaks account existence; security specs for non-admin callable rejection and the rate-limit cap; doc corrections.
- Root cause found and fixed: the RTDB emulator does not implement Admin SDK transactions, so every `transaction` silently no-opped (`adminGenerateResetLink` always returned `already-handled`, `closeRecoveryRequest` never closed, `rateLimit` always allowed). Added `compareAndSet` in `functions/src/helpers.ts` that uses `ref.transaction` in production and a `get`/`set` path under the emulator; routed the lock/unlock/resolve, close, and rate-limit counter through it.
- Layered rate-limit, then hardened after review: added a per-actor layer alongside per-email and global, a weighted sliding window, throttled breach audit plus admin alert, a global cap and throttled alert on `submitRecoveryRequest`, and a uniform capped response. Two critic blockers were then fixed: the actor anchor now uses the trustworthy end (`rawRequest.ip`, else the LAST `x-forwarded-for` hop, never the client-controlled first hop), and `rateLimit` now decides inside the mutator and aborts the write on deny so denied traffic can no longer extend a window or starve the alert throttle. A re-review returned SOUND.
- Rules history scaffolded at `database-rules/`: `README.md` plus `2026-10-04/after.json` (the reviewed ruleset, sha256 `94c0fb91...86b3`). `2026-10-04/before.json` is still pending the production console export.

## Key Decisions

- Production keeps atomic `ref.transaction`; the emulator fallback is read-then-write and emulator-only.
- Did not add commits, stage, push, or touch the deploy sign-off.
- `closeRecoveryRequest` and the required `requestId` are now real, reachable code paths with e2e coverage.

## Next Actions

1. Paste the production console rules export into `database-rules/2026-10-04/before.json` (it cannot be fetched offline and the real project must not be touched), then run the diff in that folder's README.
2. Review the uncommitted diff, then commit on `feat/account-recovery` when satisfied.
2. Decide the critic's open questions, which need a human or product call:
   - Global reset cap (200/hour): during an attack wave the budget is spent and legit resets silently get `{ok:true}` with no email. Confirm the admin-mint backstop is the intended ops story.
   - Keep the `sendPasswordResetEmail` fallback permanently, or remove it once Resend is proven stable?
   - Whether `design_specs/2026-10-02_loading_contract_handoff.md` ships with this merge or moves off the branch.
   - Commit an exported RTDB-rules before/after baseline as evidence that `database.rules.json` is the complete current ruleset.
3. Run `npm run e2e:gate` and the functions tests before any deploy.

## Verify Commands

```bash
# from /Users/e/mnt/bnk/cs/lecoursville
git status --short
npm --prefix functions run build
npm --prefix functions test
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home npm run e2e:gate
```

## Follow-up Defects (from the rate-limit re-review, not rate-limit soundness)

- Crash between lock and resolve permanently bricks a recovery request: unlock runs only on the caught-error paths, and close refuses a non-`open` status. Fix: accept a stale `pending` for the same admin, or add a TTL sweep.
- A production reset-email failure is invisible: `request-password-reset.ts` drops the send rejection with no audit, unlike the admin path which records `emailStatus`.
- Per-actor breaches in `requestPasswordReset` write no audit or alert (only the global trip does), so one IP rotating victim emails stays under 20/hr with no signal. The throttle helper already bounds a fix to one per window.

## Open Risks

- Emulator-only functions changes mean the `compareAndSet` emulator branch races under concurrency; production atomicity comes from `ref.transaction`. Do not describe the emulator branch as atomic.
- The gate warns about `RESEND_API_KEY` Secret Manager access; dry-run stubs email, so it is expected but noisy.
- The account-recovery WIP remains uncommitted and interleaved with earlier uncommitted work on this branch; stage carefully.
