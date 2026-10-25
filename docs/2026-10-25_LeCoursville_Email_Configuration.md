# 2026-10-25 LeCoursville Email Configuration

## Summary

How `eric@lecoursville.com` is set up: Zoho Mail Forever Free on the apex domain, DNS at GoDaddy, app mail still sent through Resend. Mail works in both directions and is authenticated. The app's owner-alert path is not deployed, so that half is unproven.

## Scope

- Repo: `/Users/e/mnt/bnk/cs/lecoursville`
- Work: chose a provider, configured DNS, verified send and receive
- Date: 2026-10-25, branch `review/dev-feedback-2026-10-25`
- Domain: `lecoursville.com`, nameservers `ns03.domaincontrol.com` and `ns04.domaincontrol.com`
- Provider: Zoho Mail, Forever Free Plan, US data center

## Findings

### Live DNS State

Verified with `dig` against `ns03`, `ns04`, `1.1.1.1`, and `8.8.8.8` on 2026-10-25.

- Apex MX: `10 mx.zoho.com.`, `20 mx2.zoho.com.`, `50 mx3.zoho.com.`
- Apex TXT, four values:
  - `v=spf1 include:_spf.firebasemail.com include:zohomail.com ~all`
  - `zoho-verification=zb26162099.zmverify.zoho.com`
  - `google-site-verification=IjvsI00TSz3g_pcK2mDkicc4X445ZJsBOyRsvkGlSP8`
  - `firebase=lecoursville`
- DKIM: `TXT zoho._domainkey.lecoursville.com`, `v=DKIM1; k=rsa; p=...`, 2048-bit, 410 characters total. Verified byte-identical to the value Zoho generated.
- DMARC: `TXT _dmarc.lecoursville.com` is still `v=DMARC1; p=none;`.
- Resend path untouched: `resend._domainkey.auth.lecoursville.com` TXT, MX `send.auth.lecoursville.com` (`send.forge.rmta.net.`, `10 feedback.forge.rmta.net.`), CNAME `send.auth` to `send.forge.rmta.net.`, CNAME `rsend.auth` to `rsend.forge.rmta.net.`.

### Proven Delivery

- Inbound: personal Gmail to `eric@lecoursville.com` arrived in Inbox, not Junk.
- Outbound: Zoho to personal Gmail showed `SPF: PASS` from `165.173.182.52`, `DKIM: PASS` with `d=lecoursville.com`, `DMARC: PASS`.
- `d=lecoursville.com` is the organizational domain, so DMARC alignment holds. This is the precondition for flipping DMARC to quarantine.

### Console Locations That Are Not Where You Expect

- Signup: `https://workplace.zoho.com/signup?type=org&plan=free` is the entry point Zoho's own pricing page uses for the Forever Free Plan (`https://www.zoho.com/mail/zohomail-pricing.html`).
- Admin console is a separate host from webmail: `https://mailadmin.zoho.com`, not `mail.zoho.com`.
- DKIM lives under the **Email Configuration** tab of the domain page, not a tab named "Email Authentication".
- Catch-all shows as a single input labelled "Catch-all Address". Empty means off. There is no toggle to look for.

### App Code That Depends On This

- `functions/src/config.ts:27` `REPLY_TO` and `:30` `OWNER_ALERT_ADDRESS` are `eric@lecoursville.com`; senders are `no-reply@auth.lecoursville.com`.
- `functions/src/helpers.ts:288` applies `replyTo: REPLY_TO` to every `sendEmail` call.
- `functions/src/account-created.ts:81` is the only send site for the owner alert, on `/users/{uid}` creation with `retry: true`.
- The alert is gated to one notification per uid per day (`functions/src/account-created.ts:59`), and the window is consumed only after a successful send.

## Decisions And Why

- **Zoho Mail Free over Google Workspace.** Cost was a hard constraint at zero.
- **Zoho over forwarding plus a relay.** ImprovMX free forwards but cannot send, and the Gmail "Send mail as" route that the old guide recommended is removed by Google in January 2027 (`https://support.google.com/mail/answer/17101213`), with new configurations already restricted in late 2026.
- **Keep a permanent `canary@lecoursville.com` mailbox.** A standing low-privilege account is the repeatable delivery target, since the alert gate blocks re-testing the same account the same day.
- **Enforce DMARC now, gated, rather than waiting 90 days.** Spec step Z16 flips to `p=quarantine` only after confirming the DKIM `d=` domain. Rejected alternative was a fixed waiting period, which buys nothing when both senders are already proven.
- **Catch-all off.** Apex MX makes every local part routable; off keeps typo and probe traffic out of a rarely read inbox.
- **Resend remains the only sender.** Zoho's usage policy prohibits automated and transactional sending (`https://www.zoho.com/mail/help/usage-policy.html`), so app mail must never move to Zoho SMTP.
- **Accept a monthly sign-in chore.** Zoho blocks and then clears idle mailboxes; the login half cannot be automated without IMAP.

## Traps And Non-Obvious Behavior

