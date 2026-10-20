# Account Recovery: Guaranteed Regain-Access Design Spec

**Branch:** `feat/account-recovery`, cut from `master` at `aabaef96`.
**Spec file:** `design_specs/2026-10-02_account_recovery.md`.
**Status:** ready for implementation.
**Scope decision:** one spec, one branch, covering all three workstreams (reset handler and deliverability, Google sign-in, admin recovery loop and alerting).

---

## Context and motivation

Real production users cannot get back into their accounts after forgetting a password.

Two failure classes are reported:

- The reset email most commonly never arrives at all, and is presumed to land in spam or a quarantine.
- In at least one confirmed case the email arrived but the link did not successfully reset the password.

The current design has structural gaps that explain both.

- `AuthService.sendPasswordReset` calls `sendPasswordResetEmail` with no `ActionCodeSettings` (`src/app/services/auth.service.ts:60-63`), so the mail is sent from Firebase's default `firebaseapp.com` sender with no control over DKIM or domain alignment.
- The reset link, if it reaches the app, can be swallowed. `firebase.json:9-14` rewrites every path including `/__/auth/action` to `index.html`, and `AuthComponent.ngOnInit` immediately calls `NavigateToSignIn()` (`src/app/components/auth/auth.component.ts:38`), which navigates to `/` and drops all query parameters (`src/app/services/routing.service.ts:51-53`). No route or component anywhere reads `mode` or `oobCode`.
- There is no recovery path that does not depend on email delivery.
- The only working workaround today is an operator deleting the user in the Firebase console and having them re-register. That destroys the account and orphans the Realtime Database record keyed by the old UID, because `users/{uid}` is keyed by the auth UID (`scripts/e2e/seed.mjs:322-328`, `src/app/models/user.ts:18`).

The cost is user trust and recurring manual operator time.

---

## Glossary

- **Action code / oobCode**: the one-time code Firebase embeds in a reset link. Consumed by `verifyPasswordResetCode` and `confirmPasswordReset`.
- **ActionCodeSettings**: the object that controls the reset link's continue URL and whether it opens in the app (`handleCodeInApp`).
- **Custom in-app action handler**: our own `/auth/action` route that receives the action code and performs the reset, instead of Firebase's hosted page.
- **Callable function**: a Cloud Function invoked from the client through the Firebase Functions SDK (`httpsCallable`), carrying the caller's auth context.
- **Trigger function**: a Cloud Function that fires on a Realtime Database write.
- **Enumeration protection**: the Identity Platform setting that suppresses account-existence errors from password reset and sign-in, on by default for projects created on or after 2023-09-15.
- **Alternate contact**: one optional field in the recovery request, an email or a phone, used to deliver a link out of band when the account email is the broken channel. Never collected at signup.
- **Recovery link**: a fresh password reset link minted server-side by the Admin SDK (`generatePasswordResetLink`), which the admin can relay directly.
- **Escalation**: a locked-out-user recovery request that reaches an admin.
- **MAU**: monthly active user, the Identity Platform billing unit.

---

## Current state (evidence)

| Fact | Location |
|---|---|
| Password reset sends with no `ActionCodeSettings` | `src/app/services/auth.service.ts:60-63` |
| Sign-in and reset form logic | `src/app/components/auth/auth.component.ts:66-99`, `src/app/components/auth/auth.component.html:20-53` |
| `ngOnInit` strips the URL to `/` | `src/app/components/auth/auth.component.ts:38`, `src/app/services/routing.service.ts:51-53` |
| Catch-all hosting rewrite | `firebase.json:9-14` |
| Wildcard Angular route renders `AuthComponent` | `src/app/app-routing.module.ts:164-167` |
| No handling of `mode`, `oobCode`, `verifyPasswordResetCode`, `confirmPasswordReset`, `signInWithEmailLink`, `ActionCodeSettings` anywhere in `src` | confirmed by full-tree search, zero matches |
| No `firebase-admin`, no Cloud Functions, no `httpsCallable`, no `GoogleAuthProvider` anywhere | confirmed by full-tree search, zero matches |
| Prod auth domain is `lecoursville.firebaseapp.com`, app domain is `lecoursville.com` | `src/environments/environment.prod.ts:7` |
| Dev and e2e auth domains are `lecoursville-dev.firebaseapp.com` | `src/environments/environment.ts:13`, `src/environments/environment.e2e.ts:17-19` |
| E2E gate builds and boots auth, database, storage, hosting only | `scripts/e2e/gate.sh:10-19` |
| Deploy is hosting-only on purpose, so rules cannot be overwritten | `scripts/deploy.sh:7-22` |
| Admin user deletion removes only the RTDB record, not the auth account | `src/app/services/admin.service.ts:44-46` |
| Admin user page gated on `roles.super` | `src/app/components/admin-users/admin-users.component.ts:37,59` |
| Admin children routes | `src/app/app-routing.module.ts:109-154` |
| Feature flags live at `features`, promoted route at `promotedRoute` | `src/app/services/feature-flags.service.ts:11,70-82` |
| E2E users and password seed | `scripts/e2e/seed.mjs:21-30` |
| Auth emulator exposes one-time codes | `node_modules/firebase-tools/lib/emulator/auth/apiSpec.js:4057` (`GET /emulator/v1/projects/{projectId}/oobCodes`) |
| Firebase SDK version 12.17.1 | `package.json:33` |

External facts established during research (source in parentheses):

