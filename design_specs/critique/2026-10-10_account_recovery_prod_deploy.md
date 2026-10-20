# Critique Ledger: Account Recovery Prod Deploy

- Goal: red-team the account-recovery WIP before it ships prod hosting and functions, without breaking real users or adding security risk
- Started: 2026-10-10
- Branch: feat/account-recovery

## Findings

- C-20261010-01 | 2026-10-10 | security | high | high | addressed | Any authenticated user can read the whole users node (emails, names, roles) plus people, addresses, families | database.rules.json:33
- C-20261010-02 | 2026-10-10 | data-integrity | high | high | addressed | sendEmail never inspects the Resend v4 in-band error object, so rejected sends are recorded as sent with no audit | functions/src/helpers.ts:228
- C-20261010-03 | 2026-10-10 | data-integrity | high | high | addressed | adminAlerts marked sent with recipientCount even when every Resend send was rejected | functions/src/admin-alert-created.ts:73
- C-20261010-04 | 2026-10-10 | data-integrity | high | high | addressed | Lock leaves a recovery request pending with no recovery path; crash or timeout bricks it and the admin UI hides non-open rows | functions/src/admin-generate-reset-link.ts:97
- C-20261010-05 | 2026-10-10 | data-integrity | high | high | addressed | writeAudit after resolve has no catch; an audit throw means the admin gets no link and the live credential is unaudited | functions/src/admin-generate-reset-link.ts:160
- C-20261010-06 | 2026-10-10 | reliability | high | high | addressed | Alert trigger catches everything and returns success, so Eventarc never retries and a failed alert email is lost permanently | functions/src/admin-alert-created.ts:78
- C-20261010-07 | 2026-10-10 | product | high | high | open | Reset emails open Firebase's hosted action page, not /auth/action; the console custom action URL is not set anywhere | functions/src/request-password-reset.ts:95
- C-20261010-08 | 2026-10-10 | product | high | high | open | Google redirect/popup failures are swallowed silently on mobile in-app browsers and popup-blocked, including the account-exists case | src/app/services/auth.service.ts:295
- C-20261010-09 | 2026-10-10 | correctness | high | high | addressed | Gate is stale: functions/src/config.ts was edited after the last gate run and the current tree has not been gated | design_specs/2026-10-04_account_recovery_review_handoff.md:30
- C-20261010-10 | 2026-10-10 | abuse | high | high | addressed | Global reset cap 200/h is shared and denial is silent; a rotating attacker saturates it and locks out legitimate resets | functions/src/request-password-reset.ts:59
- C-20261010-11 | 2026-10-10 | security | high | high | addressed | Prod reset-email rejection is dropped (void send.catch) with no audit or alert on the primary path | functions/src/request-password-reset.ts:136
- C-20261010-12 | 2026-10-10 | abuse | medium | high | addressed | An outsider can force ~2,500 admin-alert emails/day to the owner inbox and burn Resend quota | functions/src/submit-recovery-request.ts:107
- C-20261010-13 | 2026-10-10 | abuse | medium | high | open | Pre-auth callables run with no App Check and each call costs several RTDB transactions, so bots drive unbounded spend | functions/src/request-password-reset.ts:29
- C-20261010-14 | 2026-10-10 | abuse | medium | high | open | Per-email rate-limit keys persist before the existence and global checks; unbounded permanent rateLimits nodes, no TTL | functions/src/request-password-reset.ts:50
- C-20261010-15 | 2026-10-10 | abuse | medium | high | addressed | Targeted mail-bomb: 5 resets/hour per email to a known victim address, also consuming the shared global budget | functions/src/request-password-reset.ts:18
- C-20261010-16 | 2026-10-10 | data-integrity | medium | high | addressed | users/$uid guard does not constrain roles/user; full-object write-back on sign-in can revert a super grant | database.rules.json:36
- C-20261010-17 | 2026-10-10 | data-integrity | medium | high | addressed | Rate-limit layers commit increments for calls a later layer denies, burning a legit user's quota with no record | functions/src/submit-recovery-request.ts:43
- C-20261010-18 | 2026-10-10 | data-integrity | medium | high | addressed | close commits the status flip before writeAudit with no handling; audit failure yields closed-with-no-audit and already-handled | functions/src/close-recovery-request.ts:27
- C-20261010-19 | 2026-10-10 | data-integrity | medium | medium | addressed | submit persists the request then writes the alert non-atomically with no idempotency key; resubmit can duplicate | functions/src/submit-recovery-request.ts:93
- C-20261010-20 | 2026-10-10 | reliability | medium | medium | addressed | Fire-and-forget void send relies on post-response async work Cloud Run may reap, dropping reset emails | functions/src/request-password-reset.ts:136
- C-20261010-21 | 2026-10-10 | reliability | medium | medium | open | Hosting can release while the functions release fails, leaving the new UI calling callables absent on prod | scripts/deploy.sh:16
- C-20261010-22 | 2026-10-10 | reliability | medium | medium | open | Alert fan-out has no per-recipient record; a timeout mid-loop loses later recipients and duplicates earlier ones | functions/src/admin-alert-created.ts:62
- C-20261010-23 | 2026-10-10 | correctness | medium | high | open | Email e2e assertions read only the dry-run RTDB stub; real send, key validity, and delivery are unproven | functions/src/helpers.ts:213
- C-20261010-24 | 2026-10-10 | correctness | medium | high | addressed | Handoff's own follow-up defects remain open in code (bricked pending, per-actor breaches unlogged) | design_specs/2026-10-04_account_recovery_review_handoff.md:45
- C-20261010-25 | 2026-10-10 | compliance | medium | high | open | recoveryRequests (name, email, alt contact, free text) and recoveryAudit have no retention or erasure path | design_specs/2026-10-02_account_recovery.md:113
- C-20261010-26 | 2026-10-10 | compliance | medium | medium | open | Non-user relatives' PII (people/addresses: emails, phones, homes, birthdays) held with no notice or consent path | src/app/models/person.ts:31
- C-20261010-27 | 2026-10-10 | compliance | medium | medium | open | Member emails and recovery content are sent to Resend with no referenced data-processing terms | functions/src/helpers.ts:228
- C-20261010-28 | 2026-10-10 | compliance | medium | medium | open | Google sign-in UI and outbound emails state no Google terms or limited-use disclosure | src/app/components/auth/auth.component.html:21
- C-20261010-29 | 2026-10-10 | abuse | low | high | addressed | updateAlertRecipients accepts an unbounded email array; every alert then reads and dedups the whole node | functions/src/update-alert-recipients.ts:17
- C-20261010-30 | 2026-10-10 | abuse | low | high | addressed | closeRecoveryRequest has no rate limit; an admin retry loop writes unbounded recoveryAudit nodes | functions/src/close-recovery-request.ts:46
- C-20261010-31 | 2026-10-10 | abuse | low | high | open | recoveryRequests/adminAlerts/recoveryAudit accumulate attacker text forever with no TTL or pruning | functions/src/helpers.ts:246
- C-20261010-32 | 2026-10-10 | data-integrity | low | medium | addressed | resolve compareAndSet result unused after mint; a committed false leaves a live link with the record still open | functions/src/admin-generate-reset-link.ts:160
- C-20261010-33 | 2026-10-10 | reliability | low | high | open | deploy.sh neither checks nor sets RESEND_API_KEY, so a first prod CLI deploy can stall on the secret prompt | scripts/deploy.sh:145
- C-20261010-34 | 2026-10-10 | reliability | low | high | open | tag_build reuses the YY.MM.DD tag on a second same-day deploy; git tag fails after a successful deploy | scripts/deploy.sh:37
- C-20261010-35 | 2026-10-10 | reliability | low | medium | open | database.rules.json cannot drift-check against the already-live prod rules; only the --only convention guards it | firebase.json:33
- C-20261010-36 | 2026-10-10 | compliance | low | high | open | Only mint/close/recipient writes audit; admin reads of recovery PII are unlogged | database.rules.json:76
- C-20261010-37 | 2026-10-10 | compliance | low | medium | open | rateLimits retains reversible truncated email/IP hashes indefinitely | functions/src/helpers.ts:270
- C-20261010-38 | 2026-10-10 | compliance | high | medium | rejected | Reset/alert mail from auth.lecoursville.com is spoofable (no SPF, no DKIM, DMARC p=none, no rua) | dig +short TXT auth.lecoursville.com
  - rebuttal | rejected | `dig +short CNAME send.auth.lecoursville.com` and `dig +short TXT resend._domainkey.auth.lecoursville.com` | SPF is delegated via CNAMEs to *.forge.rmta.net (include:amazonses.com) and the DKIM TXT is present; Resend shows verified. The finding queried the wrong host.
