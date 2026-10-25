# Eric Email Setup (Zoho Free)

- Date: 2026-10-25
- Revision: v3, after `docs/critique/2026-10-25_EricEmailFreeZoho.md`
- Owner decisions recorded: keep a permanent low-privilege canary account, enforce DMARC with a gated flip instead of a 90-day wait, catch-all off, and accept the monthly sign-in chore
- Goal: `eric@lecoursville.com` works for send and receive at zero cost
- Domain: `lecoursville.com`
- DNS host: GoDaddy, nameservers `ns03.domaincontrol.com` and `ns04.domaincontrol.com`
- Mailbox provider: Zoho Mail, Forever Free Plan, one custom domain
- Supersedes the free-path appendix in `2026-10-24_eric_email_gmail_setup.md` and step 5a of `2026-10-02_account_recovery_runbook.md`

## Status On 2026-10-25

- Done and verified: Z1 account, Z3 domain verified, Z4 MX, Z5 SPF, Z6 DKIM, Z7 allowlist, Z8 mailboxes and catch-all off, Z9 inbound, Z10 outbound with SPF, DKIM and DMARC all passing.
- Not started or unconfirmed: Z2 admin 2FA, Z11 owner alert, Z12 mobile push, Z13 reminder, Z15 code straggler, Z16 DMARC quarantine.
- Z11 is blocked: `onAccountCreated` is not deployed anywhere, and the dev deployment predates the code. See `docs/2026-10-25_LeCoursville_Email_Configuration.md`.
- Recurring routine, failure triage, and the automated check live in `docs/2026-10-25_LeCoursville_Email_Maintenance.md` and `scripts/email-healthcheck.sh`.

## Driver Prompt

Paste this to the next agent:

Read /Users/e/mnt/bnk/cs/lecoursville/design_specs/2026-10-25_eric_email_free_zoho_setup.md and drive it interactively. Present one step at a time, wait for done, skip, or stop, record each result, do not run HUMAN steps, and never ask for or echo a password, app password, API key, SMS code, or recovery code.

## What This Cannot Do

- No IMAP, POP, ActiveSync, or forwarding on Free, so reading and sending happen in Zoho webmail or the Zoho mobile app only.
- No automatic mirror into a personal Gmail.
- No free alerting if the mailbox goes dark, which is why Part 4 is part of the setup and not optional.
- Zoho is the inbox, not the sender. Do not route app mail out through Zoho, because its usage policy bans automated and transactional sending and Resend already owns that path.
- Free is region-gated and its terms have changed once already. Treat this as a yearly re-check, not a one-time install.

## Known Free-Plan Limits

- 1 custom domain, up to 5 users, 5 GB per user, no file storage.
- 100 recipients per message. Outbound rate is reputation-based, roughly 50 to 500 per hour. Ample for one person.
- Inactivity is the sharp edge. Zoho blocks send and receive during a long idle period and clears the mailbox at 300 days. Z13 exists for this reason.
- Reading happens in Zoho. Install the app on day one, because the owner-alert path depends on someone noticing.

## Current State

Observed with `dig` on 2026-10-25. These are also the rollback baseline, so this section is the snapshot.

- Apex MX: none.
- Apex TXT, three values: `v=spf1 include:_spf.firebasemail.com ~all`, `google-site-verification=IjvsI00TSz3g_pcK2mDkicc4X445ZJsBOyRsvkGlSP8`, `firebase=lecoursville`.
- DMARC at `_dmarc`: `v=DMARC1; p=none;`.
- `google._domainkey`: absent.
- Resend path, do not touch: TXT `resend._domainkey.auth.lecoursville.com` reads `p=MIGf...IDAQAB`, MX `send.auth.lecoursville.com` is `send.forge.rmta.net.` and `10 feedback.forge.rmta.net.`, CNAME `send.auth.lecoursville.com` resolves to `send.forge.rmta.net.`, CNAME `rsend.auth.lecoursville.com` resolves to `rsend.forge.rmta.net.`.
- Code: `functions/src/config.ts:27` `REPLY_TO` and `:30` `OWNER_ALERT_ADDRESS` are both `eric@lecoursville.com`, and the senders are `no-reply@auth.lecoursville.com`.

