# Eric Email Setup (Gmail)

- Date: 2026-10-24
- Goal: `eric@lecoursville.com` works for send and receive in Gmail
- Domain: `lecoursville.com`
- DNS host: GoDaddy, nameservers `ns03.domaincontrol.com` and `ns04.domaincontrol.com`
- Why it matters: `functions/src/config.ts` uses `eric@lecoursville.com` as `REPLY_TO` and `OWNER_ALERT_ADDRESS`, so replies to app mail and owner alerts currently go nowhere.

## Driver Prompt

Paste this to the next agent:

Read /Users/e/mnt/bnk/cs/lecoursville/design_specs/2026-10-24_eric_email_gmail_setup.md and drive it interactively. Present one step at a time, wait for done, skip, or stop, record each result, do not run HUMAN steps, and never ask for or echo a password, app password, or secret key.

## Current DNS State

Observed with `dig` on 2026-10-24:

- No MX record on `lecoursville.com`. Inbound mail cannot be delivered today.
- SPF: `v=spf1 include:_spf.firebasemail.com ~all`.
- DMARC: `v=DMARC1; p=none;`.
- No `google._domainkey` TXT.
- Resend is verified on the `auth` subdomain. `resend._domainkey.auth.lecoursville.com` has a DKIM TXT, and `send.auth.lecoursville.com` has its own MX and SPF.
- The app sends from `no-reply@auth.lecoursville.com` and sets `Reply-To: eric@lecoursville.com`.

Conclusion: the root domain is free for Google Workspace. Do not touch the `auth` or `send.auth` records.

## How To Drive This

Same protocol as the pre-merge walkthrough: one step per message, one owner per step, record the result, and stop on failure.
Never paste a secret key, app password, or account password into chat.

## Decision E0: Which Path

Owner: HUMAN.
Goal: choose how to run the mailbox.
Options:

1. Google Workspace, Business Starter, one user (recommended). A real mailbox at Gmail, clean SPF and DKIM, and delegation and forwarding available.
2. Free forwarding plus Gmail Send mail as. Inbound forwards to a personal Gmail, and outbound goes through Gmail or a relay. Cheaper, more fragile, and weaker DMARC alignment.

Recommendation: option 1.
Ask: which path?
Record: the choice. The rest of this file follows option 1. The free path is in the appendix.

## Part 1: Discovery

### E1: Confirm Registrar And DNS Access

Owner: HUMAN.
Goal: confirm you can edit DNS at GoDaddy.
Steps:

1. Sign in at `https://dcc.godaddy.com`.
2. Open the domain `lecoursville.com`, then DNS.
3. Confirm the nameservers are `ns03.domaincontrol.com` and `ns04.domaincontrol.com`.
4. Confirm you can add records and edit the existing SPF TXT.

Record: access confirmed and the current SPF value.

### E2: Record The Existing Mail Records

Owner: HUMAN.
Goal: keep a rollback copy before changing DNS.
Commands:

```bash
dig +short MX lecoursville.com
dig +short TXT lecoursville.com
dig +short TXT _dmarc.lecoursville.com
dig +short TXT resend._domainkey.auth.lecoursville.com
dig +short MX send.auth.lecoursville.com
```

Save the output to `/tmp/lecoursville-dns-before.txt`.
Record: the saved path.

## Part 2: Workspace Setup

### E3: Create The Workspace Account

Owner: HUMAN.
Goal: start the Google Workspace subscription for one user.
Steps:

1. Go to `https://workspace.google.com/business/signup`.
2. Choose Business Starter, one user.
3. Use `lecoursville.com` as the business domain.
4. Use a personal address as the recovery contact.
5. Complete billing.

Record: the Workspace account and the primary admin address.
Failure branch: if Google says the domain is already in use, stop and resolve the existing Google account or Workspace tenant before continuing.

### E4: Verify Domain Ownership

Owner: HUMAN.
Goal: prove control of `lecoursville.com`.
Steps:

1. In the setup wizard, choose the DNS TXT verification method.
2. Copy the verification value.
3. In GoDaddy DNS, add a TXT record at `@` with that value.
4. Keep the existing `google-site-verification` TXT and the existing SPF TXT.
5. Return to the wizard and verify.

Expected: the domain shows as verified.
Multiple TXT records can live at `@`, so the existing Search Console value can stay.
Record: verified.

### E5: Create `eric@lecoursville.com`

Owner: HUMAN.
Goal: create the mailbox.
Steps:

1. In the Admin console, go to Directory, then Users, then Add new user.
2. First name `Eric`, last name as you prefer.
3. Primary email `eric@lecoursville.com`.
4. Set a strong password and store it in a password manager.
5. Add a recovery email and phone.

Expected: the user exists and is active.
Record: the user and the recovery method, never the password.

### E6: Set The MX Record

Owner: HUMAN.
Goal: route inbound mail to Google.
Steps:

1. In GoDaddy DNS, add an MX record.
2. Type `MX`, name `@`, value `smtp.google.com`, priority `1`, TTL `1 Hour`.
3. Remove any other MX record on `@`.

Expected: `dig +short MX lecoursville.com` returns `1 smtp.google.com.`.
Record: the record and the dig output.

### E7: Update SPF

