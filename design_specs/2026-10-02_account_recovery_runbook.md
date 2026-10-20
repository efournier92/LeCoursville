# Account Recovery Runbook

Operational checklist for the account-recovery feature on branch `feat/account-recovery`.

This runbook covers only the non-code work that cannot be done from the repository: console settings, DNS, billing, secrets, deploys, and manual acceptance tests. The code and its tests are complete and the emulator gate is green.

Every step has a done-check. Do not skip a done-check. Mark the box only when it passes.

---

## Damage report: why step 1 is urgent

The exported production database rules contained a live privilege escalation.

- Every role check used `.exists()`, which is true for a stored `false`. Every app-created user has `roles.admin: false`, so every user passed the admin and super checks.
- A signed-in user could write their own `users/{uid}` record and set `roles.super: true`.
- `users` and `people` and `addresses` were readable without authentication, exposing emails, names, roles, and family contact data.

Step 1 fixes all of these. Nothing else in this runbook is security-urgent.

---

## Sequence and dependencies

| Order | Step | Depends on |
|---|---|---|
| 1 | Lock down database rules (dev, then prod) | none |
| 2 | Confirm Blaze plan | none |
| 3 | Resend account, sending domain, API key secret | none |
| 4 | DNS authentication (SPF, DKIM, DMARC) | step 3 |
| 5 | Firebase Auth settings (authorized domains, email enumeration, custom domain) | none |
| 6 | Google sign-in and OAuth consent | none |
| 7 | Deploy functions | steps 2, 3 |
| 8 | Deploy hosting | step 7 |
| 9 | Deliverability acceptance test | steps 4, 7, 8 |
| 10 | Production smoke tests | steps 1, 6, 8 |

Steps 1 and 2 can run immediately in parallel. Steps 5 and 6 can run any time.

---

## Step 0: Preflight

Gather these before starting. Fill in the blanks.

- Firebase project IDs: `lecoursville-dev` (test) and `lecoursville` (prod).
- Firebase console access to both projects.
- Google Cloud console access for the project that owns the OAuth consent screen.
- DNS access for `lecoursville.com` at the registrar or DNS host.
- Local `firebase` CLI logged in: run `firebase login` and `firebase projects:list`.
- Java for the emulator is only needed for local runs, not for these console steps.

Done-check: `firebase projects:list` shows both projects and your account is an Owner or Editor.

---

## Step 1: Lock down database rules

The reviewed rules are in `database.rules.json` at the repo root, and the emulator gate enforces them.

### 1a. Export and diff the current prod rules

1. Firebase console, `lecoursville`, Realtime Database, Rules tab.
2. Copy the current rules somewhere local as `prod-rules-before.json`.
3. Diff against the committed file to confirm nothing prod-only is about to be lost:

```bash
diff prod-rules-before.json /Users/e/mnt/bnk/cs/lecoursville/database.rules.json
```

The expected differences are exactly the hardening and new nodes described in the damage report and the spec C5 section. Any other difference is a red flag; stop and reconcile before applying.

### 1b. Apply to dev first

```bash
firebase use lecoursville-dev
firebase deploy --only database
```

`scripts/deploy.sh` deliberately never targets `database`, so this is the only path that touches rules. It is safe because it only affects the selected project.

Done-check for dev: in the console Rules tab for `lecoursville-dev`, the `users` node shows `".read": "auth != null"` and role checks use `.val() === true`.

### 1c. Smoke test dev

1. Open the dev site and sign in as a normal user.
2. Confirm the app loads, contacts and people pages render, and the account page works.
3. Sign in as an admin and open `/admin`, `/admin/users`, and `/admin/calendar`. Confirm they load.
4. In a private window, with no sign-in, confirm `https://<dev-db-host>/users.json?ns=lecoursville-dev-default-rtdb` returns `Permission denied` (401), not data.

Done-check: all four pass. If the calendar admin UI now works for a non-super admin, that is the intended fix, not a regression.

### 1d. Apply to prod

Repeat 1a for `lecoursville` if the diff differs from dev, then:

```bash
firebase use lecoursville
firebase deploy --only database
```

Done-check for prod: a signed-in normal user still loads the site, an unauthenticated `users` read is denied, and an admin can open the admin pages.

Rollback: the console keeps a rules history. You can restore the previous rules from the Rules tab if a prod flow breaks.

---

## Step 2: Confirm Blaze plan

Cloud Functions with outbound network, and the Resend send path, require Blaze.