Records this guide edits: the apex SPF TXT. The apex MX set is empty today and gets added. Everything else is an add, and nothing under `auth` or `send.auth` is touched.

## How To Drive This

- One step per message, one owner per step, record the result, stop on failure.
- Never paste a password, an API key, an SMS code, or a recovery code into chat.
- Copy DNS values from the Zoho console. Regional hostnames differ from the generic ones.

## Part 1: Account

### Z1: Create The Zoho Account

Owner: HUMAN.
Goal: start a free Zoho Mail organization for the domain.
Steps:

1. Open `https://workplace.zoho.com/signup?type=org&plan=free`, which is the entry point Zoho's own pricing page uses for the Forever Free Plan.
2. Fallback URL if that one misbehaves: `https://mail.zoho.com/signup?type=org&plan=free`. It is a JS app and can hang on a spinner, in which case go back to the workplace URL.
3. Confirm the free plan is selected, not a trial that converts to paid. A plan grid with prices and a 15-day trial banner is the paid funnel, so back out.
4. Confirm the **Business Email** radio is selected and **Personal Email** is not. Personal cannot host a custom domain.
5. Do not look for a domain field. This page creates the Zoho account only, and the domain is asked for on the next screen after the OTP.
6. Name: your first name, then the last name field appears.
7. Email Address or Mobile Number: a personal address on a domain you already control, never `eric@lecoursville.com`, which does not exist yet. This becomes the account identity and the recovery contact, which also satisfies the off-domain recovery requirement in Z2.
8. Set a strong password and store it in a password manager.
9. Accept the terms, leave the marketing checkbox alone, then Sign Up and enter the OTP.

Expected: after the OTP you land in the Zoho setup wizard or the admin console, and the domain is not added yet. That is Z3's job.
Record: the data center shown in the console (US, EU, IN, JP, or AU), because it decides the MX hostnames. If no data center is visible yet, record it in Z3 instead.
Failure branch: if the free plan is unavailable for the region, stop and report. Do not enter card details.

### Z2: Lock Down The Admin Account

Owner: HUMAN.
Goal: this account reads owner alerts and can send DKIM-signed mail as `eric@`, so takeover is the top risk.
Steps:

1. In Zoho account security settings, enable two-factor authentication with an authenticator app.
2. Store the recovery codes in the password manager.
3. Set a recovery phone.
4. Set a recovery email on a different domain, since a recovery address on the same domain is useless when the domain is the thing that broke.
5. Sign out and back in to confirm the code is required.

Expected: 2FA shows enabled and sign-in prompts for a code.
Record: enabled, plus which recovery methods were set. Never the codes.

### Z3: Add The Domain And Verify It

Owner: HUMAN.
Goal: prove control of `lecoursville.com`.
Steps:

1. In the admin console, open Domains and add `lecoursville.com`.
2. Copy the verification TXT it displays, shaped `zoho-verification=zb<digits>.zmverify.zoho.<dc>`.
3. In GoDaddy DNS, add a TXT record with name `@` and that value.
4. Keep the existing `google-site-verification` and `firebase` TXT records. Multiple TXT records at `@` are valid.
5. Return to the console and run verification.

Expected: the domain shows as verified.
Record: verified, plus the output of `dig +short TXT lecoursville.com`, which should now hold four values.

### Z4: Point MX At Zoho

Owner: HUMAN.
Goal: route inbound mail into the mailbox.
Steps:

1. In the console, open the email delivery page and copy the MX set for your data center.
2. The generic shape is `mx.zoho.com` at 10, `mx2.zoho.com` at 20, `mx3.zoho.com` at 50.
3. A regional center uses the TLD itself as the suffix, for example `mx.zoho.eu`. Do not invent a two-part suffix like `mx.zoho.eu.com`.
4. In GoDaddy DNS, add all three as separate MX records, name `@`, TTL 1 hour.
5. The apex has no MX today, so nothing needs deleting.