- `sendPasswordResetEmail` accepts `ActionCodeSettings` with `url`, `handleCodeInApp`, and `linkDomain`; the continue URL domain must be an authorized domain (firebase.google.com/docs/auth/web/passing-state-in-email-actions).
- The Admin SDK `generatePasswordResetLink(email, actionCodeSettings)` returns a link and does not send mail; the documented pattern is to send it yourself through your own provider (firebase.google.com/docs/auth/admin/email-action-links).
- Client-side code cannot mint a custom reset link. A callable Cloud Function wrapping the Admin SDK is the standard path (firebase.google.com/docs/auth/extend-with-functions).
- Firebase Auth's custom email domain feature sets the From field and action links but does not give DKIM key control, and Google remains the sender (firebase.google.com/docs/auth/email-custom-domain).
- There is no Auth trigger for "password reset requested". Available Auth blocking triggers are `beforeUserCreated`, `beforeUserSignedIn`, `beforeEmailSent`, `beforeSmsSent`; background Auth triggers are only user create and delete (firebase.google.com/docs/functions/auth-blocking-events, firebase.google.com/docs/functions/auth-events).
- RTDB v2 triggers are `onValueCreated`, `onValueUpdated`, `onValueDeleted`, `onValueWritten` (firebase.google.com/docs/functions/database-events). Functions emulator support for v2 RTDB triggers is not documented and must be spiked.
- The Firebase "Trigger Email" extension is Firestore-only and is being deprecated, so it is not usable here.
- At low volume, domain authentication dominates provider brand; no credible independent inbox-placement comparison exists across Resend, Postmark, Mailgun, and SES. Resend free covers 3,000 emails/month and supports SPF, DKIM, and DMARC (resend.com/pricing, support.google.com/a/answer/81126).
- Google sign-in on web uses `GoogleAuthProvider` with `signInWithPopup` or `signInWithRedirect`; a matching email on an existing email/password account raises `auth/account-exists-with-different-credential` under one-account-per-email (firebase.google.com/docs/auth/web/google-signin, firebase.google.com/docs/auth/web/account-linking).
- Under email enumeration protection, `fetchSignInMethodsForEmail` is disabled, so the classic account-linking lookup cannot be used (cloud.google.com/identity-platform/docs/admin/email-enumeration-protection).
- Phone/SMS requires Blaze plus Identity Platform and only helps users who enrolled a phone before lockout, so it is deferred.

---

## Goals

1. A user who forgot their password can always reach a state where an admin can deliver a fresh reset link through a channel other than the broken account email.
2. The reset link works end to end in the app, including expired and already-used codes, with a clear re-request path.
3. Reset and alert email is sent from an authenticated `lecoursville.com` subdomain with SPF, DKIM, and a staged DMARC policy, and deliverability is measured with a defined acceptance test.
4. Google sign-in is available and can be linked to an existing email/password account, giving users a password-independent path going forward.
5. Admins receive an email alert when a user escalates, from a configurable recipient list, through a reusable alert core.
6. Admins can view recovery requests and mint a reset link that is always shown to the admin, and emailed to the alternate contact when that contact is an email, with an immutable audit trail.
7. The old delete-and-reregister workaround is removed from the operator playbook and replaced by link generation that preserves the UID and all `users/{uid}` data. A missing auth account is reported cleanly, never silently recreated.
8. Every user-visible flow in this spec has automated Playwright coverage under `e2e/specs/`; the gate stays green and protects against regression.

---

## What "guarantee" means here

- There is no cryptographic guarantee for a user who has no accessible contact channel and no enrolled second factor. Identity in that case rests on admin judgment.
- The guarantee this design provides is operational: the account is never destroyed, an admin can always mint a working reset link, and there is an out-of-band delivery path the admin controls.
- Residual risk: a user who cannot be verified by any means, and who supplied no alternate contact, still depends on admin discretion. The audit trail makes that decision accountable, and Google enrollment reduces how often the case arises.
- The user can always file a recovery request; an alternate contact is optional, so a locked-out user with no second channel is never blocked from reaching an admin.
- The old workaround deleted the account and orphaned its data. This design never does that.

## Non-goals

- Phone/SMS sign-in. Deferred because it only helps users who enrolled beforehand and it adds reCAPTCHA, region policy, and per-SMS cost.
- Facebook sign-in. Removed from scope by decision.
- MFA enrollment. Not required for recovery and not currently enabled.
- A general notification center with per-admin preferences, read/unread state, and arbitrary trigger builders. This spec builds the minimal generic core plus one trigger.
- Automatically deploying RTDB rules. The rules file is version-controlled and enforced by the emulator gate, but applying it to production stays a deliberate manual step; `scripts/deploy.sh` never targets `database`.
- Recreating deleted auth accounts. The spec previously considered an admin restore action; it is dropped by decision. A missing auth user is reported cleanly, not recreated.
- Alert retry, a failed-alert admin view, and retention cleanup for `outboundEmails`, `rateLimits`, and old recovery records. These were reviewed and explicitly deferred; see Open questions.
- Backfilling or altering existing auth accounts.

---

## Prerequisites (non-code, must be confirmed before implementation)

1. **Blaze plan.** Cloud Functions with outbound network requires Blaze. The user believes the project is already on Blaze; confirm in the Firebase console for both `lecoursville` and `lecoursville-dev`.
2. **Resend account and domain.** Create a Resend account, add the domain `lecoursville.com`, and plan to send from the subdomain `auth.lecoursville.com`. Store the API key as a Functions secret named `RESEND_API_KEY`.
3. **DNS access** for `lecoursville.com` to add SPF, DKIM, and DMARC records.
4. **Google OAuth consent screen.** In Google Cloud console for the project, configure the OAuth consent screen and publish it, or users outside the test-user list cannot sign in. Add `lecoursville.com` and `lecoursville.firebaseapp.com` as authorized domains.
5. **Email enumeration protection state.** Check Authentication, Settings, User account management, User actions. Record whether it is enabled. If it is off and the project predates 2023-09-15, enable it.
6. **Authorized domains.** Add `lecoursville.com` (and `localhost` for dev) under Authentication, Settings, Authorized domains so the reset continue URL is accepted.
7. **Current RTDB rules export.** Export the existing Realtime Database rules from the Firebase console for `lecoursville-dev` and `lecoursville`. `database.rules.json` must be the complete current rules plus the additions in C5, and must be diffed before it is wired into the emulator. Without the current rules, every existing e2e test will fail under the new file.

---

## Design principles