1. Firebase console, project settings, Usage and billing.
2. Confirm both `lecoursville` and `lecoursville-dev` are on Blaze.
3. Set a budget alert in Google Cloud Billing for a small amount, for example 5 USD per month. Expected spend at this scale is near zero, but the alert is the safety net.

Done-check: both projects show Blaze, and a budget alert exists.

---

## Step 3: Resend account, sending domain, and secret

1. Create or sign in to a Resend account.
2. Add the sending domain `auth.lecoursville.com`. Do not add the apex `lecoursville.com`. The From address is `no-reply@auth.lecoursville.com`, set in `functions/src/config.ts` (`FROM_ADDRESS`, `ALERTS_FROM`). In the Add Domain form:
   - Domain: `auth.lecoursville.com`
   - Tracking subdomain: leave blank. It is optional, accepts a single label only (letters, digits, hyphens, no dots), and click/open tracking should stay off for transactional reset mail.
   - Region: choose the one closest to your users.
   Resend shows the exact DNS records in step 4. Resend delivers SPF as CNAMEs pointing at `*.forge.rmta.net`; that is Resend infrastructure, not a stray record.
3. Create an API key with send permission, plus a separate key for dev.
4. Store each key as a Firebase Functions secret. The value is entered at a hidden prompt, never passed on the command line. Use `--project` so `.firebaserc` is not rewritten:

```bash
firebase functions:secrets:set RESEND_API_KEY --project lecoursville
firebase functions:secrets:set RESEND_API_KEY --project lecoursville-dev
```

Done-check: `firebase functions:secrets:get RESEND_API_KEY --project <id>` under each project shows a version in state `ENABLED`. (Recent CLIs have no `functions:secrets:list`; `functions:secrets:get` returns metadata only, never the value.) The key is never written to the repo.

---

## Step 4: DNS authentication

Add these records at your DNS host for `lecoursville.com`. In this setup the domain is registered and hosted at GoDaddy (nameservers `ns03.domaincontrol.com` and `ns04.domaincontrol.com`), so add them there. Use the exact values Resend shows on the domain's Records tab; the shapes below are what Resend generated on 2026-10-10 and are for orientation only.

Resend's current model delivers SPF through CNAMEs and DKIM through a TXT record:

1. SPF, as two CNAME records. Resend delegates SPF to `*.forge.rmta.net`, which is Resend infrastructure:

```text
CNAME  rsend.auth  ->  rsend.forge.rmta.net
CNAME  send.auth   ->  send.forge.rmta.net
```

`rsend.forge.rmta.net` carries `v=spf1 include:amazonses.com ~all`. Do not create a TXT SPF record on `auth.lecoursville.com`; the CNAMEs are the SPF.

2. DKIM, a TXT record (not a CNAME) at `resend._domainkey.auth`:

```text
TXT  resend._domainkey.auth  ->  p=<public key Resend provides>
```

Confirm the key is 2048-bit in the Resend dashboard.

3. DMARC at `_dmarc.lecoursville.com`. Resend's own record is minimal:

```text
v=DMARC1; p=none;
```

To actually receive aggregate reports, extend it to `v=DMARC1; p=none; rua=mailto:dmarc@lecoursville.com; fo=1` and make sure that mailbox is monitored. Skipping the `rua` is safe for launch.

After SPF and DKIM pass for all senders, move to `p=quarantine`, then later `p=reject`.

4. In Resend, click Verify on the domain. It must show verified. A status of "not started" means Resend has not run the check yet, not that the records are missing; if it stalls, use "Restart verification". Verified on 2026-10-10.

5. Optional but recommended: set the Firebase Auth custom email domain to `lecoursville.com` (Authentication, Templates, Custom domain). This aligns Firebase's own verification and fallback emails. It does not give DKIM control, which is why the reset email goes through Resend.

DNS host notes (GoDaddy): enter host labels without the `.lecoursville.com` suffix, since GoDaddy appends it (`send.auth`, not `send.auth.lecoursville.com`). TTL options are presets; 1/2 Hour is fine and does not affect verification. If Resend lists an MX (Return-Path) record, set its priority to 10; some domains omit it, in which case add nothing.

Done-check: Resend shows the domain and DKIM as verified, and the records resolve:

```bash
dig +short CNAME send.auth.lecoursville.com
dig +short TXT resend._domainkey.auth.lecoursville.com
dig +short TXT _dmarc.lecoursville.com
```

---

## Step 5: Firebase Auth settings

For both projects, unless noted.