Expected: `dig +short MX lecoursville.com @8.8.8.8` lists the three Zoho hosts with their priorities.
Note: query 8.8.8.8 rather than your default resolver, which can hold a cached empty answer from before the change. A blank result from the local resolver is not evidence of failure.
Record: the dig output.

### Z5: Merge SPF

Owner: HUMAN.
Goal: authorize Zoho to send for the root domain without creating a second SPF record.
Steps:

1. In GoDaddy DNS, edit the existing TXT at `@` that starts with `v=spf1`.
2. Set the value to `v=spf1 include:_spf.firebasemail.com include:zohomail.com ~all`.
3. Use Zoho's own include value if the console asks for something other than `zohomail.com`.
4. Keep exactly one SPF record. Do not add a second `v=spf1` TXT at `@`.

Expected: `dig +short TXT lecoursville.com` shows the merged value and only one `v=spf1` line.
Record: the dig output.

### Z6: Set Up DKIM

Owner: HUMAN.
Goal: sign outbound mail from `lecoursville.com`.
Steps:

1. In the console, open DKIM configuration under Domains.
2. Choose selector `zoho` and generate a 2048-bit key.
3. Copy the published TXT value, which begins `v=DKIM1; k=rsa; p=`.
4. In GoDaddy DNS, add a TXT record with name `zoho._domainkey` and that value. GoDaddy appends the domain, so the name field takes `zoho._domainkey` only.
5. Return to the console and enable authentication.

Expected: `dig +short TXT zoho._domainkey.lecoursville.com` returns the key, and the console reports DKIM as active.
Note: a 2048-bit value is longer than one TXT string, so the registrar stores it as several quoted chunks. That is correct and not truncation. Compare against the console value by joining the chunks with no spaces.
Record: active or pending, plus the dig output.

## Part 2: Receive Path

### Z7: Allowlist The App Sender

Owner: HUMAN.
Goal: the owner alerts must land in the inbox, not in junk.
Steps:

1. In the console, open the spam control or admin allowed list settings.
2. Add the address `no-reply@auth.lecoursville.com` and the domain `auth.lecoursville.com`.
3. Leave the organization spam settings at their defaults. Do not disable filtering for the whole domain.

Expected: both entries are listed.
Note: the allowlist matches the visible From, while Resend signs and bounces under its own subdomain, so still check the junk folder during Z9 and Z11.
Record: the entries added.

### Z8: Confirm The Mailbox, Canary, And Catch-All

Owner: HUMAN.
Goal: only intended addresses accept mail, and delivery has a repeatable target.
Steps:

1. In Users, confirm `eric@lecoursville.com` is active and has a display name.
2. Add a second user, `canary@lecoursville.com`, with no admin role. This is the permanent delivery target for Z11 and the monthly check, so do not delete it later.
3. In Domains, find the catch-all setting and confirm it is off.
4. Confirm exactly two mailboxes exist.

Expected: two active mailboxes, no admin role on `canary@`, and catch-all off.
Note: `canary@` never receives the owner alert. It receives password-reset mail, which is the flow we can re-run on demand. The alert itself is proven once in Z11.
Record: the two addresses and the catch-all state.

## Part 3: Verify

### Z9: Receive From Outside

Owner: HUMAN.
Goal: prove inbound routing works and the message is not filtered.
Steps:

1. From a personal address, send a message to `eric@lecoursville.com`.
2. Confirm it arrives in the Inbox rather than Junk.
3. Open the message source and confirm the sender's own `spf=pass`, `dkim=pass`, and `dmarc=pass`.

Expected: inbox delivery and three passes.
Note: these results authenticate the outside sender, not this domain. Inbound routing is what this step proves.
Record: the folder and the three results.

### Z10: Send Outbound And Authenticate It

Owner: HUMAN.
Goal: prove the send half on its own evidence.
Steps:

1. From Zoho webmail as `eric@lecoursville.com`, send to a personal address.
2. Open that message in the personal inbox and view the original.
3. Confirm `spf=pass`, `dkim=pass` with `d=lecoursville.com`, and `dmarc=pass`.

