# 2026-10-25 LeCoursville Email Maintenance

## Summary

The recurring work that keeps `eric@lecoursville.com` reachable: a short monthly sitting, a longer quarterly check, and what to do when mail stops arriving. No payment and no renewal exist; the risk is idleness and silent failure.

## Why This Mailbox Needs Attention At All

Zoho Mail Free has no IMAP, no POP, and no email forwarding, so nothing external can watch it. Two independent failure modes follow from that:

- **Idle cleanup.** Zoho flags a mailbox inactive after 180 consecutive days and permanently clears it at 300. The TOS separately reserves termination of unpaid accounts after 120 days of continuous inactivity. The safe floor is 120 days. The clock resets when you sign in, not when mail arrives.
- **Silent delivery failure.** If SPF, DKIM, MX, or a Zoho-side change breaks, no alert reaches you, because the thing that would raise the alert is the broken path.

There is no subscription to renew. The only manual action is showing up.

## Cadence

| When | What | Time |
|---|---|---|
| Every 30 days | The monthly sitting below | 5 minutes |
| Every 90 days | Add the DNS health check to the same sitting | 10 minutes |
| On any suspicion | Failure triage | varies |

Thirty days is a deliberate margin, not a Zoho requirement. Three missed sittings still leave you inside the 120-day floor.

## The Monthly Sitting

1. Sign in at `https://mail.zoho.com` as `eric@lecoursville.com`. This resets the idle clock, which is the entire anti-deletion mechanism.
2. Open the Inbox and confirm it loads and shows recent mail. An empty inbox after weeks of app activity is itself a signal.
3. In a second tab, request a password reset from the app for `canary@lecoursville.com`.
4. Open `canary@lecoursville.com` and confirm the reset mail arrived within a few minutes.
5. Check `eric@lecoursville.com` for any owner alert that should have arrived but did not.
6. Note the date somewhere durable, not in memory.

Steps 3 and 4 are the delivery canary. They exercise Resend, the Zoho MX, and the spam allowlist in one action, using a flow that has no once-per-day gate.

## The Quarterly Health Check

Run the script from the repo root:

```bash
npm run email-healthcheck
```

It checks MX, SPF (both includes and the single-record rule), the Zoho verification TXT, DKIM shape and key size, DMARC, the Resend DKIM and return path, both Resend CNAMEs, and whether public resolvers agree with the authoritative ones. Exit 0 means healthy, exit 1 means something needs attention, and every line says which record is wrong.

It is read-only and needs no credentials. It cannot check delivery, sign-in, or whether an alert arrived, so it prints the manual steps at the end instead of pretending to cover them.

If you need to look by hand, these are the queries it runs.

```bash
dig +short MX lecoursville.com @ns03.domaincontrol.com
dig +short TXT lecoursville.com @ns03.domaincontrol.com
dig +short TXT zoho._domainkey.lecoursville.com @ns03.domaincontrol.com
dig +short TXT _dmarc.lecoursville.com @ns03.domaincontrol.com
dig +short TXT resend._domainkey.auth.lecoursville.com @ns03.domaincontrol.com
dig +short CNAME send.auth.lecoursville.com
dig +short CNAME rsend.auth.lecoursville.com
```

Expected baseline, as verified on 2026-10-25:

- MX: `10 mx.zoho.com.`, `20 mx2.zoho.com.`, `50 mx3.zoho.com.`
- Apex TXT: exactly one value starting `v=spf1`, and it reads `v=spf1 include:_spf.firebasemail.com include:zohomail.com ~all`. Three other TXT values are also present: `zoho-verification=`, `google-site-verification=`, and `firebase=lecoursville`.
- DKIM: `zoho._domainkey` returns a 2048-bit key, about 410 characters once the chunks are joined.
- DMARC: `v=DMARC1; p=none;` until the quarantine step has run, after which it reads `p=quarantine`.
- Resend: DKIM TXT present, `send.auth` MX two hosts, `send.auth` and `rsend.auth` CNAMEs both resolving to `forge.rmta.net` hosts.

Two habits that save time:

- Query the authoritative nameservers first. GoDaddy's pair have been seen serving the old and new value of the same record simultaneously.
- Public resolvers cache stale and even NXDOMAIN answers for up to the TTL. A blank result from `8.8.8.8` is not proof that a record is missing.

## If Mail Stops Arriving

Work in this order. It moves from cheapest to most invasive.

1. **Check the folder.** Zoho junk, not the inbox. The allowlist covers the visible From, and Resend signs and bounces under its own subdomain.
2. **Check MX.** A single query above. Three Zoho hosts or the mailbox is unreachable.
3. **Check the domain in Zoho.** Admin console at `https://mailadmin.zoho.com`, Domains. If the domain shows unverified, the verification TXT was removed or changed.
4. **Check the mailbox state.** Users. If the account is inactive or suspended for idleness, see the reactivation section below.
5. **Check the sender, not the receiver.** Request a reset for a normal account and look for a failed send in the Resend dashboard and in the app's `outboundEmails` or audit records.
6. **Check the alert function.** If resets arrive but owner alerts do not, the difference is `onAccountCreated`. It was source-only, not deployed, as of 2026-10-25.

## If Mail Stops Sending

1. Send from Zoho webmail to a personal address you can inspect.
2. Open the message there and check `SPF`, `DKIM` with `d=lecoursville.com`, and `DMARC`.
3. `DKIM` failing: query `zoho._domainkey`. If the record is missing or truncated, regenerate the key in Zoho and replace the TXT in the same sitting. Leaving the two out of step breaks your own outbound until fixed.
4. `SPF` failing while `DKIM` passes: DMARC still passes, so this is a stale resolver cache or a second SPF record. Confirm exactly one `v=spf1` value exists at the apex.
5. `DMARC` failing while both pass: the DKIM `d=` domain stopped matching the organizational domain. Treat it as a provider change and re-read the current Zoho DKIM page.

## Reactivating A Lapsed Mailbox

- Sign in. If the account is blocked for inactivity, use the reactivation prompt Zoho shows, or the recovery path on the sign-in page.
- Expect mail received during the blocked window to be missing once past the clearing threshold. Zoho does not queue mail for a blocked mailbox.
- Reset the idle clock by signing in, then run the monthly sitting to re-prove delivery.
- Export beforehand if the mailbox still opens and has anything worth keeping. Free export is manual, via Settings then Import and Export, to an EML zip. There is no scheduled backup.

## If The Provider Has To Be Replaced

The full rollback and teardown order is in `design_specs/2026-10-25_eric_email_free_zoho_setup.md`. Two hard rules from it:

- Never remove the Resend records on `auth` or `send.auth`.
- Export the mailbox before cancelling the Zoho organization. Cancellation destroys the data after 30 days.

## Things Not To Do

- Do not route app mail through Zoho SMTP. Zoho's usage policy bans automated and transactional sending, and Resend is the sender by design.
- Do not give `canary@lecoursville.com` an admin role, and do not delete it. It is the only repeatable delivery target.
- Do not turn on catch-all. Apex MX makes every local part routable, and catch-all feeds typo and probe traffic into an inbox nobody reads daily.
- Do not edit the SPF record while a deliverability problem is unresolved. Touching it restarts the TTL clock and makes the symptom move.

## Related Documents

- Setup runbook and rollback: `design_specs/2026-10-25_eric_email_free_zoho_setup.md`
- Configuration record and decisions: `docs/2026-10-25_LeCoursville_Email_Configuration.md`
- Critique ledger behind both: `docs/critique/2026-10-25_EricEmailFreeZoho.md`
