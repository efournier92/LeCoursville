# Callable Invoker Repair And Recovery Dialog Spacing

- Branch: `review/dev-feedback-2026-10-25`
- Source ledger: `docs/critique/2026-10-25_SignIn.md` (C-20261025-04, C-20261025-05)
- Severity: high for C-04 (every account recovery submission fails on the dev site), low for C-05
- Verified build: `lecoursville-dev.web.app`, project `lecoursville-dev`
- Merge target: `master`. Deploy target: `lecoursville-dev` through `npm run deploy:dev`.

## Context And Motivation

The owner opened `Request account recovery` from the sign-in page, filled the form, and submitted twice.

Both attempts failed with the red banner `We couldn't submit your request. Try again.`

The browser console showed two errors for the same request:

```
OPTIONS https://us-central1-lecoursville-dev.cloudfunctions.net/submitRecoveryRequest
CORS Missing Allow Origin
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://us-central1-lecoursville-dev.cloudfunctions.net/submitRecoveryRequest. (Reason: CORS header 'Access-Control-Allow-Origin' missing). Status code: 403.
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://us-central1-lecoursville-dev.cloudfunctions.net/submitRecoveryRequest. (Reason: CORS request did not succeed). Status code: (null).
```

The error text names CORS, which points at function source. The source is not the problem.

The request never reaches the function. Google Frontend answers the preflight with `403` and an HTML error page, and it attaches no CORS headers to that rejection, so the browser reports a CORS failure for what is really an authorization failure at the Cloud Run layer.

Measured on 2026-10-25 against `lecoursville-dev`:

| Check | `submitRecoveryRequest` | `claimMemberRole` (control) |
|---|---|---|
| `OPTIONS` preflight status | `403` | `204` |
| `access-control-allow-origin` | absent | `https://lecoursville-dev.web.app` |
| Response body | Google Frontend HTML `403 Forbidden` | empty |
| Cloud Run service IAM bindings | none | `roles/run.invoker` for `allUsers` |
| Cloud Functions state, ingress, runtime | `ACTIVE`, `ALLOW_ALL`, `nodejs20` | `ACTIVE`, `ALLOW_ALL`, `nodejs20` |

The Cloud Run service backing a gen2 callable must grant `roles/run.invoker` to `allUsers`, or Cloud Run rejects every unauthenticated caller before Firebase's callable wrapper runs.

Five callables are in this state, and they are exactly the account recovery set:

`requestpasswordreset`, `submitrecoveryrequest`, `admingenerateresetlink`, `closerecoveryrequest`, `updatealertrecipients`.

Every other deployed callable in the project has the binding and answers preflight normally.

All five have `cors: true` in source, which is correct and sufficient once Cloud Run lets the request through, so no source change fixes this.

The e2e gate cannot catch it: the emulator serves functions from `127.0.0.1:5001`, where no Cloud Run or IAM layer exists.

## Glossary

**Invoker binding**

The IAM policy binding `roles/run.invoker` granting `allUsers` on a Cloud Run service. Without it the service is private and Cloud Run returns `403` before the container executes.

**Preflight**

The browser's `OPTIONS` request before a cross-origin `POST`. Firebase callables answer `204` with `access-control-allow-origin` when reachable.

**Gen2 callable**

An `onCall` function from `firebase-functions/v2/https`. Its compute is a Cloud Run service named after the function in lower case, for example `submitRecoveryRequest` maps to service `submitrecoveryrequest`.

**Backing service**

That Cloud Run service. "Backing service" is used here to keep it distinct from the user-facing function name.

**Public callable**

A callable whose callers are not required to be signed in. All thirteen deployed callables in this project are public callables.

## Current State

### The Five Backing Services

IAM read directly from the Cloud Run Admin API on 2026-10-25:

| Function | Backing service | Bindings |
|---|---|---|
| `requestPasswordReset` | `requestpasswordreset` | none |
| `submitRecoveryRequest` | `submitrecoveryrequest` | none |
| `adminGenerateResetLink` | `admingenerateresetlink` | none |
| `closeRecoveryRequest` | `closerecoveryrequest` | none |
| `updateAlertRecipients` | `updatealertrecipients` | none |
| `claimMemberRole` | `claimmemberrole` | `roles/run.invoker` for `allUsers` |
| `createMediaUpload` | `createmediaupload` | `roles/run.invoker` for `allUsers` |

Why the five lost the binding:

- Their backing services were created on 2026-10-10T22:58 and internally replaced on 2026-10-25T18:52.
- The controls were created on 2026-10-25T18:48 to 18:52 and kept the binding.
- The project audit log holds no `SetIamPolicy` entry in the last seven days, so nothing re-applied the binding after the replacement.
- The exact reason the Firebase CLI update path skipped that call is not established and is not needed to fix or guard against it.

Source anchors:

- All five declare `cors: true`: `functions/src/request-password-reset.ts:31`, `submit-recovery-request.ts:32`, `admin-generate-reset-link.ts:33`, `close-recovery-request.ts:20`, `update-alert-recipients.ts:10`.
- Callable client: `src/app/services/cloud-functions.service.ts:42`.
- Dialog submit and its generic failure banner: `src/app/components/recovery-request/recovery-request.component.ts:41` to `:68`.
- Deploy path with no post-deploy verification: `scripts/deploy.sh:36` to `:48`.

Production state, measured the same day: `lecoursville` answers `404` for every function name, so production has no deployed functions and cannot show this failure yet. The first production functions deploy must be probed with the same check.

### The Recovery Dialog Hint

- `.recovery-field` sets only `display` and `width` (`src/app/components/recovery-request/recovery-request.component.scss:8` to `:11`).
- Material's form field adds no vertical margin of its own, so all four fields stack flush, and the hint sentence sits hard against the next field.
- The hint is the only `mat-hint` in the app: `src/app/components/recovery-request/recovery-request.component.html:22`.
- Dialog content padding is global and already correct: `src/styles.scss:154` to `:162`.
- The hint copy stays as written. It is the anchor the owner pointed at, not the defect.

## Goals

- Account recovery submission works from the dev site, proven from a browser.
- Any public callable whose invoker binding is missing fails a deploy instead of failing a user.
- The alternate-contact hint has a deliberate gap below it, on all browsers in the gate.

## Non-Goals

- No change to function source, to `cors: true`, or to rate limiting.
- No App Check enforcement. That stays deferred under runbook item C-13.
- No title casing of dialog copy. C-20261025-01 covers the sign-in card; the owner has not extended it to dialogs, so the hint stays sentence case.
- No change to the user-facing submit error copy.
- No production functions deploy in this batch.
- No automatic binding repair inside `deploy.sh`. The deploy reports the exact repair command and stops.

## Prerequisites

- `gcloud` CLI installed and authenticated. It is not on this machine today: `brew install --cask google-cloud-sdk`, then `gcloud auth login`.
- The operator account holds `roles/run.admin` on `lecoursville-dev`. Any account that can deploy functions can usually set the invoker binding, but confirm before starting.
- Java for the e2e gate: `export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`.

## Design Principles

- Repair the narrowest thing: `roles/run.invoker` per backing service. Never a project-level grant.
- Verify the way a browser would: unauthenticated, cross-origin, `OPTIONS` first.
- A private callable is a broken feature, so it fails the deploy rather than warning.
- The check costs nothing to keep: no credentials, no dependencies, one HTTP call per callable.

## Infrastructure Requirements

### Repair The Five Bindings

Run once per affected service, changing nothing else:

```
gcloud run services add-iam-policy-binding submitrecoveryrequest \
  --member=allUsers --role=roles/run.invoker \
  --region=us-central1 --project=lecoursville-dev
```

Repeat for `requestpasswordreset`, `admingenerateresetlink`, `closerecoveryrequest`, and `updatealertrecipients`.

Do not touch any other service, and do not add project-level grants.