1. Authentication, Settings, Authorized domains: confirm `lecoursville.com` and `lecoursville.firebaseapp.com` are present. Add `localhost` for **dev only**. Remove `localhost` from **prod**: Firebase adds it by default, and it authorizes OAuth redirect and action-link flows against the production project.
2. Authentication, Settings, User account management, User actions: confirm Email enumeration protection is ON. It is the default for projects created on or after 2023-09-15. On `lecoursville` (2026-10-10) the console would not expose the User actions panel until an upgrade was opted into; it appeared to be the project-level Identity Platform opt-in. No cost was observed at this volume, and the Identity Platform docs state no upgrade, billing, or fee requirement. [Confirm the exact upgrade name if it ever matters.]
3. Authentication, Templates: set the sender display name to `LeCoursville` and the Reply-to to `eric@lecoursville.com` on each template you use (Email address verification, Password reset, Email address change).
   - Reply-to is **per template**, not project-wide (Identity Platform `Config` carries one `replyTo` per template object), so set it on every template, not just one.
   - Reply-to needs **no DNS verification** - type the address in. It must simply be able to receive mail (see step 5a).
   - The From address on these templates stays `noreply@<project>.firebaseapp.com` unless you also set the custom email domain (step 4.5). That custom domain needs its own TXT and CNAME records, separate from Resend's `auth.lecoursville.com`.

Done-check: the authorized-domains list includes the production domain and no `localhost` in prod; enumeration protection reads as enabled.

### Step 5a: Create `eric@lecoursville.com` as a real reply-to

`auth.lecoursville.com` is verified in Resend for outbound. The reply-to is a separate identity and must be able to receive.

1. The apex `lecoursville.com` currently has **no MX records**, so it receives no mail. Set up receiving at the DNS host (GoDaddy), then create the address:
   - GoDaddy email forwarding (free): Domain, Email Forwarding, create `eric@lecoursville.com` forwarding to a mailbox you actually read. GoDaddy adds MX records for the apex.
   - Or a paid mailbox (GoDaddy/Microsoft 365 or Google Workspace) if you want to reply as the address.
2. Watch for a **second SPF record** on the apex. The apex already has `v=spf1 include:_spf.firebasemail.com ~all`. If enabling forwarding adds another TXT SPF, merge them into one; more than one SPF record per host is invalid.
3. Expose it in code: `functions/src/config.ts` line 16, `REPLY_TO`, is set to `eric@lecoursville.com` (changed from `support@lecoursville.com` on 2026-10-10). It takes effect on the step 7 functions deploy. `functions/src/helpers.ts` sends it as `replyTo`.
4. Use the same `eric@lecoursville.com` in the Firebase Auth template Reply-to fields (step 5.3) so both email paths agree.

Done-check: `dig +short MX lecoursville.com` returns a forwarder host, a test message to `eric@lecoursville.com` reaches your inbox, and `REPLY_TO` in `config.ts` reads `eric@lecoursville.com`.

### Step 5b: Web App Check (logging-only, web) — REMINDER, not yet implemented

**Status 2026-10-10: deferred (C-13). Implement on the latest `feat/account-recovery` tree, then re-test.** Bots can drive the expensive pre-auth callables (`requestPasswordReset`, `submitRecoveryRequest`) with no App Check. The decision is logging-only first, enforce later.

1. Firebase console, App Check: register the **web app** for each project (`lecoursville`, `lecoursville-dev`) with **reCAPTCHA Enterprise** (or reCAPTCHA v3). Copy the public site key.
2. Client: in `src/app/services/firebase.service.ts` (or app bootstrap) call `initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true })`. Read `siteKey` from `src/environments` (untracked) so it is per-project, and **skip `initializeAppCheck` when running against the emulators** so the Playwright gate is unaffected.
3. Logging-only: do **not** set `enforceAppCheck: true` on the callables yet, and leave Functions enforcement **Unenforced** in the console. Confirm tokens appear under App Check metrics and the Functions unverified-request view.
4. Enforce later, only after token coverage is confirmed: set `enforceAppCheck: true` on `requestPasswordReset` and `submitRecoveryRequest`, then flip the console to enforced.
5. Test on the latest tree: `npm --prefix functions test` and `npm run e2e:gate` must stay green (the emulator path skips App Check).

Done-check: App Check metrics show tokens for the web app, both pre-auth callables still answer under enforcement, and the gate is green.

---

## Step 6: Google sign-in