- **Defense in depth.** Email reset first, Google as a preventive path, admin-assisted delivery as the guarantee, all three share one audit trail.
- **Never leak account existence.** All reset and recovery outcomes return a generic success.
- **No client-side secrets.** All privileged work (link minting, email sending, alert fan-out) runs in Cloud Functions.
- **Rules stay closed.** Clients never write recovery, alert, audit, or recipient nodes directly; only the Admin SDK does.
- **Preserve identity.** Recovery never deletes or recreates an auth account; it restores access to the existing UID.
- **Deterministic tests.** In the emulator, outbound email is recorded to the database instead of hitting Resend, so assertions never depend on the network.

---

## Architecture overview

- A new `functions/` TypeScript codebase holds all callable and trigger functions.
- The client talks to functions through a new `CloudFunctionsService` and a `functions` instance exposed by `FirebaseService`.
- Because `src/environments/*` is untracked, the functions instance is created with `getFunctions(app, "us-central1")` and, when the existing `useEmulators` flag is true, connected with `connectFunctionsEmulator(functions, "127.0.0.1", 5001)`. No new environment field is added.
- Reset mail is sent by the `requestPasswordReset` callable through Resend, with an in-app action link.
- `/auth/action` is a new unguarded Angular route that performs verify and confirm locally.
- Google sign-in is added to the login page and to the account card as a link action.
- Recovery requests write to `recoveryRequests` and `adminAlerts`; an RTDB trigger emails admins.
- Admin tooling at `/admin/recovery` lists requests, mints links, manages recipients, and reads the audit trail.

---

## Workstream A: reset link, handler, and deliverability

### A1. Functions project scaffolding

- Create `functions/` with `package.json`, `tsconfig.json`, and `src/index.ts`.
- Runtime: Node 20 or 22. Dependencies: `firebase-admin`, `firebase-functions`, `resend`. Dev dependencies: `typescript`, `vitest`, `firebase-functions-test`.
- `functions/package.json` scripts: `build` (`tsc`), `test` (`vitest run`), `serve` (`firebase emulators:start --only functions`).
- Region: `us-central1` for every function, exported once as a constant.
- Add to `firebase.json` a top-level `functions` block with `source: "functions"` and `predeploy: ["npm --prefix functions run build"]`.
- Secrets: declare `RESEND_API_KEY` with the v2 `defineSecret` helper. Emulator reads `process.env.RESEND_API_KEY` or a dummy.

### A2. `requestPasswordReset` callable

- Signature: `onCall({ cors: true, secrets: [RESEND_API_KEY] })`.
- Input: `{ email: string }`.
- Normalize with `trim().toLowerCase()`.
- Validate the email shape with a strict pattern (non-empty local part, `@`, a dotted domain). Malformed input throws `HttpsError("invalid-argument", "Invalid request.")`. Shape errors are not enumeration-sensitive, so a throw is correct here.
- Rate limit: per email hash at 5 per hour at `rateLimits/resetRequests/{emailHash}`, a per-actor cap of 20 per hour at `rateLimits/resetRequestsIp/{actorHash}`, and a global cap of 200 per hour at `rateLimits/resetRequestsGlobal/global`. The actor is the platform socket address, falling back to the last `x-forwarded-for` hop (the one GCP appends), so a rotating spoofed first hop cannot mint a new actor. Each layer keeps one key holding `{ windowStart, count, previous }` for the weighted sliding window. On breach still return `{ ok: true }` and skip sending. Hard caps are kept by decision.
- Call `admin.auth().generatePasswordResetLink(email, actionCodeSettings)` where `actionCodeSettings = { url: continueUrl, handleCodeInApp: true }`.
- The client supplies `continueUrl` as `window.location.origin + "/auth/action"` in the callable payload. The function validates it against an allowlist of `https://lecoursville.com`, `https://lecoursville.firebaseapp.com`, `http://localhost:5000`, and `http://127.0.0.1:5000`, and rejects anything else. This avoids editing the untracked files under `src/environments/`.
- On `auth/user-not-found`, return `{ ok: true }` and send nothing.
- On success, send the email through Resend:
  - From: `LeCoursville <no-reply@auth.lecoursville.com>`.
  - Reply-To: a monitored mailbox, for example `support@lecoursville.com`.
  - Subject: `Reset your LeCoursville password`.
  - Body: plain text plus minimal HTML, containing the generated link and an expiry note. No tracking pixels, no link shorteners.
- In the emulator (`process.env.FUNCTIONS_EMULATOR === "true"` or `EMAIL_DRY_RUN === "1"`), do not call Resend. Write a record to `outboundEmails/{pushId}` with `{ to, from, subject, text, html, kind: "password_reset", link, createdAt }` and mark delivery as stubbed.
- Always resolve `{ ok: true }`.
- The client keeps `AuthService.sendPasswordReset` as a thin wrapper that calls this function. If the callable is unavailable (cold deploy, network), fall back to the existing `sendPasswordResetEmail(auth, email, { handleCodeInApp: true, url })` so a reset can still be attempted.

### A3. Custom in-app action handler

- New route `/auth/action` registered in `src/app/app-routing.module.ts` before the `**` wildcard (`:164-167`).
- New component `src/app/components/auth-action/` with `AuthActionComponent`.
- The route is public (no `AuthGuardService`), stands alone, and is not the wildcard fallback.
- On init, read `mode` and `oobCode` from the query string using `ActivatedRoute`.
  - If either is missing, render an "invalid link" state with a link back to `/`.
  - `mode=resetPassword`: call `verifyPasswordResetCode(auth, oobCode)`.
    - On success, show a new-password form (password plus confirm), with a strength hint and `autocomplete="new-password"`.
    - On submit, call `confirmPasswordReset(auth, oobCode, newPassword)`.
    - On success, show a success state with a "Sign in" call to action.
    - On `auth/expired-action-code` or `auth/invalid-action-code`, show a clear error and a "Send a new link" button that opens the reset request for the email if known, otherwise returns to `/`.
    - On `auth/user-disabled`, show a contact-admin message.
  - `mode=signIn` or `mode=verifyEmail`: redirect to `/` with a neutral notice for now; not required by this feature but must not crash.