Owner: HUMAN.
Goal: authorize Google to send for the root domain.
Steps:

1. In GoDaddy DNS, edit the existing SPF TXT at `@`.
2. Set the value to `v=spf1 include:_spf.google.com include:_spf.firebasemail.com ~all`.
3. Keep exactly one SPF record. Do not add a second `v=spf1` TXT at `@`.

Expected: `dig +short TXT lecoursville.com` shows the new value and no second SPF record.
Record: the dig output.

### E8: Set Up DKIM

Owner: HUMAN.
Goal: sign outbound mail from `lecoursville.com`.
Steps:

1. In the Admin console, go to Apps, then Google Workspace, then Gmail, then Authenticate email.
2. Select the domain and generate a new 2048-bit key.
3. Copy the TXT value.
4. In GoDaddy DNS, add a TXT record at `google._domainkey` with that value.
5. Return to the Admin console and click Start authentication.

Expected: `dig +short TXT google._domainkey.lecoursville.com` returns the key.
Record: enabled.

### E9: Update DMARC

Owner: HUMAN.
Goal: keep DMARC permissive while the new setup warms up.
Steps:

1. In GoDaddy DNS, edit the existing `_dmarc` TXT.
2. Set the value to `v=DMARC1; p=none; rua=mailto:eric@lecoursville.com`.
3. Do not raise the policy to `quarantine` or `reject` until both Google and Resend pass.

Expected: `dig +short TXT _dmarc.lecoursville.com` shows the new value.
Record: the value.

### E10: Activate Gmail

Owner: HUMAN.
Goal: turn on Gmail for the domain.
Steps:

1. In the Admin console, go to Account, then Domains, then Manage domains.
2. Click Activate Gmail and follow the wizard.
3. Wait for the MX check to pass. It can take up to 72 hours.

Expected: Gmail is active for `lecoursville.com`.
Record: active or pending.

## Part 3: Verify

### E11: Send And Receive

Owner: HUMAN.
Goal: prove both directions.
Steps:

1. Sign in at `https://mail.google.com` as `eric@lecoursville.com`.
2. Send a message to a personal address.
3. From the personal address, reply to that message.
4. In Gmail, open the received message and choose Show original.
5. Confirm `SPF: pass`, `DKIM: pass`, and `DMARC: pass`.

Expected: all three pass, and the reply lands in the `eric@` inbox.
Record: the three authentication results.

### E12: App Mail

Owner: HUMAN.
Goal: prove the app's Reply-To and owner alerts land.
Steps:

1. On the dev site, request a password reset for a seeded account.
2. Reply to the reset email.
3. Confirm the reply arrives at `eric@lecoursville.com`.
4. Create a test account and confirm the owner alert arrives at `eric@lecoursville.com`.

Expected: both messages arrive.
Record: pass or fail.

### E13: Keep Resend Working

Owner: HUMAN.
Goal: confirm the Workspace change did not disturb transactional mail.
Steps:

1. Confirm `resend._domainkey.auth.lecoursville.com` and `send.auth.lecoursville.com` are untouched.
2. Send one real password reset and confirm delivery.
3. Confirm the From is still `no-reply@auth.lecoursville.com` and the Reply-To is `eric@lecoursville.com`.

Expected: transactional mail still delivers.
Record: pass or fail.

## Part 4: Optional

### E14: Delegate Or Forward To A Personal Gmail

Owner: HUMAN.
Goal: read `eric@` inside an existing Gmail if preferred.
Options:

1. Gmail delegation. In the Admin console, open the user, then Gmail, then Delegation, and add the personal address. The mailbox stays separate.
2. Forwarding. In the Admin console, open Gmail, then Routing, and add a forwarding address. This copies mail to the personal inbox.

Recommendation: delegation, so replies still come from `eric@`.
Record: the choice.

### E15: Keep The Repo In Sync

Owner: AGENT.
Goal: confirm the addresses in code still match.
Command:

```bash
grep -n "REPLY_TO\|OWNER_ALERT_ADDRESS\|FROM_ADDRESS\|ALERTS_FROM" functions/src/config.ts
```

Expected: `eric@lecoursville.com` for `REPLY_TO` and `OWNER_ALERT_ADDRESS`, and `no-reply@auth.lecoursville.com` for the senders.
Record: no change needed, or the diff.

## Appendix: Free Path

Only if E0 chose option 2.

- Use GoDaddy email forwarding to send `eric@lecoursville.com` to a personal Gmail.
- In Gmail, add `eric@lecoursville.com` under Send mail as.
- If Gmail's own sending is not accepted, use an SMTP relay that can verify the domain.
- Keep DMARC at `p=none`.
- Expect weaker alignment and a higher spam risk than Workspace.

## Rollback

- Keep the old MX and SPF values from E2 for 72 hours.
- To roll back, restore the old MX and SPF records.
- Do not remove the Resend records on `auth` or `send.auth` at any point.

## Definition Of Done

- MX points at `smtp.google.com`.
- SPF includes Google and Firebase.
- DKIM is on and verified.
- DMARC is `p=none` with a report address.
- `eric@lecoursville.com` sends and receives in Gmail.
- App replies and owner alerts arrive.
- Resend transactional mail still delivers.