1. Firebase console, Authentication, Sign-in method: enable Google. Copy the web client ID shown.
2. Google Cloud console, Google Auth Platform (the renamed OAuth consent screen):
   - Branding page (https://console.developers.google.com/auth/branding): set the app name. Add the Authorized domain `lecoursville.com` only. Google wants the Top Private Domain, entered once; all its subdomains are then covered. Do not add `lecoursville.firebaseapp.com`; you do not own `firebaseapp.com`, so it cannot be an authorized domain. Add the domain before any redirect, origin, homepage, or privacy URLs.
   - User support email must be a Google account: the signed-in user's address, a Google Group, or a non-Gmail address registered as a Google account and made a project editor or owner. `eric@lecoursville.com` is not selectable unless it is a Google Workspace account.
   - Developer contact information: Google sends project notices here; it must be deliverable. Leave the Gmail until `eric@` can receive.
   - Data Access page: add the `.../auth/userinfo.email` and `.../auth/userinfo.profile` scopes (the defaults).
   - Audience page: set the publishing status. If it stays in Testing, only listed test users can sign in.
3. Dev project (`lecoursville-dev`): Google OAuth config was intentionally SKIPPED on 2026-10-10. Only `lecoursville` (prod) has a Google Auth Platform consent screen and the Google provider configured. Rationale: dev is a separate Cloud project needing its own consent screen and authorized domains; the e2e gate cannot exercise real Google OAuth anyway (it stubs auth); and step 10 smoke-tests Google on prod only. Consequence: the Google button on the dev site errors if clicked; password sign-in works. Revisit only if a dev-time Google flow is needed; then repeat step 6 against `lecoursville-dev` and add its domains (`localhost`, the dev hosting domain) to authorized domains.

Done-check: the Audience page shows the app in production, and the Google provider shows Enabled in both projects where intended.

Note: existing email and password users will see "An account already exists for this email" if they try Google first. That is expected. They sign in with their password, then connect Google from the account page. This is the account-linking flow.

---

## Step 7: Deploy functions

1. Confirm the secret from step 3 exists for the target project.
2. Build and deploy functions only for dev first. Use `--project` so `.firebaserc` is not rewritten:

```bash
npm --prefix functions run build
firebase deploy --only functions --project lecoursville-dev
```

The first functions deploy can take 5 to 15 minutes, and may prompt to enable Cloud APIs (Artifact Registry, Cloud Build, Eventarc, Pub/Sub) and to upgrade billing if Blaze is not active.

3. Watch for these functions to appear:
   - `requestPasswordReset`, `submitRecoveryRequest`, `adminGenerateResetLink`, `closeRecoveryRequest`, `updateAlertRecipients` (callable)
   - `onAdminAlertCreated` (database trigger)

Done-check: the deploy lists the five callables plus the trigger with status successful. Verify with `firebase functions:list --project lecoursville-dev`. If it fails on a missing secret, redo step 3 for that project and retry.

### Step 7 troubleshooting

- `npm error Missing: <pkg> from lock file` in the Cloud Build stage: `functions/package-lock.json` is out of sync with `functions/package.json`. `npm ci` enforces an exact lock, unlike a local `npm run build`, which reuses existing `node_modules`. Fix: run `npm --prefix functions install`, confirm `npm --prefix functions ci --dry-run` exits 0, then redeploy. Commit the refreshed lockfile. Hit 2026-10-10.
- `Permission denied while using the Eventarc Service Agent` on `onAdminAlertCreated`: first-use 2nd-gen database trigger. The Eventarc service agent roles take a few minutes to propagate. Wait about five minutes and rerun the deploy; already-created functions are skipped. Hit 2026-10-10.

---

## Step 8: Deploy hosting

`scripts/deploy.sh prod` runs the full gate, builds prod, deploys hosting and functions, and then tags. It also requires the deploy sign-off.

1. Ensure `RESEND_API_KEY` exists for `lecoursville` and Blaze is active.
2. From `master` (or merge the feature branch first), run:

```bash
E2E_APPROVED=1 npm run deploy:prod
```

Interactive shells instead type `deploy` at the sign-off prompt.

Done-check: the deploy completes and the new bundle is served on `lecoursville.com`. The account page shows a "Connect Google" row, and the login page shows the Google button and both reset affordances.

Rollback: Firebase Hosting keeps release history. Use the console to roll back the hosting release, and `firebase functions:delete` a function if a bad one must be removed.

---

## Step 9: Deliverability acceptance test

Run this after steps 4, 7, and 8. Record the results in the PR description or the deploy log.

1. On `lecoursville.com`, request a password reset for a real mailbox you control.
2. Confirm the email arrives in the inbox, not spam, and that the From domain is `auth.lecoursville.com`.
3. Send one test message to `mail-tester.com` using the same sending path. Score must be 9/10 or better with SPF, DKIM, and DMARC all passing.
4. Repeat the reset to a Gmail, an Outlook, and a Yahoo seed inbox. All three must land in the inbox and complete the reset.
5. Open one reset link on a different device than the one that requested it. Confirm the password reset succeeds.

Done-check: all five pass. If any inbox lands in spam, stop and fix DNS or sender reputation before calling deliverability done.

---

## Step 10: Production smoke tests

1. Reset smoke: request a reset, complete it, sign in with the new password.
2. Google smoke: sign in with Google, then connect Google from the account page of an email and password account and sign in with Google.
3. Admin recovery smoke: submit a recovery request as a normal user, confirm the admin alert email arrives, open `/admin/recovery`, generate a link, confirm the alternate-contact email and the audit entry, then close the request.
4. Rate-limit check: request more than five resets for one address in an hour and confirm the UI still shows the generic success while no further email is sent. Each layer keeps a single key under `rateLimits/<kind>/{hash}` holding `{ windowStart, count, previous }` for the weighted sliding window: per-email and per-actor (`resetRequestsIp`, `recoveryRequestsIp`) plus `resetRequestsGlobal/global` and `recoveryRequestsGlobal/global`. Denied attempts do not persist, so a sustained flood cannot extend a window and lock out legitimate callers.
5. Delete-hostile path: submit a recovery request with no alternate contact and confirm the admin row is flagged "no alternate contact".

Done-check: all five pass.

---

## What the automated gate already proves

These are covered by `npm run e2e:gate` and do not need manual repetition, except where listed in step 9 and 10.

- Reset happy path, invalid code, reused code, and expired-state re-request.
- Recovery request creation, validation, and the no-alternate-contact path.
- Admin link generation, alternate email, resolution, and audit.
- Recipient add and remove, and alert fan-out.
- No enumeration, unauthenticated rule denial, and non-admin denial.

## Known residual risks

- Deliverability ultimately depends on domain reputation, which builds over time. The DMARC record currently sets no `rua`; if you add one, keep that mailbox monitored.
- Alert retry, a failed-alert admin view, and retention cleanup were explicitly deferred. Until then, a failed alert is visible only as `emailStatus: "failed"` in the `adminAlerts` node.
- Real Google OAuth cannot be exercised by the emulator gate; step 10 covers it manually.

## Follow-ups: Firebase Auth email templates

The Firebase Auth templates are inert today. The app calls neither `sendEmailVerification` nor any `emailVerified` check, so nothing sends them. Setting their From or Reply-to now is harmless but has no user-visible effect yet.

When a template is actually consumed, author real content for it (subject, body, action text, and the Reply-to from step 5.3):

- **Email address verification**: not sent. Add content only if email verification is turned on as a deliberate feature.
- **Password reset**: sent only as the fallback path in `AuthService.sendPasswordReset` when the Resend callable is unavailable. The primary reset email comes from Resend and is templated in the functions, not here.
- **Email address change**: not used.

Do not rely on the default Firebase placeholder copy for any template that becomes live; it ships unbranded and generic.

## Follow-up: user-facing references to update once `eric@lecoursville.com` exists

Set up receiving first (step 5a). Until the apex has MX, the address cannot receive, so a reply-to pointing at it is a dead end. Then sweep these:

- `src/app/errors.service.ts:90` - in-app error copy hard-codes `efournier92@gmail.com` ("please contact Eric at ..."). Point it at `eric@lecoursville.com`. This is user-facing, so it needs Playwright coverage per the repo rule.
- `README.md:99` - contributor contact uses the personal Gmail. Update for consistency.
- `design_specs/2026-10-02_account_recovery.md:176-177` - the source spec still names `support@lecoursville.com` as the Reply-To example. Align it with `config.ts`.
- `functions/src/config.ts` `REPLY_TO` and the Firebase Auth template Reply-to (step 5.3) already read `eric@lecoursville.com`. Confirm only; no change expected.
- OAuth consent screen: the User support email is limited to Google accounts, so `eric@` will not be selectable unless it is a Google Workspace account. Leave the Gmail there unless you adopt Workspace.
- Re-sweep for stragglers: `grep -rn "efournier92@gmail.com\|support@lecoursville.com" src README.md design_specs`.