- The component must not call `NavigateToSignIn` and must preserve the query string while it is mounted.
- Add the verify and confirm wrappers to `AuthService`: `verifyResetCode(code)` and `confirmReset(code, newPassword)`.

### A4. Resend and domain authentication runbook

This is console and DNS work, recorded here so the implementation step does not have to rediscover it.

1. In Resend, add domain `lecoursville.com` and use the subdomain `auth.lecoursville.com` as the sending domain.
2. Add the SPF record Resend provides for `auth.lecoursville.com`. Keep exactly one `v=spf1` record for the domain.
3. Add the DKIM CNAME records Resend provides. Confirm the key is 2048-bit.
4. Add DMARC at `_dmarc.lecoursville.com`, staged:
   - Start `v=DMARC1; p=none; rua=mailto:dmarc@lecoursville.com; fo=1`.
   - After SPF and DKIM show passing for all senders, move to `p=quarantine`.
   - After a clean period, move to `p=reject`.
5. Confirm the From domain aligns with the DKIM or SPF domain.
6. Set the Firebase Auth custom email domain to `lecoursville.com` under Authentication, Templates, so Firebase's own verification and fallback emails align too. Note this does not give DKIM control, which is why our reset mail goes through Resend.
7. Acceptance test before declaring deliverability fixed:
   - Send a real reset through the deployed function to a seed Gmail, Outlook, and Yahoo inbox.
   - `mail-tester.com` score of 9/10 or better, with SPF, DKIM, and DMARC all passing.
   - All three seed messages land in the inbox, not spam.
   - Open and complete the reset from each.
   - Record the results in the PR description.
8. BIMI is explicitly not pursued; it requires a paid mark and sufficient sending volume.

### A5. Login and reset UI

- Replace the bare "Forgot password?" text button (`src/app/components/auth/auth.component.html:49-52`) with a clear, accessible affordance group beneath the password field:
  - A secondary text button "Forgot password?" that requests the email reset for the entered address.
  - A visually distinct help link "Trouble getting in? Request account recovery" that opens the recovery dialog.
- Add a "Continue with Google" button above the email form, separated by an "or" divider. This is the conventional, accessible placement.
- Copy and error handling:
  - Reset success shows the enumeration-safe message: `If an account exists for that email, we sent a reset link. Check your inbox and spam folder.`
  - Keep a "still not seeing it?" line that points to the recovery request.
- Extend `mapAuthError` (`src/app/components/auth/auth.component.ts:117-132`) with `auth/invalid-action-code`, `auth/expired-action-code`, `auth/account-exists-with-different-credential`, `auth/popup-blocked`, `auth/popup-closed-by-user`, `auth/operation-not-allowed`, and keep `auth/too-many-requests` and `auth/network-request-failed`.
- Accessibility and best practice: minimum 44 by 44 pixel tap targets, visible focus rings, `aria-live` on banners, buttons labelled by their visible text, and no color-only meaning.

---

## Workstream B: Google sign-in

### B1. Provider enablement

- Enable the Google provider in the Firebase console for `lecoursville` and `lecoursville-dev`.
- Complete the OAuth consent screen prerequisite (see Prerequisites item 4).
- No Facebook.

### B2. Client integration

- Add `signInWithGoogle()` to `AuthService` using `GoogleAuthProvider` and `signInWithPopup`.
- On `auth/popup-blocked` or in known mobile in-app browsers, fall back to `signInWithRedirect` and handle the result on load.
- Handle `auth/account-exists-with-different-credential`:
  - Because enumeration protection disables `fetchSignInMethodsForEmail`, do not attempt provider discovery.
  - Show: `An account already exists for this email. Sign in with your email and password, then connect Google from your account page.`
- Route a successful Google sign-in through the existing `onSignIn` and user-record creation path (`src/app/services/auth.service.ts:121-153`). Google supplies `uid`, `displayName`, and `email`, which map onto `User.id`, `User.name`, and `User.email`.

### B3. Account linking

- Add a "Connect Google" row to the account card (`src/app/components/user-view/`).
- It calls `linkWithPopup(auth.currentUser, new GoogleAuthProvider())`.
- Success shows "Google connected" and reflects provider state from `auth.currentUser.providerData`.
- Failure surfaces a mapped message. Disconnecting Google is out of scope to avoid lockout risk.

---

## Workstream C: recovery loop and admin alerting

### C1. Generic alert core

- New RTDB node `adminAlerts`, append-only from the server side.
- Shape: `{ id, type, title, body, data, createdAt, createdBy, emailStatus, emailError, recipientCount }`.
  - `type` is a string enum; the only value implemented now is `recovery_request`.
  - `emailStatus` is `pending`, `sent`, `stubbed`, or `failed`.
- New trigger `onAdminAlertCreated`, v2 `onValueCreated("/adminAlerts/{alertId}")`, region `us-central1`, with `RESEND_API_KEY`. The WP1 spike proved v2 RTDB triggers fire in the emulator, so v2 is used and the v1 fallback is not needed.
  - Read the alert. If it is missing or its `emailStatus` is not `pending`, stop.
  - Build the email body as escaped text only. Never interpolate `title`, `body`, or `data` into HTML without escaping, because `body` is built from unauthenticated recovery input. This closes a phishing injection vector aimed at the admins who can mint takeover links.
  - Read `config/adminAlertRecipients` as an array of addresses. Realtime Database keys cannot contain `.`, so addresses are stored as array values, never as keys.
  - If the array is empty or missing, read `users` once and collect every record whose `roles.admin === true`. The user base is small and this fallback is rare, so no index is added. Deduplicate and drop empty addresses.
  - Send one email per recipient through Resend from `LeCoursville Alerts <no-reply@auth.lecoursville.com>`. Cap the fan-out at 50 recipients per alert.
  - Update the alert's `emailStatus` and `recipientCount`, or `failed` plus `emailError`. Do not rethrow.
  - Emulator behavior mirrors A2: write `outboundEmails/{pushId}` and set `emailStatus` to `stubbed`.
- Reliability note: retry with backoff, a failed-alert admin view with a resend action, and retention cleanup are deferred by decision. The `emailStatus` and `emailError` fields remain so failures are at least durably visible in the database.

