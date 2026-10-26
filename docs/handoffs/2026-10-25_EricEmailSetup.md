# Handoff | Eric Email Setup (Zoho Free)

- Date: 2026-10-25
- Branch: `review/dev-feedback-2026-10-25`
- Topic: creating and verifying `eric@lecoursville.com`, then deferring the app alert test

## Current State

### Done And Verified

- `eric@lecoursville.com` exists on Zoho Mail Forever Free, US data center, on the apex domain `lecoursville.com` at GoDaddy.
- DNS live and checked at `ns03`, `ns04`, `1.1.1.1`: three Zoho MX, merged SPF, DKIM selector `zoho` at 2048-bit, DMARC still `p=none`, Resend records untouched.
- Inbound proven: personal Gmail to `eric@` landed in Inbox.
- Outbound proven: `SPF PASS`, `DKIM PASS` with `d=lecoursville.com`, `DMARC PASS` at Gmail.
- Spam allowlist carries `no-reply@auth.lecoursville.com` and `auth.lecoursville.com`.
- Catch-all is off.

### Not Done

- Z2 admin 2FA was never confirmed.
- Z11 owner alert never proven. `onAccountCreated` is not deployed anywhere.
- Z12 mobile push, Z13 reminder, Z15 `errors.service.ts` straggler, Z16 DMARC quarantine.

### Branch State

- This session's work is committed as `9f018a6d` on `review/dev-feedback-2026-10-25`. Nothing of ours is uncommitted.
- The same checkout holds another session's uncommitted work: `docs/critique/2026-10-25_SignIn.md`, `docs/handoffs/2026-10-25_DevReviewBatchRemaining.md`, `docs/specs/2026-10-25_CallableInvokerAndRecoverySpacing.md`, and two entries in `docs/discovery/DISCOVERY.md` (`D-20261025-17`, `D-20261025-18`). Do not commit `DISCOVERY.md` until that work lands, because it also carries `D-20261025-19` and `D-20261025-20` from this session.

## Key Decisions

- Zoho Mail Free, not Workspace. Cost was a hard zero constraint.
- Resend stays the only sender for app mail. Zoho's usage policy bans automated and transactional sending.
- Permanent low-privilege `canary@lecoursville.com` mailbox as the repeatable delivery target. The alert gate allows one notification per uid per day, so re-testing the same account the same day sends nothing.
- DMARC quarantine is gated on confirming the DKIM `d=` domain, not on a waiting period.
- 30-day manual sitting, owner-maintained. Zoho's Idle clock needs a sign-in, not a payment.

## Next Actions

1. Wait for the other session to finish, then deploy dev with the invoker fix. Z11 cannot run until `onAccountCreated` is deployed.
2. Confirmed the deployed dev hosting predates commit `dd589830` and `requestPasswordReset` returns 403 while its siblings return 404, so the invoker fix must ship in the same deploy.
3. Run spec step Z11 against dev using `canary@lecoursville.com`, then keep the account.
4. Prove mobile push (Z12), then create the 30-day reminder (Z13).
5. Flip DMARC to `v=DMARC1; p=quarantine; rua=mailto:eric@lecoursville.com` (Z16) once Z9 and Z10 hold, keeping the one-record rollback.
6. Confirm Z2 was completed, and fix `src/app/errors.service.ts:90` with a Playwright assertion (Z15).

## Verify Commands

```bash
npm run email-healthcheck
```

Exit 0 means the DNS side is intact. Exit 1 prints the failing record.

```bash
git status --short
git log --oneline -3
```

Expect `9f018a6d` at or near the top of the log. `git status --short` should show nothing from this session; anything remaining belongs to the other session.

## Open Risks And Blockers

- **Blocker:** no deployed environment contains `onAccountCreated`. Production's last tag `26.06.01` has neither that file nor `REPLY_TO`.
- **Blocker:** dev callables return 403, consistent with the lost `roles/run.invoker` trap `D-20261025-16`. Deploying functions without that fix leaves the app unable to call them.
- **Risk:** Zoho Free clears idle mailboxes at 300 days and blocks at 180, and the TOS reserves termination at 120. Nothing enforces the sign-in but the owner's own reminder, which does not exist yet.
- **Risk:** no IMAP, POP, or forwarding, so no backup and no external monitor. The canary reset is the only delivery signal.
- **Risk:** DMARC sits at `p=none`, so a spoofed `eric@` is still deliverable to app users who see that address in Reply-To.

## References

- Setup runbook with status: `design_specs/2026-10-25_eric_email_free_zoho_setup.md`
- Configuration record and decisions: `docs/2026-10-25_LeCoursville_Email_Configuration.md`
- Recurring routine and triage: `docs/2026-10-25_LeCoursville_Email_Maintenance.md`
- Critique ledger, 27 findings: `docs/critique/2026-10-25_EricEmailFreeZoho.md`