- **GoDaddy's two nameservers propagate independently.** After the SPF edit, `ns03` served the new value while `ns04` still served the old one. Public resolvers inherited whichever they hit.
- **Negative caching bites twice.** An empty MX answer before the change is cached, and `8.8.8.8` also kept a cached NXDOMAIN for `zoho._domainkey` after the record existed at both authoritative servers. Always check authoritative first, then resolvers.
- **Multi-chunk TXT values.** A 2048-bit DKIM value exceeds one TXT string, so GoDaddy stores it as two quoted chunks, about 255 and 155 characters. `dig +short` prints them space-separated, so naive concatenation yields 411 rather than 410. Strip only the separator.
- **The Zoho signup page has no domain field.** The first screen creates the account and asks for a personal email or mobile. The domain is requested on the next screen after the OTP. Do not use the address being created as the account identity.
- **Zoho Free has no IMAP, POP, ActiveSync, or email forwarding.** Reading and sending happen in webmail or the mobile app only, and export is a manual EML zip.
- **Free accounts are considered abandoned when idle.** Zoho blocks send and receive during a long idle period and clears the mailbox at 300 days per its help page, while the TOS reserves termination at 120 days of unpaid inactivity.
- **The dev deployment is behind the source.** `https://lecoursville-dev.web.app/main.js` contains no `requestPasswordReset` symbol, so that build predates commit `dd589830`.
- **Dev callables return 403, not 404.** `us-central1-lecoursville-dev.cloudfunctions.net/requestPasswordReset` responds 403 while `confirmPasswordReset` and `requestRecoveryCode` respond 404. A 404 means missing; a 403 means deployed but refusing, consistent with the lost `roles/run.invoker` trap logged as `D-20261025-16`.
- **Emulator sends never leave the process.** `isDryRun()` at `functions/src/helpers.ts:9` stubs every send to an `outboundEmails` database record when `FUNCTIONS_EMULATOR` is set or `EMAIL_DRY_RUN=1`. No deploy config sets the flag.
- **Seed users cannot receive mail.** All seeded accounts are `@e2e.local` (`scripts/e2e/seed.mjs:31`), including `adminAlertRecipients`.

## Evidence And Artifacts

- Setup runbook: `design_specs/2026-10-25_eric_email_free_zoho_setup.md` (v3, 16 steps)
- Recurring routine and failure triage: `docs/2026-10-25_LeCoursville_Email_Maintenance.md`
- Health check, read-only, exit 1 on a broken record: `scripts/email-healthcheck.sh`, also `npm run email-healthcheck`
- Critique ledger, 27 findings: `docs/critique/2026-10-25_EricEmailFreeZoho.md`
- Commits: `9fed9e11` added the runbook, `d4562465` added the ledger
- Rollback baseline: `/tmp/lecoursville-dns-before.txt` is volatile and predates the changes; the durable baseline is the Current State section of the runbook
- Verification commands:

```bash
dig +short MX lecoursville.com @ns03.domaincontrol.com
dig +short TXT lecoursville.com @ns03.domaincontrol.com
dig +short TXT zoho._domainkey.lecoursville.com @ns03.domaincontrol.com
dig +short TXT _dmarc.lecoursville.com @ns03.domaincontrol.com
dig +short TXT resend._domainkey.auth.lecoursville.com @ns03.domaincontrol.com
dig +short CNAME send.auth.lecoursville.com
dig +short CNAME rsend.auth.lecoursville.com
```

- Proof that the alert code predates any deploy: `git show 26.06.01:functions/src/account-created.ts` fails, and `git show 26.06.01:functions/src/config.ts | grep REPLY_TO` returns nothing. The 2026-10-10 handoff records `firebase functions:list` showing six functions, with `onAccountCreated` source-only.

## Open Questions

- Is `onAccountCreated` deployed on `lecoursville-dev`? Needs `firebase functions:list --project lecoursville-dev`.
- Is the `roles/run.invoker` fix from `docs/specs/2026-10-25_CallableInvokerAndRecoverySpacing.md` merged and deployed on dev?
- Was two-factor authentication enabled on the Zoho admin account? Spec step Z2 was never confirmed.
- Was the `canary@lecoursville.com` mailbox created? Spec step Z8 was partly confirmed, catch-all off was confirmed.
- Has the app's owner alert actually reached `eric@`? Unknown, blocked on a deploy.
- `src/app/errors.service.ts:90` still shows a personal Gmail address to users. Fixing it needs a Playwright assertion per the repo rule. The address is already present in the repo; this document does not repeat it.
- DMARC is still `p=none`. Spec step Z16 has not run.

## Next Actions

- Deploy dev with the invoker fix, then run spec step Z11 against dev with the canary account.
- The dev deploy is deliberately pended: another session is mid-change in this checkout on 2026-10-25, and deploying a half-edited tree would ship their work-in-progress. Wait for that session to finish, then deploy from a clean master.
- Prove mobile push (Z12), then create the 30-day sign-in reminder (Z13). The owner sets that reminder personally, and the routine itself lives in `docs/2026-10-25_LeCoursville_Email_Maintenance.md`.
- Flip DMARC to `v=DMARC1; p=quarantine; rua=mailto:eric@lecoursville.com` once Z9 and Z10 hold (Z16), keeping the one-record rollback.
- Confirm Z2 and Z8 were completed.
- Resume work details belong in a handoff, not here.