### C2. Recovery request

- New component `src/app/components/recovery-request/`, a Material dialog opened from the login page.
- Fields: `email` (required), `name` (required), `alternateContact` (optional, a single field labelled "Email or phone, optional"), `message` (optional). Length caps: `name` 100, `alternateContact` 320, `message` 500. No recovery fields are collected at signup, which stays streamlined.
- Add a small explanatory paragraph about what happens next and that an admin may contact them out of band.
- Submit calls the `submitRecoveryRequest` callable:
  - Input as above.
  - Validate shape and lengths. An alternate contact is not required, so a locked-out user with no second channel can always reach an admin. When present, treat it as an email if it contains `@`, otherwise as a phone.
  - Rate limit at `rateLimits/recoveryRequests/{emailHash}`, cap 3 per 24 hours, with a per-actor cap of 20 at `rateLimits/recoveryRequestsIp/{actorHash}` and a global cap of 60 at `rateLimits/recoveryRequestsGlobal/global`. Hard caps are kept by decision.
  - The `recovery_request` admin alert is throttled to 25 per 24-hour window at `rateLimits/recoveryAlerts/global`, so rotating emails or IPs cannot turn accepted requests into an unbounded admin mail bomb.
  - Write `recoveryRequests/{pushId}` with `{ id, email, name, alternateContact: valueOrNull, message: valueOrNull, status: "open", createdAt, updatedAt }`.
  - Write `adminAlerts/{pushId}` with `type: "recovery_request"` and the request data, unless the alert throttle is exhausted for the window.
  - Return `{ ok: true }` for an accepted, rate-limited, or capped request alike, so the response never reveals cap state.
- The dialog shows a generic confirmation and closes.

### C3. Admin recovery tooling

- New admin child route `/admin/recovery` under `src/app/app-routing.module.ts:113-153`, guarded by `AuthAdminGuardService`, plus a sidebar item in `src/app/components/admin/admin.component.html:8-59`.
- New component `src/app/components/admin-recovery/` with three regions.
- Region 1, recovery requests:
  - Reads `recoveryRequests` where `status === "open"`, newest first, showing email, name, alternate contact, message, and age. When no alternate contact is present the row is flagged "no alternate contact" so the admin knows they must decide the channel.
  - A "Generate reset link" action per request calls the `adminGenerateResetLink` callable with `{ requestId, email, reason, continueUrl }`.
  - On success, display the returned link with a copy-to-clipboard button, show whether the alternate address was emailed, and update the request to `status: "resolved"`, `resolvedBy`, `resolvedAt`.
  - A "Mark closed" action sets `status: "closed"` without minting a link.
- Region 2, alert recipients:
  - Editable list bound to `config/adminAlertRecipients` (an array of addresses).
  - Add and remove recipients with validation. Writes go through a callable `updateAlertRecipients` that verifies the caller is an admin and writes an audit entry.
- Region 3, audit trail:
  - Read-only list from `recoveryAudit`, newest first, showing actor, action, target, reason, and timestamp.
- The `adminGenerateResetLink` callable:
  - Requires `request.auth`; resolve the caller's RTDB record at `users/{uid}` and require `roles.admin === true`, else throw `permission-denied`.
  - Rate limit per actor at 20 per hour via `rateLimit("adminResetLinks", uid, 20, 3600000)`. On breach write at most one `rate_limit_breach` audit entry and raise at most one admin alert per actor per window, then throw `resource-exhausted`.
  - Validate `email`, a non-empty `reason` (max 500), and the allowed `continueUrl`.
  - If `requestId` is present, load `recoveryRequests/{requestId}` and mint for the record's `email`, not the payload email; if the payload `email` differs, throw `invalid-argument`. Use a transaction that requires `status === "open"`, otherwise throw `failed-precondition` with `already-handled`, so two admins cannot double-mint and a closed request cannot be used.
  - Call `admin.auth().generatePasswordResetLink(email, { url: continueUrl, handleCodeInApp: true })`.
  - Resolve `targetUid` with `getAuth().getUserByEmail(email)`. If the user does not exist, catch `auth/user-not-found`, write a `generate_reset_link_failed` audit entry, and throw `HttpsError("not-found")`. Do not create an account.
  - If the request's `alternateContact` is an email, send the link there through Resend. If it is a phone or absent, skip the email; the admin relays the displayed link.
  - Write `recoveryAudit/{pushId}` with `{ id, action: "generate_reset_link", actorUid, actorEmail, targetUid, targetEmail, requestId, reason, createdAt }`.
  - Return `{ ok: true, link, emailed: boolean }`.
- The operator playbook changes: the console delete-and-reregister workaround is removed. Recovery mints a link for the existing account; a missing account is reported cleanly, never silently recreated.

### C4. Data model additions

```text
adminAlerts/{alertId}:
  id, type, title, body, data, createdAt,
  createdBy, emailStatus, emailError, recipientCount

recoveryRequests/{requestId}:
  id, email, name, alternateContact, message,
  status ("open" | "resolved" | "closed"),
  createdAt, updatedAt, resolvedBy, resolvedAt

recoveryAudit/{auditId}:
  id, action, actorUid, actorEmail, targetUid, targetEmail,
  requestId, reason, createdAt

config/adminAlertRecipients:
  ["<address>", ...]

rateLimits/resetRequests/{emailHash}:
  windowStart, count, previous
rateLimits/resetRequestsIp/{actorHash}:
  windowStart, count, previous
rateLimits/resetRequestsGlobal/global:
  windowStart, count, previous
rateLimits/recoveryRequests/{emailHash}:
  windowStart, count, previous
rateLimits/recoveryRequestsIp/{actorHash}:
  windowStart, count, previous
rateLimits/recoveryRequestsGlobal/global:
  windowStart, count, previous
rateLimits/recoveryAlerts/global:
  windowStart, count, previous
rateLimits/adminResetLinks/{actorUid}:
  windowStart, count, previous

outboundEmails/{pushId}:               # emulator only
  to, from, subject, text, html, kind, link, createdAt
```

