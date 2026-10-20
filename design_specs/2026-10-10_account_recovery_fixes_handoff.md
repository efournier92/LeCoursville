# Account Recovery Fixes Handoff (2026-10-10)

## Current State

Repo `/Users/e/mnt/bnk/cs/lecoursville`, branch `feat/account-recovery`, everything uncommitted (nothing staged, nothing pushed). The branch is a major build: account recovery (Resend password reset, recovery requests, admin alerts, audit), a rewritten auth UI, database rules, deploy-script changes, and e2e specs.

A red-team (grill) ran on 2026-10-10 before the prod deploy. Verdict: NOT-CONVERGED. Full findings, rebuttals, and the recorded decisions live in `design_specs/critique/2026-10-10_account_recovery_prod_deploy.md`. Read that ledger first; it is the source of truth for the fix list. This handoff summarizes and orders the work.

Already done this session (infra, not code):
- Rules deployed to `lecoursville-dev` and `lecoursville` (`firebase deploy --only database --project <id>`). Prod `users`/`people`/`addresses` now return HTTP 401 anonymously; the privilege-escalation and public-read exposure are closed.
- Functions built and deployed to `lecoursville-dev` only: `requestPasswordReset`, `submitRecoveryRequest`, `adminGenerateResetLink`, `closeRecoveryRequest`, `updateAlertRecipients`, `onAdminAlertCreated`.
- `RESEND_API_KEY` set for both projects; Resend domain `auth.lecoursville.com` verified.
- `functions/package-lock.json` was stale; resynced with `npm install`. Do not revert it.
- `functions/src/config.ts:16` `REPLY_TO` changed to `eric@lecoursville.com`.

In progress: none. The next session starts the fix pass below.

## Progress (2026-10-10 fix pass)

Verified this session: `npm --prefix functions run build` (0), `npm --prefix functions ci --dry-run` (0), **`npm --prefix functions test` 90/90 green** (was 59), and **`npm run e2e:gate` 99/99 green on chromium, webkit, and firefox** (exit 0). The gate is green on the current tree, so C-09 is resolved by execution. Branch/status match the handoff; `firebase functions:list` still shows the six deployed functions (the new `onAccountCreated` is source-only, not deployed).

Done:
- Action 1 (all 10 confirmed defects): `sendEmail` checks the Resend in-band error; `onAdminAlertCreated` retries + rethrows; stale-`pending` lock TTL reopen (shared `RECOVERY_LOCK_TTL_MS`) and close accepts stale pending; audit-after-mint made non-fatal with a resolve-race record; `request-password-reset` awaits the send and audits the outcome; close audit rolls back on failure; submit uses a deterministic id + one atomic multi-path write; rate-limit layers pre-check and only commit when all allow (`checkRateLimit`); `users/$uid` self-write now constrains `roles/user` (create-only provisioning, role-stable updates). Each fix has a unit test; the rules fix has e2e coverage in `security.spec.ts`.
- Action 2: `onAccountCreated` emails the owner on first `users/{uid}` creation (+ unit tests); per-actor breach audit on the reset IP layer; `alertSuppressed` marker on capped recovery requests; admin-recovery now surfaces recent account creations and a merged recovery activity feed, and shows non-open requests with a status label (C-04 UI). Playwright specs added for all three surfaces.
- Action 3 (settled subset): C-44 name control-char validation, C-45 env-gated localhost continue origins, C-29 recipient cap, C-30 close rate limit, C-49 unused dep removed (+ lock resync), C-48 new `database-rules/2026-10-10/` snapshot pair.