Expected: three passes on the outbound message.
Note: reading your own inbox in Zoho never proves this. The headers must be inspected at the receiving end.
Record: the three results and the DKIM `d=` value.

### Z11: Prove The App Alert Path

Owner: HUMAN.
Goal: prove a real owner alert reaches `eric@`, and leave a repeatable delivery test behind.
Constraint: the seeded accounts are all `@e2e.local` and the emulator stubs every send to a database record, so the dev site can never prove delivery. This must run against production.

Steps:

1. Create one account on the production site with the address `canary@lecoursville.com`, no admin role, password in the password manager.
2. Keep the account. Do not delete it. It is the standing delivery target.
3. Confirm the owner alert arrives at `eric@lecoursville.com` in the Inbox, not Junk.
4. Open the alert and confirm the body names the canary address.
5. From the app, request a password reset for `canary@`.
6. Open the `canary@` mailbox and confirm the reset mail arrived.
7. Record both results.

Expected: the alert arrives once, and the reset mail arrives at `canary@`.
Note: the alert gate allows one notification per account per day, so re-creating or re-triggering for the same account inside the window sends nothing, and that silence is not a failure. The reset mail has no such gate, which is why it is the monthly test.
Record: alert arrived, reset arrived, and the date.

### Z11b: Keep The Canary Once It Works

Owner: AGENT.
Goal: a standing production account is a credential, so it gets the same treatment as any prod access.
Steps:

1. Confirm `canary@` holds the `user` role only, and no admin flag.
2. Confirm its password lives in the password manager, not in the repo.
3. Add one line to `docs/` in the same change as Z15 recording that `canary@lecoursville.com` is the mail canary and must not be deleted.
4. Do not put the canary's credentials anywhere in the repo.

Expected: documented, low-privilege, and discoverable by the next admin.
Record: done or deferred.

### Z12: Prove Mobile Push

Owner: HUMAN.
Goal: the declared noticing path must actually notify.
Steps:

1. Install the Zoho Mail app and sign in as `eric@lecoursville.com`.
2. Allow notifications on the device.
3. Send a message from a personal address.
4. Confirm a notification appears without opening the app.
5. Leave the app installed and signed in.

Expected: a push notification is received.
Record: pass or fail.

## Part 4: Keep It Alive

### Z13: The Monthly Ten Minutes

Owner: HUMAN.
Goal: this mailbox is silent for months by design, which is exactly the condition Zoho treats as abandoned, and silence is also how a broken delivery path looks.
Steps:

1. Add a recurring 30-day calendar reminder named `eric@ mailbox check`. The owner maintains this reminder personally.
2. Each time it fires, follow the monthly sitting in `docs/2026-10-25_LeCoursville_Email_Maintenance.md`. Do not improvise the routine here.
3. The first sitting must include a successful reset to `canary@`.

Expected: the first reminder lands within 30 days, and step 3 passes every month.
Failure branch: if the reset mail does not arrive, the path is broken even though DNS still resolves. Treat it as an incident, not a flake, and start at Z14.
Record: the first date, and each month's pass or fail.

### What Can And Cannot Be Automated

- The idle clock cannot be automated. Resetting it requires an interactive sign-in, Free has no IMAP to script against, and web automation would sit outside Zoho's acceptable use. Do not build a login bot.
- Delivery detection can be automated later. Resend reports send outcomes, so a scheduled function could mail `eric@` on a fixed cadence and record the delivery result.
- That automation is a code change with its own tests, not part of this runbook. Treat it as a follow-up spec.

### Z14: Quarterly Health Check

Owner: AGENT, when prompted.
Goal: catch silent vendor drift and confirm the untouched records are still untouched.
Commands:

```bash
dig +short MX lecoursville.com @8.8.8.8
dig +short TXT lecoursville.com
dig +short TXT zoho._domainkey.lecoursville.com
dig +short TXT _dmarc.lecoursville.com
dig +short TXT resend._domainkey.auth.lecoursville.com
dig +short CNAME send.auth.lecoursville.com
dig +short CNAME rsend.auth.lecoursville.com
dig +short MX send.auth.lecoursville.com
```