### C5. Security rules (version-controlled) and runbook

- Rules move into version control at `database.rules.json`, wired into `firebase.json` with `"database": { "rules": "database.rules.json" }`, so the RTDB emulator enforces them and `e2e/specs/security.spec.ts` can assert the new-node rules for real.
- The file now contains the complete exported rules for `lecoursville-dev` plus the additions below and the hardening listed under Existing-rule hardening. The `lecoursville` prod rules must be diffed against it before the manual apply. A file with only the new nodes would make the emulator deny normal app operations and fail every existing e2e test.
- New node rules:
  - `recoveryRequests`, `adminAlerts`, `recoveryAudit`, `config/adminAlertRecipients`, `rateLimits`: client read allowed only for admins, client write denied. All writes happen through the Admin SDK. `config/adminAlertRecipients` is an array, because Realtime Database keys cannot contain the dots in an email address.
  - `outboundEmails`: client read and write denied entirely.
  - `photos`: add `.indexOn: ["albumId"]`; `userUploads`: add `.indexOn: ["status"]`, matching the existing orderByChild queries. No index is needed on `users`.
- Admin check expression: `auth != null && root.child('users').child(auth.uid).child('roles').child('admin').val() === true`.
- Existing-rule hardening, applied because the exported production rules contained live escalation and exposure bugs:
  - All role checks changed from `.exists() === true` to `.val() === true`. `.exists()` was true for a stored `false`, and every app-created user has `roles.admin: false`, so every user passed the admin and super checks.
  - `users.read` changed from `"true"` to `"auth != null"`, closing unauthenticated account enumeration. The dead `$uid.read` child is removed.
  - `users/$uid` self-write can no longer grant admin or super; it either keeps roles unchanged or writes the non-privileged default.
  - `people`, `addresses`, and the new `families` reads changed from public to `"auth != null"`.
  - `calendars.write` aligned from `roles/super` to `roles/admin`, matching the admin console that edits calendars and the admin guard.
  - Missing `photoAlbums`, `families`, and `userUploads` rules added. `userUploads` allows an anonymous create only when the record does not exist and `status === "pending"`, with admin-only read and write.
- Because `userUploads` read is admin-only and `UserUploadService` eagerly subscribed to the whole node in its constructor, `allUploads$` becomes a lazy, shared observable so anonymous upload pages never read `userUploads`. Only the admin upload queue triggers the read.
- Deploy safety: `scripts/deploy.sh` still targets `--only hosting,functions`, so rules are never auto-deployed. Applying the file to production is a deliberate manual `firebase deploy --only database` (or console paste) after review, diffed against the console first. Commit the file so the diff is reviewable; a wrong permissive rule is the real risk, and review plus the emulator gate is how it is caught.

---

## Backend requirements

- Functions codebase at `functions/`, TypeScript, Node 20 or 22, region `us-central1`.
- Callables: `requestPasswordReset`, `submitRecoveryRequest`, `adminGenerateResetLink`, `closeRecoveryRequest`, `updateAlertRecipients`.
- Trigger: `onAdminAlertCreated`.
- Shared helpers: `sendEmail` (Resend or emulator stub), `sendAdminAlert`, `isAdmin(uid)`, `rateLimit(key, max, windowMs)`, `escapeHtml(value)`, and a strict `isValidEmail`.
- Per-victim, per-actor, and global caps on reset requests and recovery requests; per-actor and throttled-breach caps on admin link minting; a throttled `recovery_request` alert; a 50-recipient fan-out cap on alerts. Denied attempts do not persist, so a sustained flood cannot lock out legitimate callers.
- All callables return generic success for enumeration-sensitive outcomes and never echo whether an account exists. Malformed input throws `invalid-argument`.
- `targetUid` resolution uses `getAuth().getUserByEmail`; a missing auth user is reported, never created.
- All privileged writes happen with the Admin SDK; no client write path to recovery, alert, audit, or config nodes.
- No existing function or backend exists, so there is no caller refactor beyond the client wrappers described above.

---

## Frontend and UI requirements

- `AuthComponent` (`src/app/components/auth/`):
  - Google button, "or" divider, email and password fields, primary sign in.
  - Prominent "Forgot password?" and "Trouble getting in? Request account recovery".
  - Enumeration-safe info banner and extended error mapping.
  - New test ids: `auth-google`, `auth-forgot`, `auth-recovery-open`, `auth-reset-info`.
- `AuthActionComponent` at `/auth/action`:
  - States: invalid link, new password form, success, expired or used code.
  - Test ids: `auth-action-form`, `auth-action-password`, `auth-action-submit`, `auth-action-error`, `auth-action-success`, `auth-action-resend`.
- `RecoveryRequestComponent` dialog:
  - Test ids: `recovery-email`, `recovery-name`, `recovery-alt-contact` (optional, labelled "Email or phone, optional"), `recovery-message`, `recovery-submit`, `recovery-confirmation`.
- `user-view` account card: "Connect Google" row with test id `account-connect-google`.
- `AdminRecoveryComponent` at `/admin/recovery`:
  - Test ids: `admin-recovery-list`, `admin-recovery-generate`, `admin-recovery-link`, `admin-recovery-copy`, `admin-recipients`, `admin-recipient-add`, `admin-audit-list`.
- Every async action disables its control while pending and restores it on error.
- All user-facing copy is plain American English, no jargon, and names what the user should do next.

---

## Production risks and mitigations