Done — fix round 2 (post-re-critique, ledger `design_specs/critique/2026-10-10_account_recovery_prod_deploy.md`):
- Re-critique grill ran (round 2 of 3). Verifier CONFIRMED the 11 core fixes; found a broken lockfile (`ci --dry-run` missing `@react-email/render` peers), resynced. Adversaries found new defects C-52..C-62; the high/medium ones in the new code were fixed: C-52 status-aware dedupe/resubmission, C-53 commit-gated rate limits, C-54 dedupe before rate limits, C-55 deterministic alert key, C-56 per-recipient alert retry progress, C-58 account-notification validation + per-uid rate limit, C-57 dead-letter + window-after-send, C-59 compensating alert/marker on mint-audit failure.
- C-08 fixed: `AuthService.redirectError$` now surfaces swallowed Google redirect errors through the component's `mapAuthError`.
- Walkthrough decisions: fix C-08/C-57/C-59 before ship (done); set the Auth custom action URL before any prod email; enable App Check logging-only before ship; keep the hard email sign-off (live Resend + enumeration protection ON); **PULL RETENTION FORWARD** (override of the defer recommendation — needs a spec first). Defaults C-21/C-33/C-34/C-35/C-36/C-46/C-47/C-50/C-60/C-61/C-62 stand as vetoable.
- Sign-in page redesign: recovery is now a prominent full-width "Get help signing in" button (`auth-recovery-open`) set off by a hairline rule; "Forgot password?" is the quick link above it; the post-reset banner has one clear line with a spam/junk-folder wait cue.
- Sign-in redteam (visual-critic + product-critic + adversary): applied C-64 (admin-alert newline forging neutralized), C-65 (dialog jargon removed, typed email prefilled, `sendingReset` pending state), C-66 (removed the duplicate in-banner recovery button, de-duplicated spam copy, fixed spacing/icon/contrast). Evidence: functions test 98/98; `npm run e2e:gate` 101/101 x3. Renders: `/tmp/opencode/signin-{desktop,mobile}{,-reset}.png`.
- C-63 resolved by decision: keep the non-enumerating `{ok:true}` success, but when the global recovery cap turns someone away, write a `recovery_attempt_denied` record (raw email, name, alternate contact, uid when present, actor hash) to `recoveryAudit`, bounded to 2/email and 50/day, and surface it in the admin recovery activity feed so the owner can follow up with the locked-out person.
- Awareness guarantee: global cap hit raises a once-per-window admin alert + per-attempt records; the 50-entry capture bound raises a distinct once-per-window alert + `recovery_denied_log_capped` audit. **Caveat: the push email depends on `eric@lecoursville.com` receiving (runbook step 5a, not done) — until then awareness is pull-only via the durable `adminAlerts` record and the activity feed.**
- Trends: client Firebase Analytics events (`auth_forgot_clicked`, `auth_reset_sent|failed`, `recovery_opened`, `recovery_validation_error`, `recovery_submitted|failed`) plus server durable `recoveryAudit`/`adminAlerts` records at every flow juncture (see ledger "Awareness + Analytics").

Not done (remaining):
- **REMINDER — C-13 web App Check logging-only: NOT implemented.** When you do it, work on the latest `feat/account-recovery` tree and re-run `npm --prefix functions test` + `npm run e2e:gate` before calling it done. Exact steps: `design_specs/2026-10-02_account_recovery_runbook.md` step 5b (register web app + reCAPTCHA site key, init App Check gated by environment and skipped in the emulator, logging-only, then enforce).
- Retention/consent pulled forward (C-25 + C-26/C-27/C-28/C-31/C-37, C-14 TTL): needs a design spec before implementation.
- Open low/medium findings C-60 (timing oracle), C-61 (surface `alertSuppressed` in the admin UI), C-62 (handle mid-session `updateUser` rejection).
- Action 3 deferred: C-14/C-31 TTLs, C-47 scaffolding dedupe, C-50 emulator CAS branch note.
- Ops items (human-only) and the ship gate remain untouched and gated.

## Key Decisions

- Do NOT gate Google enrollment. Mitigation is a real-time account-creation notification to `eric@lecoursville.com` plus prominent admin visibility (detective, not preventive; residual risk accepted).
- Keep auto-emailing reset links to the alternate contact, but alert the owner and surface recovery submissions/mints prominently in admin tooling.
- Accept the shared-cap admin-mint backstop; add a per-actor breach audit and a skipped-alert marker.
- Set the Firebase console custom action URL to `auth.lecoursville.com` during the ops pass.
- Enable web App Check in logging-only mode now; enforce later.
- Defer recovery-request/audit retention with a ticketed 90-day purge.
- Require one live Resend send plus a console confirmation that email enumeration protection is ON as deploy sign-off.
- Posture: stage the prod rollout, functions first, verify, then hosting.

## Next Actions

Work on `feat/account-recovery`. Order matters: function correctness first, then the decided features, then cleanup, then re-verify.