- C-20261010-39 | 2026-10-10 | correctness | high | high | rejected | Rules fix never reaches prod; deploy targets hosting and functions only | scripts/deploy.sh:16
  - rebuttal | rejected | `firebase deploy --only database --project lecoursville` (2026-10-10) plus prod curl | prod users/people/addresses now return HTTP 401; rules were applied out-of-band in step 1d.
- C-20261010-40 | 2026-10-10 | security | high | high | addressed | Google sign-in self-provisions a member: any Google account writes users/$uid with roles.user=true, then reads all family PII and writes chat | src/app/components/auth/auth.component.ts:89 + src/app/services/auth.service.ts:203 + src/app/models/user.ts:26 + database.rules.json:36
  - rebuttal | open | code read | CONFIRMED: onGoogleSignIn calls onSignIn; missing record creates a user with roles.user=true; rules branch A permits a non-admin self-write; no allowlist blocks a stranger Google principal.
- C-20261010-41 | 2026-10-10 | security | high | high | addressed | Reset link is emailed to the unverified attacker-supplied alternateContact and the admin UI labels it trusted, enabling social-engineering account takeover | functions/src/admin-generate-reset-link.ts:180 + src/app/components/admin-recovery/admin-recovery.component.html:49
- C-20261010-42 | 2026-10-10 | security | medium | medium | open | Account-existence oracle survives the fallback sendPasswordResetEmail unless prod enumeration protection is confirmed ON | src/app/services/auth.service.ts:84
- C-20261010-43 | 2026-10-10 | security | medium | high | addressed | 25 recovery-alerts/day cap silently suppresses legitimate alerts once an attacker burns the budget; no skipped-alert marker | functions/src/submit-recovery-request.ts:107
- C-20261010-44 | 2026-10-10 | security | low | medium | addressed | Attacker name allows newlines (length-only validation) and flows into the alert email subject | functions/src/submit-recovery-request.ts:26
- C-20261010-45 | 2026-10-10 | security | low | high | addressed | Continue-URL allowlist ships localhost http origins in prod builds, not env-gated | functions/src/config.ts:10
- C-20261010-46 | 2026-10-10 | maintainability | medium | high | open | Second password-reset path (direct SDK fallback) duplicates the callable delivery layer and no spec exercises its trigger | src/app/services/auth.service.ts:84
- C-20261010-47 | 2026-10-10 | maintainability | medium | high | open | Rate-limit/audit/alert scaffolding is duplicated near-verbatim across the two callables with different constants | functions/src/request-password-reset.ts:50
- C-20261010-48 | 2026-10-10 | maintainability | medium | high | addressed | database-rules/2026-10-04/after.json is a JSON-identical duplicate of database.rules.json that will silently drift | database-rules/README.md:11
- C-20261010-49 | 2026-10-10 | maintainability | low | high | addressed | firebase-functions-test is installed on every gate run but imported by no file | functions/package.json:20
- C-20261010-50 | 2026-10-10 | maintainability | low | medium | open | Emulator-only get-then-set branch inside shipped compareAndSet creates a permanent prod/emulator code divergence | functions/src/helpers.ts:121
- C-20261010-51 | 2026-10-10 | correctness | high | high | addressed | Verifier: C-02, C-04, C-05, C-06, C-07 all CONFIRMED; C-09 CONFIRMED gate stale (config.ts Oct 10 18:26 vs last run Oct 4 18:53) | design_specs/critique/2026-10-10_account_recovery_prod_deploy.md