Expected: apex MX at Zoho, exactly one apex `v=spf1` record containing both includes, the Zoho DKIM key present, DMARC at `p=none`, and the three Resend values matching Current State.
Record: unchanged, or the diff.

### Z15: Fix The User-Facing Contact Address

Owner: AGENT, deferred until the mailbox is live.
Gap: `src/app/errors.service.ts:90` tells users to contact `efournier92@gmail.com`, and no e2e spec asserts that copy.
Steps:

1. Point it at `eric@lecoursville.com`.
2. Add a Playwright assertion under `e2e/specs/` in the same change, per the repo rule.
3. Land it only after `eric@` actually receives.

Record: done or deferred.

## Part 5: Enforce DMARC

### Z16: Flip DMARC To Quarantine Once Both Senders Are Proven

Owner: HUMAN.
Goal: `p=none` documents a policy and enforces nothing, and both senders can be proven first, so enforcement does not need a waiting period.
Prerequisite: Z9 and Z10 pass.
Why the order matters: the apex policy governs `auth.lecoursville.com` too, absent a separate subdomain policy, so flipping it before proving Resend alignment would start rejecting app mail.

Steps:

1. From the app, request a password reset for `canary@lecoursville.com`.
2. Open that message in the `canary@` mailbox and view the full headers.
3. Confirm `spf=pass`, `dkim=pass`, and note the `d=` domain on the DKIM signature.
4. Continue only if `d=` is `lecoursville.com` or `auth.lecoursville.com`. If it is anything else, stop and report, because relaxed alignment would not hold.
5. In GoDaddy DNS, edit the `_dmarc` TXT to `v=DMARC1; p=quarantine; rua=mailto:eric@lecoursville.com`.
6. Request one more password reset and confirm it still arrives.
7. Leave `rua` in place for 30 days so reports land while the policy settles, then remove the `rua` and keep `p=quarantine`.

Expected: app mail still delivers after the flip, and forwarded app mail keeps working.
Rollback: set the `_dmarc` TXT back to `v=DMARC1; p=none;` and wait out the TTL. One record edit, no other change.
Record: the `d=` value observed, the value published, and the post-flip reset result.

## Rollback

The baseline values are inline in Current State, so no external snapshot is needed. Order matters:

1. In Zoho, export the mail first, using Settings then Import/Export to an EML zip. Cancelling the organization destroys the data after 30 days.
2. Restore the apex SPF TXT to `v=spf1 include:_spf.firebasemail.com ~all`.
3. Delete the three Zoho MX records.
4. Delete the `zoho._domainkey` TXT and the Zoho verification TXT.
5. Restore `_dmarc` to `v=DMARC1; p=none;` if Z16 ran.
6. Cancel the Zoho organization.
7. Never remove the Resend records on `auth` or `send.auth`.

## Definition Of Done

- MX at `@` resolves to Zoho.
- Exactly one apex SPF record, containing both includes.
- DKIM active on selector `zoho`, and a Zoho-sent message passes DKIM at the receiving end.
- DMARC reaches `p=quarantine` only after the DKIM `d=` domain is confirmed aligned, and reverts to `p=none` if any app mail fails after the flip.
- Two mailboxes exist: `eric@` for the owner, `canary@` as a documented low-privilege canary that must not be deleted.
- A 30-day reminder exists and its first run includes a successful reset to `canary@`.
- Two-factor authentication is on for the Zoho account, with a recovery address on another domain.
- The app sender is allowlisted and the catch-all state is known.
- Inbound verified from an outside sender, and outbound verified in the recipient's headers.
- Mobile push proven.
- Records under `auth` and `send.auth` are unchanged.

## Boundary

Zoho is the inbox, not the sender. App mail keeps leaving through Resend from `no-reply@auth.lecoursville.com`. Do not add Zoho SMTP to the app, and do not move the Resend sending domain onto the apex.

## Note On The Paid Guide

`2026-10-24_eric_email_gmail_setup.md` remains the reference for the Google Workspace route and is the better long-term setup.
Its free-path appendix is stale, because Gmail removes third-party "Send as" in January 2027.