| Risk | Mitigation |
|---|---|
| Reset mail still lands in spam | Dedicated authenticated subdomain, SPF, DKIM 2048, staged DMARC, mail-tester and seed-inbox acceptance test, monitored reply-to |
| Google OAuth consent left in testing mode | Publish the consent screen; listed as a prerequisite |
| Admin-assisted reset becomes an account-takeover path | Admin-only callable, RTDB role check, mandatory reason, per-actor rate limit, open-status transaction, link target must match the request email, immutable audit entry, App Check recommended |
| HTML phishing injected into admin alert emails | Alert email bodies are escaped text only; unauthenticated `name`, `email`, and `message` are never interpolated into HTML |
| Alert email delivery fails silently | `emailStatus` and `emailError` are recorded durably; retry and a failed-alert admin view are deferred by decision (see Open questions) |
| Reset code consumed by an email security scanner | In-app handler shows a clear expired or used state and offers a fresh link; the email includes an expiry note |
| v2 RTDB trigger does not fire in the emulator | Resolved: the WP1 spike proved v2 `onValueCreated` fires in the emulator, so v2 is used |
| Enumeration leak through differing responses | Every reset and recovery branch returns the same generic success; covered by tests |
| Function cold start makes the reset button feel broken | Keep the client `sendPasswordResetEmail` fallback and show a pending state |
| Secrets committed | `RESEND_API_KEY` stored with `firebase functions:secrets:set`; dry-run in the emulator |
| Deploy accidentally overwrites database or storage rules | `scripts/deploy.sh` continues to deploy only hosting plus functions, never database or storage rules. Applying rules is a deliberate manual step |
| `database.rules.json` is wrong or too permissive | The file must be the complete current rules plus the additions, diffed against the console before wiring; the emulator gate runs every existing spec against it, so an over-permissive or broken rule set is caught before prod |
| Recovery data readable by normal users | Rules restrict read to admins; now enforced in the emulator and asserted by a security spec |
| `users/{uid}` orphaned by the old workaround | Recovery mints a link for the existing account. A missing auth user is reported cleanly and never recreated; the delete-and-reregister playbook is retired |

---

## Rollout plan

This is one branch, `feat/account-recovery`, delivered as ordered, reviewable commits.

1. Step 0 spike: DONE. v2 RTDB triggers fire in the Functions emulator, so v2 `onValueCreated` is used.
2. Functions scaffolding, `firebase.json`, `gate.sh`, and `deploy.sh` changes. `deploy.sh` must move `tag_build` after a successful deploy so a failed first functions deploy does not leave an orphan tag. The undocumented `health` callable is removed before rollout.
3. `requestPasswordReset` plus the emulator `outboundEmails` stub, global rate window, and strict email validation.
4. `/auth/action` route, component, and `AuthService` wrappers.
5. Login UI changes and extended error mapping.
6. Resend integration and DNS and console runbook execution (external).
7. Google provider, client sign-in, and account linking.
8. Alert core, `submitRecoveryRequest`, and recovery dialog.
9. Admin recovery tooling, recipients management, and audit.
10. Export current RTDB rules from the console, merge the new-node rules into `database.rules.json`, diff, then wire into `firebase.json` and the emulator.
11. Apply the reviewed rules to dev and prod manually. Never via the deploy script.
12. Full `npm run e2e:gate` green on all three browsers.
13. Deliverability acceptance test recorded, then deploy.

Deploy mechanics: `scripts/deploy.sh` builds, gates, deploys, then tags, running `firebase deploy --only hosting,functions`. The `validate_bundle_config` step is unchanged. Database and storage rules are still never deployed automatically. The first functions deploy must be preceded by setting `RESEND_API_KEY` in Secret Manager and confirming Blaze; a failure there is surfaced before tagging.

---

## Test plan

All specs import `test` and `expect` from `e2e/helpers/fixture.ts` and use only deterministic waits. `retries` stays 0. No `test.skip`. Mutated state is restored. The Auth emulator provides one-time codes via `GET http://localhost:9099/emulator/v1/projects/lecoursville-dev/oobCodes`; the function's emulator mode provides `outboundEmails`.

Because the emulator now enforces `database.rules.json`, the seed and any spec that reads server-only nodes (`outboundEmails`, `recoveryRequests`, `adminAlerts`, `recoveryAudit`, `rateLimits`) use the Firebase Admin SDK through `createRequire`/`require` pointing at `functions/node_modules/firebase-admin`, which bypasses rules. The Admin SDK picks up the emulator hosts from the environment that `firebase emulators:exec` sets. Client reads of those nodes are denied by design and are themselves asserted in the security spec.

### `e2e/specs/account-recovery.spec.ts` (new)

1. Login page shows the Google button, "Forgot password?", and "Trouble getting in?" affordances, each reachable by role and test id.
2. Forgot password with a seeded email creates one `outboundEmails` record of kind `password_reset` containing an `oobCode`, and shows the generic info banner. The Auth emulator ignores `handleCodeInApp` and mints its own action link, so the spec asserts the `oobCode` and rebuilds the app's `/auth/action` URL from it; it cannot assert an `/auth/action` link in the email itself.
3. Forgot password with an unknown email shows the same generic banner and creates no `outboundEmails` record.
4. Reset happy path: from the `outboundEmails` link, open `/auth/action?mode=resetPassword&oobCode=...`, assert the form, submit a new password, assert success, then sign in with the new password and land on the promoted route.
5. Reset with an invalid or expired code shows `auth-action-error` and a working `auth-action-resend` control, with a clean console.
6. Reset code reuse: completing once and replaying the same code shows the invalid state.
7. Expired-state resend: from the expired state, requesting a new link creates a fresh `outboundEmails` record and the new code completes a reset.
8. Recovery request: open the dialog, fill required fields, submit, assert the confirmation, and assert one `recoveryRequests` record plus one `adminAlerts` record plus the alert `outboundEmails` records to the configured recipients.
9. Recovery validation: submitting with missing required fields (email, name) shows field errors and writes nothing. Submitting with only email and name and no alternate contact succeeds, writes a request, and the admin row is flagged "no alternate contact".
10. Admin recovery: sign in as `admin@e2e.local`, open `/admin/recovery`, see the request, generate a link, assert the link is displayed, assert the alternate-address `outboundEmails` record, assert the request becomes `resolved`, and assert a `recoveryAudit` entry. Copy-to-clipboard is asserted only in the Chromium project; Playwright clipboard permissions are unavailable in WebKit and Firefox, so those two assert the link is visible and selectable instead.
11. Admin recipients: add a recipient, assert the config node and an audit entry, trigger an alert, and assert the new recipient received it; then remove the recipient and restore the seed state.