## Decisions (2026-10-10 walkthrough)

- [decision] C-40/C-01: do NOT gate Google enrollment. Instead add a real-time account-creation notification to eric@lecoursville.com plus prominent admin visibility. Override of the block recommendation. Residual: detective, not preventive; first read can precede the alert; depends on eric@ receiving (step 5a) and new code.
- [decision] C-41: keep auto-email to alternateContact; add an owner alert and prominent admin surfacing for recovery submissions and mints. Residual: social-engineering takeover relies on admin review.
- [decision] C-10 (+C-12/C-15): accept the admin-mint backstop; add a per-actor breach audit and a skipped-alert marker.
- [decision] C-07: set the Firebase console custom action URL to auth.lecoursville.com during the ops pass.
- [decision] C-13: enable web App Check in logging-only mode now; enforce after token coverage is confirmed.
- [decision] C-25 (+C-26/C-27/C-28/C-31/C-37): defer retention and erasure with a ticketed 90-day purge.
- [decision] C-23/C-42: require one live Resend send plus a console confirmation that email enumeration protection is ON, as deploy sign-off.
- [outcome] Not converged. The confirmed function defects C-02, C-03, C-04, C-05, C-06 and C-11 remain open and must be fixed before any prod functions deploy; the new detection features (account-creation alert, activity surfacing, App Check, signals) do not exist yet. Hosting bundle stays unshipped.

