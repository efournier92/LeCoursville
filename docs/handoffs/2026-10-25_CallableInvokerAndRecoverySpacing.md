# Callable Invoker Repair And Recovery Dialog Spacing

- Date: 2026-10-25
- Branch: `review/dev-feedback-2026-10-25`
- Spec: `docs/specs/2026-10-25_CallableInvokerAndRecoverySpacing.md`
- Ledger: `docs/critique/2026-10-25_SignIn.md` (C-20261025-04, C-20261025-05, C-20261025-06)
- Status: spec written and reviewed against the live project. No implementation, no repair applied, nothing committed.

## Current State

Done in this session:

- Diagnosed the recovery submit failure end to end. The browser's `CORS Missing Allow Origin` is a symptom, not the cause.
- Confirmed the cause by reading Cloud Run IAM directly: five backing services hold no bindings, every other callable holds `roles/run.invoker` for `allUsers`.
- Confirmed the affected set is exactly `requestpasswordreset`, `submitrecoveryrequest`, `admingenerateresetlink`, `closerecoveryrequest`, `updatealertrecipients`, and that all five have `cors: true` in source.
- Confirmed production has no deployed functions at all (`404` for every name).
- Wrote the spec, added the ledger rows, added discovery entry D-20261025-16.

In progress, not started:

- Nothing. The five bindings are still missing in `lecoursville-dev`, so account recovery submission is still broken on the dev site.

Repo state: `review/dev-feedback-2026-10-25`, with unrelated work in the tree from another session (email docs, `scripts/email-healthcheck.sh`, `package.json`, `design_specs/2026-10-25_eric_email_free_zoho_setup.md`). This session's files:

- `docs/specs/2026-10-25_CallableInvokerAndRecoverySpacing.md` (new, untracked)
- `docs/critique/2026-10-25_SignIn.md` (untracked; the file predates this session, three rows added)
- `docs/discovery/DISCOVERY.md` (modified; D-20261025-16 added)

## Key Decisions

- The fix is IAM repair plus a deploy probe, not a source change. `cors: true` is already correct on all five functions, and the invoker binding lives on the Cloud Run service, so it cannot be declared in the function bundle.
- The probe derives its callable list from source (`export const X = onCall(` in `functions/src/index.ts`) rather than a hardcoded list, so it cannot drift. Verified today: 13 callables, and the rule excludes `onAccountCreated`, `onAdminAlertCreated`, `sweepMediaUploads`, and `emulatorMediaSink`.
- The probe fails the deploy instead of warning. A private callable is a broken feature, and `scripts/deploy.sh` already runs under `set -e`.
- No automatic repair inside `deploy.sh`. It prints the exact `gcloud run services add-iam-policy-binding` command per failing service and stops, keeping deploys deterministic.
- Hint spacing is 16px bottom margin on `.recovery-field`, zero on the last field, matching the `.recovery-intro` rhythm. The e2e assertion is a geometric gap of at least 12px, leaving subpixel headroom across engines.
- Dialog copy and the submit failure message stay unchanged. Title casing of dialogs is unresolved under C-20261025-01, and the generic error copy is logged as a separate opening (C-20261025-06).

## Next Actions

1. Repair the five dev bindings. `gcloud` is not installed on this machine: `brew install --cask google-cloud-sdk`, then `gcloud auth login`.
2. Run the repair per service, exactly as written in "Repair The Five Bindings" in the spec, and confirm the preflight returns `204` with `access-control-allow-origin` echoing the dev origin.
3. Implement `scripts/check-callables.mjs`, the `check:callables` npm script, and the two `scripts/deploy.sh` call sites. Expected outcome: `npm run check:callables -- lecoursville-dev` prints 13 `PASS` lines and exits `0`.
4. Keep the pre-repair probe output as the red proof. It needs to be captured before step 2, so if the repair runs first, capture the red with a deliberately broken service or note in the handoff that the red was taken from the raw `curl` evidence in this session.
5. Add the 16px field margin in `src/app/components/recovery-request/recovery-request.component.scss`, plus the last-field zero rule.
6. Add the hint gap assertion to `e2e/specs/account-recovery.spec.ts`, then run `npm run e2e:gate`.
7. `npm run deploy:dev`, which now runs the probe internally.
8. Owner submits one real recovery request on the dev site and confirms the confirmation screen, no console error, and an admin alert.

## Verify Commands

```
git -C /Users/e/mnt/bnk/cs/lecoursville status --short
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS \
  'https://us-central1-lecoursville-dev.cloudfunctions.net/submitRecoveryRequest' \
  -H 'Origin: https://lecoursville-dev.web.app' \
  -H 'Access-Control-Request-Method: POST'
```

Expected right now: working tree matches the file list above, and the preflight returns `403`. A `204` means the repair already happened and step 2 is done.

To re-read the IAM state without gcloud, the Cloud Run Admin API answers `getIamPolicy` on a `GET` (not `POST`), with the Firebase CLI's cached OAuth token as a bearer token:

```
https://run.googleapis.com/v2/projects/lecoursville-dev/locations/us-central1/services/submitrecoveryrequest:getIamPolicy
```

## Open Risks And Blockers

- `gcloud` is absent, so the repair is blocked until it is installed or the binding is set from the Cloud Console.
- Why the Firebase CLI update path skipped `setIamPolicy` after the internal service replacement is unresolved. The probe makes it safe to leave open; chase it only if the binding drops again after a deploy that passed its own probe.
- The e2e gate can never reproduce this class of failure, because the emulator serves functions from `127.0.0.1:5001` with no Cloud Run in front. Only the probe covers it.
- Production has zero deployed functions, so the first production functions deploy is unproven and must run the probe.
- Verification is incomplete in one respect: the repo's `scripts/lint-markdown.py` is not installed on this machine, so the spec and ledger were checked against the four mechanical Markdown rules with an ad-hoc scan plus an eyeball pass on title case. No linter output exists for these files.
- Nothing from this session is committed. Committing is the owner's call.