1. Fix the confirmed function defects (highest value, smallest diff). Each fix adds a unit test in the matching `functions/src/*.spec.ts`.
   - `helpers.ts:228` `sendEmail` ignores the Resend v4 in-band error object; check `result.error` and treat 4xx/5xx as failure. Evidence: C-02, C-03.
   - `admin-alert-created.ts:78` catch block returns instead of rethrowing, so Eventarc never retries; make failures retryable or record a durable dead-letter state. Evidence: C-06.
   - `admin-generate-reset-link.ts:97` lock to `pending` has no reopen path; `close-recovery-request.ts:30` only accepts `open`. Add a stale-`pending` reopen or a TTL sweep. Evidence: C-04.
   - `admin-generate-reset-link.ts:160` resolve then `writeAudit` with no catch; wrap so an audit failure cannot lose the minted link. Evidence: C-05.
   - `request-password-reset.ts:136` fire-and-forget `void send` drops prod send failures silently; await and record an audit outcome like the admin path. Evidence: C-11, C-20.
   - `close-recovery-request.ts:27` commits the status flip before audit; reorder or guard. Evidence: C-18.
   - `admin-generate-reset-link.ts:160` unchecked `compareAndSet` result after mint. Evidence: C-32.
   - `submit-recovery-request.ts:93` request write then alert write is non-atomic with no idempotency key. Evidence: C-19.
   - `submit-recovery-request.ts:43` / `request-password-reset.ts:50` rate-limit layers commit increments for calls a later layer denies. Evidence: C-17.
   - `database.rules.json:36` `users/$uid` guard does not constrain `roles/user`. Evidence: C-16.
2. Build the decided detection features (new user-visible behavior, so each needs Playwright coverage under `e2e/specs/` per `AGENTS.md`):
   - Account-creation notification email to `eric@lecoursville.com` on first `users/{uid}` creation, plus a prominent admin view of recent account creations. Evidence: C-40, C-01.
   - Owner alert and prominent admin surfacing for recovery submissions and reset-link mints. Evidence: C-41.
   - Per-actor breach audit and a skipped-alert marker on the capped paths. Evidence: C-10, C-43.
   - Web App Check in logging-only mode on the pre-auth callables. Evidence: C-13.
3. Cleanup of settled items as capacity allows: `helpers.ts:270` rateLimits TTL (C-14), unbounded-node bounds (C-29, C-30, C-31), attacker-name newline validation (C-44), env-gate the localhost continue-URL origins (C-45), dedupe the rate-limit scaffolding (C-47), remove the unused `firebase-functions-test` dep (C-49), resolve `database-rules/2026-10-04/after.json` drift (C-48), and the shipped emulator CAS branch (C-50).
4. Re-run verification: `npm --prefix functions test` (extend for each fix), then `npm run e2e:gate` on the current tree (the last green was 2026-10-04; `config.ts` changed after it).
5. Re-critique: run the grill against `design_specs/critique/2026-10-10_account_recovery_prod_deploy.md`, update finding statuses, and confirm convergence before any ship. Evidence: C-09, C-51.
6. Ops items (human-only, console/DNS): set the Firebase Auth custom action URL to `auth.lecoursville.com` (C-07); do one live Resend send and confirm email enumeration protection is ON on prod (C-23, C-42); set up `eric@lecoursville.com` receiving at GoDaddy (runbook step 5a) so the new alerts and reply-to actually deliver; file the retention ticket (C-25).
7. Ship gate only on explicit user agreement. Then stage: prod functions first, verify, then hosting.

## Verify Commands

```bash
# from /Users/e/mnt/bnk/cs/lecoursville
git branch --show-current            # expect feat/account-recovery
git status --short                   # expect the WIP listed above; nothing staged
npm --prefix functions run build     # expect exit 0
npm --prefix functions test          # expect all green (59 before the fixes)
npm --prefix functions ci --dry-run  # expect exit 0 (lockfile in sync)
firebase functions:list --project lecoursville-dev   # expect the six functions
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home npm run e2e:gate
```

## Open Risks And Blockers

- `eric@lecoursville.com` cannot receive mail yet (apex has no MX). Until step 5a is done, the new alert emails and the reply-to bounce. This blocks the detective-control decisions from having any effect.
- The Google self-provision hole (C-40) is accepted, detective-only: a stranger account holds read access before the alert arrives. Revisit if the family directory is considered sensitive beyond trust.
- App Check is logging-only; bot spend is not bounded until enforcement.
- Production never executes the `ref.transaction` CAS path in tests; the emulator uses a get-then-set branch. Do not describe the emulator branch as atomic.
- Retention and erasure for recovery PII are deferred; exposure grows until the ticket lands.
- This repo has no `docs/discovery/`; it could opt in if the user wants Progressive Discovery. Do not create the directory unasked.