## Re-Critique Round (2026-10-10 fix pass)

Lenses run: data-integrity, abuse, reliability, security, plus a verifier. The verifier CONFIRMED all 11 targeted fixes (C-02..C-06, C-11, C-16..C-20, C-32) with file:line evidence and green unit tests. It also caught that `npm --prefix functions ci --dry-run` failed: the lock had lost the `@react-email/render` peer entries (react/react-dom/scheduler); resynced with `npm install`, now exit 0.

New findings:

- C-20261010-52 | 2026-10-10 | data-integrity | high | high | addressed | Deterministic request id ignored status: an identical resubmit after close or resolve was deduped forever, so a user believed a live request existed | functions/src/submit-recovery-request.ts:110
- C-20261010-53 | 2026-10-10 | abuse | high | high | addressed | Rate-limit commit results were discarded, so a concurrent burst passed the stale pre-checks and minted past the caps | functions/src/request-password-reset.ts:106 + functions/src/submit-recovery-request.ts:100
- C-20261010-54 | 2026-10-10 | data-integrity | medium | high | addressed | A deduped resubmit committed all three rate-limit layers before the dedupe check, burning the caller's budget | functions/src/submit-recovery-request.ts:100
- C-20261010-55 | 2026-10-10 | data-integrity | medium | high | addressed | The non-atomic exists pre-check let concurrent identical submits each push a distinct alert node | functions/src/submit-recovery-request.ts:133
- C-20261010-56 | 2026-10-10 | reliability | high | high | addressed | Alert fan-out was stateless under retry:true, so a mid-loop failure re-sent to every already-notified recipient on redelivery | functions/src/admin-alert-created.ts:73
- C-20261010-57 | 2026-10-10 | reliability | medium | high | open | onAccountCreated rethrows with retry:true but writes no dead-letter or status, so a persistent failure drops the C-40 alert with no trace | functions/src/account-created.ts:58
- C-20261010-58 | 2026-10-10 | abuse | medium | high | addressed | onAccountCreated sent one unvalidated, length-unbounded label to the owner and had no rate limit | functions/src/account-created.ts:24
- C-20261010-59 | 2026-10-10 | data-integrity | medium | high | open | A mint audit-write failure leaves a live credential with no audit trail (auditId null skips all emailStatus updates) | functions/src/admin-generate-reset-link.ts:181
- C-20261010-60 | 2026-10-10 | security | low | medium | open | The success branch awaits the Resend send, so response latency still distinguishes known from unknown accounts despite the 300ms floor | functions/src/request-password-reset.ts:146
- C-20261010-61 | 2026-10-10 | data-integrity | low | high | open | alertSuppressed is dead data: no UI reads it, so a suppressed alert stays invisible to operators | functions/src/submit-recovery-request.ts:128 + src/app/components/admin-recovery/admin-recovery.component.html
- C-20261010-62 | 2026-10-10 | data-integrity | low | medium | open | The stricter users/$uid rule denies the whole profile write when roles changed mid-session; the client updateUser promise is unhandled | database.rules.json:36 + src/app/services/auth.service.ts:161