Verify each one from outside:

```
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS \
  'https://us-central1-lecoursville-dev.cloudfunctions.net/submitRecoveryRequest' \
  -H 'Origin: https://lecoursville-dev.web.app' \
  -H 'Access-Control-Request-Method: POST'
```

Expect `204`. Then confirm the header is present and echoes the origin:

```
curl -s -D - -o /dev/null -X OPTIONS \
  'https://us-central1-lecoursville-dev.cloudfunctions.net/submitRecoveryRequest' \
  -H 'Origin: https://lecoursville-dev.web.app' \
  -H 'Access-Control-Request-Method: POST'
```

### Post-Deploy Callable Probe

New file `scripts/check-callables.mjs`. Plain Node, no dependencies, no credentials.

Discovery, from source so it cannot drift:

1. Read `functions/src/index.ts`.
2. Collect each `export { name } from "./file"` name.
3. Keep only names whose exported source contains `export const <name> = onCall(`.
4. This excludes the event-driven and scheduled exports: `onAdminAlertCreated`, `onAccountCreated`, `sweepMediaUploads`, `emulatorMediaSink`. Expect thirteen names today.

Per name:

- `OPTIONS https://us-central1-<project>.cloudfunctions.net/<name>`.
- Headers: `Origin` set to the project's hosting origin, `Access-Control-Request-Method: POST`.
- Origin map: `lecoursville-dev` to `https://lecoursville-dev.web.app`, `lecoursville` to `https://lecoursville.com`. An unknown project is an error, not a skip.
- Pass requires `204` and an `access-control-allow-origin` header equal to the origin sent.
- Retry the whole set up to twelve times, five seconds apart, to absorb rollout lag. Deterministic, no jitter.
- Exit `0` with one `PASS name (204, origin echoed)` line per callable.
- Exit `1` with one line per failure carrying name, status, the allow-origin header as received, and the exact `gcloud run services add-iam-policy-binding` command for that service.

Wiring:

- `package.json` script: `"check:callables": "node scripts/check-callables.mjs"`, run as `npm run check:callables -- lecoursville-dev`.
- `scripts/deploy.sh` calls it inside `deploy_dev` and inside `deploy_prod`, immediately after `firebase deploy --only hosting,functions,database` and before the storage-rules step.
- `set -e` is already in force, so a non-zero probe aborts the deploy with the repair command on screen.

### Why Not A Source Option

- The Firebase CLI already derives `["public"]` for a callable whose trigger invoker is `null` on the update path, so adding an explicit `invoker` option changes nothing about the missing binding.
- The binding lives on the Cloud Run service, not in the function bundle, so it cannot be declared in source.
- Keep `cors: true` everywhere. It is correct, and removing it would add a second failure mode.

## Frontend And UI Requirements

### Recovery Hint Spacing

Change in `src/app/components/recovery-request/recovery-request.component.scss`:

- Add `margin-bottom: 16px` to `.recovery-field`.
- Add a `mat-form-field.recovery-field:last-of-type { margin-bottom: 0; }` rule.
- Keep `display: block` and `width: 100%`.

Result: every field gets the same 16px rhythm as `.recovery-intro`, and the alternate-contact hint clears the Message field instead of touching it.

Do not use `::ng-deep`, do not override Material's subscript wrapper, and do not change the hint text.

### E2E Coverage

Extend the dialog test in `e2e/specs/account-recovery.spec.ts`, where the dialog is already open and `recovery-alt-contact` is already filled.

Add one deterministic assertion:

- Measure `mat-hint` inside the third `mat-form-field` with `boundingBox()`.
- Measure the fourth `mat-form-field` (the Message field) with `boundingBox()`.
- Assert the vertical gap is at least `12px`.

Rationale for `12`: the design gap is `16px`, and subpixel rounding differs per engine, so the assertion holds headroom without becoming a no-op.

Record the measured value in the commit message. No sleeps, no screenshots as a pass condition.

## Production Risks And Mitigations