### `e2e/specs/auth.spec.ts` (extend)

1. Google button is present and labelled; clicking it surfaces the mapped error when the popup is blocked (intercept the popup path). The real OAuth consent, redirect, and account-exists flows cannot run against the Auth emulator and are covered by the manual smoke instead.
2. Account card for a signed-in email/password user shows "Connect Google" (`account-connect-google`).
3. Existing tests remain green, including the cached-session interstitial and the admin guard negative case.

### `e2e/specs/security.spec.ts` (extend)

1. No enumeration: reset and recovery responses for known and unknown emails are byte-identical in the UI.
2. Unauthenticated users cannot read `recoveryRequests` or `adminAlerts` through the RTDB SDK.
3. A non-admin signed-in user cannot reach `/admin/recovery` and cannot invoke `adminGenerateResetLink`.
4. Recovery request rate limit returns the generic confirmation after the cap but writes no further records.
5. Tampered callable input, such as missing email or oversized message, is rejected without an unhandled error.

### `functions/src/*.spec.ts` (unit, new)

1. `requestPasswordReset` returns `{ ok: true }` for known and unknown emails, sends only for known, and writes `outboundEmails` in dry-run.
2. Rate limit blocks the sixth request in the window and still returns generic success.
3. `submitRecoveryRequest` succeeds without an alternate contact, writes both nodes on success, and is enumeration-safe.
4. `adminGenerateResetLink` rejects unauthenticated and non-admin callers, rejects a payload email that does not match the request record, refuses an already-handled request, and mints a link for admins and writes an audit entry.
5. `adminGenerateResetLink` on a missing auth user writes a failed audit entry and throws not-found without creating an account.
6. `isAdmin` reads the RTDB role correctly and treats missing records as non-admin.
7. `escapeHtml` neutralizes markup, and the alert email body contains no raw unauthenticated input.
8. Rate limits: the per-victim and global reset windows and the per-actor admin mint cap block as expected. These are unit-only because the time windows are not waitable in e2e.
9. Malformed input to any callable throws `invalid-argument`.

### `src/app/**/*.spec.ts` (unit, extend)

1. `mapAuthError` returns the intended copy for every new code.
2. `AuthActionComponent` parses `mode` and `oobCode`, handles missing params, and calls verify and confirm with the right arguments.

---

## Summary of changes (sign-off checklist)

- [ ] `functions/` TypeScript codebase with five callables and one trigger; the temporary `health` callable is removed.
- [ ] `requestPasswordReset` sends reset mail from `auth.lecoursville.com` through Resend with an in-app action link.
- [ ] `/auth/action` route and `AuthActionComponent` handle verify, confirm, expired, and used codes.
- [ ] Login page has a Google button, an upgraded "Forgot password?", and a "Trouble getting in?" recovery entry, all accessible.
- [ ] Google sign-in enabled, wired, with account linking on the account card.
- [ ] Recovery request dialog writes `recoveryRequests` and `adminAlerts` through a callable, with an optional email-or-phone alternate contact that is never required and never collected at signup.
- [ ] Generic alert core emails a configurable recipient list, with an empty-list fallback to admins.
- [ ] Admin `/admin/recovery` page lists requests, mints links, emails the alternate contact, manages recipients, and shows the audit trail.
- [ ] The delete-and-reregister workaround is removed from the playbook.
- [ ] `firebase.json`, `scripts/e2e/gate.sh`, and `scripts/deploy.sh` include functions without deploying rules.
- [ ] `database.rules.json` is the complete current rules plus the new-node rules, wired into `firebase.json` and enforced by the emulator, reviewed via before/after diff, and applied to dev and prod manually.
- [ ] Existing-rule hardening is in place: `.val() === true` role checks, `users` read requires auth, self-write cannot self-promote, PII reads require auth, `calendars.write` is admin, and the missing `photoAlbums`/`families`/`userUploads` nodes exist.
- [ ] `UserUploadService.allUploads$` is lazy so anonymous upload pages do not read the admin-only `userUploads` node.
- [ ] DNS and console runbook executed and the deliverability acceptance test passed and recorded.
- [ ] New and extended specs pass on Chromium, WebKit, and Firefox with a clean console, `retries` 0.
- [ ] `npm run e2e:gate` green before deploy, with human sign-off.

---

## Verification steps

1. `npm --prefix functions run build` succeeds.
2. `npm --prefix functions test` passes.
3. `npm run e2e:gate` passes on all three browser projects.
4. Manual deliverability acceptance: mail-tester 9/10 or better, SPF, DKIM, and DMARC all pass, and reset mail lands in the inbox on seed Gmail, Outlook, and Yahoo accounts.
5. Manual production smoke on `lecoursville.com`: request a reset, open the email, complete `/auth/action`, sign in with the new password.
6. Manual Google smoke: sign in with Google on a non-test account, then connect Google from the account card of an email/password account and sign in with Google.
7. Manual admin smoke: submit a recovery request as a normal user, confirm the admin alert email arrives, generate a link, confirm the alternate-address email, and confirm the audit entry.
8. The rules-enforced denial of an unauthenticated read of `recoveryRequests` is asserted by `e2e/specs/security.spec.ts` inside the gate.

---

## Open questions

1. The current RTDB rules must be exported from the Firebase console before `database.rules.json` can be completed and wired into the emulator. See Prerequisites item 7 and C5.
2. Deferred by decision: alert retry with backoff, a failed-alert admin view with a resend action, and retention cleanup for `outboundEmails` (which holds expired reset links), `rateLimits`, and resolved or closed recovery requests. Revisit as a follow-up spec.
3. Confirm DNS access for `lecoursville.com` and that the Resend sending subdomain is `auth.lecoursville.com`.
4. Confirm the OAuth consent screen can be published, or Google sign-in will be limited to test users.
5. Confirm the Firebase projects are on Blaze before implementation begins.
6. Decide whether to keep the client `sendPasswordResetEmail` fallback permanently or remove it after the function proves reliable. Recommendation: keep it.