Round outcomes:

- [rebuttal] C-02/C-03/C-04/C-05/C-06/C-11/C-16/C-17/C-18/C-19/C-20/C-32 addressed. Verifier CONFIRMED each at file:line; `npm --prefix functions test` 95/95; `npm run e2e:gate` 99/99 on chromium, webkit, firefox.
- [rebuttal] C-10/C-12/C-15/C-29/C-30/C-43/C-44/C-45 addressed. Per-actor breach audit and alertSuppressed marker implemented; recipient cap, close rate limit, name control-char validation, and env-gated localhost origins all landed with tests.
- [rebuttal] C-40/C-41 addressed by recorded decision plus implementation: onAccountCreated owner notification and admin account-creation/activity surfacing now exist; residual detective-only risk accepted.
- [outcome] NOT-CONVERGED. New high findings (C-52, C-53, C-56) were fixed in this pass; C-57 and C-59 remain open (medium, high confidence); C-13 App Check and the deferred retention items (C-14, C-25, C-31) remain open; ops items C-07, C-23, C-42 are human-only. Hosting bundle stays unshipped.

## Walkthrough Decisions (2026-10-10 re-critique)

- [decision] C-08: fix before ship. Route the swallowed `getRedirectResult` error through the existing `mapAuthError` (auth.service.ts:301).
- [decision] C-07: set the Firebase Auth custom action URL to https://lecoursville.com/auth/action before any prod reset email sends (console, no redeploy).
- [decision] C-57: fix before ship. Write a dead-letter on account-notification failure and consume the daily rate-limit key only after a successful send.
- [decision] C-59: fix before ship. Add a compensating record/alert when the mint audit write fails, so a live mint is never untraced.
- [decision] C-13: enable reCAPTCHA App Check logging-only before ship; enforce after token coverage is confirmed.
- [decision] C-23/C-42: keep the hard deploy sign-off (one live Resend send + console confirmation that prod email enumeration protection is ON).
- [decision] C-25 (+C-14/C-26/C-27/C-28/C-31/C-37): PULL RETENTION FORWARD. Overrides the earlier defer recommendation; retention/consent needs a design before implementation.
- [outcome] Ship gate stays closed. Fix round 2: C-08, C-57, C-59 (code); C-13 (code + console); retention (spec first). Defaults C-21/C-33/C-34/C-35/C-36/C-46/C-47/C-50/C-60/C-61/C-62 stand as vetoable.

## Redteam Round: Sign-In Help Surface (2026-10-10)

Red-teamed the newly prominent "Get help signing in" entry point with three lenses (visual-critic on rendered desktop/mobile/reset screenshots, product-critic, adversary).