| Risk | Mitigation |
|---|---|
| A future functions update drops the binding again and recovery silently breaks | The deploy probe fails the deploy, so the breakage never reaches users. |
| Someone repairs this with a project-wide IAM grant | The spec fixes scope at `roles/run.invoker` on five named services, and the probe verifies behavior rather than policy shape. |
| Probe false positive from a stale revision during rollout | The probe retries the full set twelve times over a minute before failing. |
| Probe false negative because Cloud Run answers `204` but the function itself errors | Out of scope by design: the probe proves reachability and CORS. The e2e suite proves behavior. |
| The spacing change loosens the dialog for every field, not just the hint | Intended: one shared 16px rhythm, matching `.recovery-intro`. Reviewed in the browser before sign-off. |
| Production has zero functions, so the first prod functions deploy is unprecedented | The probe runs on prod too, and prints the repair command if the create path misses the binding. |

## Rollout Plan

1. Land this spec and the two ledger rows.
2. Run the probe against dev before anything else and keep the failure output as the red proof.
3. Repair the five bindings with `gcloud`, then re-run the probe to green.
4. Implement the probe, the npm script, and the `deploy.sh` wiring. Re-run against dev: green.
5. Implement the spacing rule and the e2e assertion. `npm run e2e:gate` green.
6. `npm run deploy:dev`. The probe runs inside the deploy and must PASS.
7. Owner submits one real recovery request from the dev site: confirmation screen shown, no console error, admin alert present in the admin surface.
8. Owner re-tests C-05 in the same dialog and closes both ledger rows.

## Test Plan

### Unit (Vitest)

None. The change carries no logic, and a unit test on a CSS margin would restate the stylesheet.

### E2E (Playwright)

- New: hint-to-field gap assertion in `e2e/specs/account-recovery.spec.ts`.
- Unchanged and must stay green: the existing recovery submit path, which proves the dialog still posts to the callable in the emulator.

### Deploy Probe

- Red proof: `npm run check:callables -- lecoursville-dev` exits `1` and lists the five recovery callables with `403` and no allow-origin header.
- Green proof: the same command exits `0` with thirteen `PASS` lines.
- Both outputs go in the handoff, because the emulator gate can never reproduce the red.

## Acceptance Criteria

- [ ] C-20261025-04 is fixed: preflight for all five recovery callables returns `204` with the origin echoed.
- [ ] `scripts/check-callables.mjs` discovers callables from `functions/src/index.ts` and probes all thirteen.
- [ ] The probe exits non-zero when a callable is private, naming the service and the repair command.
- [ ] `npm run check:callables -- lecoursville-dev` is wired into `deploy_dev` and `deploy_prod` and aborts a deploy on failure.
- [ ] C-20261025-05 is fixed: `mat-hint` clears the Message field by at least `12px` in Chromium, WebKit, and Firefox.
- [ ] `npm run e2e:gate` is green with the new assertion.
- [ ] The dev deploy passes its own probe.
- [ ] Owner submits one real recovery request on dev and sees the confirmation screen.

## Verification Steps

1. `npm run check:callables -- lecoursville-dev` exits `0` and prints thirteen `PASS` lines.
2. The `submitRecoveryRequest` preflight from the dev origin returns `204` with `access-control-allow-origin: https://lecoursville-dev.web.app`.
3. In a browser on the dev site, the recovery dialog submits to the confirmation screen with no CORS or `403` line in the console.
4. The hint-to-message gap measures at least `12px` in Chromium, WebKit, and Firefox.
5. `npm run e2e:gate` is green.
6. `npm run deploy:dev` completes and its probe step reports all callables public.

## Open Questions

- Why the Firebase CLI update path skipped `setIamPolicy` on the replaced services is unresolved. The probe makes the question safe to leave open, and the answer is only worth chasing if the binding drops again after a deploy that passes its own probe.
- Owner decision, not blocking: whether C-20261025-01 title casing should extend to dialog copy. The hint keeps sentence case until that is decided.