- C-20261010-63 | 2026-10-10 | abuse | high | high | addressed | Global recovery cap (60/day) returned {ok:true} but wrote nothing, so a saturated cap showed a false success receipt with no record of who was turned away | functions/src/submit-recovery-request.ts:79-113
- C-20261010-64 | 2026-10-10 | security | medium | high | addressed | Attacker `message`/`alternateContact` newlines flowed raw into the admin alert text body, forging lines in the mail admins trust | functions/src/admin-alert-created.ts:9 oneLine normalization + spec
- C-20261010-65 | 2026-10-10 | product | medium | medium | addressed | Recovery dialog promised "out of band" delivery (jargon + vishing-training hazard) and re-asked the email the sign-in form already had | recovery-request.component.* reworded + dialog-data prefill; e2e added
- C-20261010-66 | 2026-10-10 | visual | low | high | addressed | Reset banner had two duplicate recovery actions, spam copy twice, and a vertically-centered icon against a multi-line body | src/app/components/auth/auth.component.html/.scss; screenshots re-captured

Improvements applied this round:

- [decision] Removed the banner's inner recovery button (the escalation block owns recovery); collapsed the spam copy to one sentence with a wait cue; removed the redundant hint.
- [decision] Ordered the fork: "Forgot password?" (quick self-serve) above the rule, "Tried a reset and still locked out?" + outlined "Get help signing in" (escalation) below.
- [decision] Fixed rhythm/spacing (field/divider/submit/help margins), banner radius to 16px, icon top-aligned, "Forgot password?" given an explicit brand-link token (the MDC token override had no effect).
- [decision] Recovery dialog copy de-jargoned ("An administrator will review your request and contact you using the details you give us"); alternate contact relabelled with a hint; dialog prefills the typed email + cached name.
- [decision] "Forgot password?" now has a pending state (`sendingReset`) so a cold callable does not invite repeat taps.
- [decision] C-63: keep the non-enumerating `{ok:true}` success (no contract change), but record every global-cap turn-away with raw identity (`targetEmail`, `name`, `alternateContact`, `actorUid` when present, `actorHash`) in `recoveryAudit` as `recovery_attempt_denied`, bounded to 2/email and 50/day, and surface it in the recovery activity feed (`ACTIVITY_ACTIONS` + `auditActor` target fallback). Per-actor/per-email breach audits stay hashed-only.
- [outcome] C-63 addressed. Evidence: functions test 98/98; `npm run e2e:gate` 101/101 x3 (new spec: "admin sees a recovery attempt the global cap turned away").

## Awareness + Analytics (2026-10-10)

- [decision] Keep the turn-away capture bound at 50. Awareness guarantee: hitting the global cap raises a once-per-window admin alert (`rate_limit_breach`, durable record + email) plus per-attempt `recovery_attempt_denied` rows; filling the 50-entry capture bound raises a second once-per-window alert ("Recovery turn-away log is full") and a `recovery_denied_log_capped` audit, so truncation is never silent.
- [risk] The push email depends on `eric@lecoursville.com` receiving (runbook step 5a, not done); until then awareness is pull-only via the durable `adminAlerts` record and the recovery activity feed.
- [decision] Trends captured at every juncture. Client (Firebase Analytics, prod-only, no-op in the emulator): `auth_forgot_clicked`, `auth_reset_sent`, `auth_reset_failed(reason)`, `recovery_opened(source)`, `recovery_validation_error`, `recovery_submitted(hasAlternateContact)`, `recovery_submit_failed`. Server (durable `recoveryAudit`/`adminAlerts`): `password_reset_email(sent|failed)`, `rate_limit_breach(email|ip|global)`, `recovery_attempt_denied`, `recovery_denied_log_capped`, `generate_reset_link`, `generate_reset_link_resolve_raced`, `generate_reset_link_audit_failed`, `close_request`, `account_created_notified`, `account_created_notify_failed`, and the alert `emailStatus`/`recipientCount`.
- [outcome] Verified. Evidence: functions test 100/100; `npm run e2e:gate` 101/101 x3.
