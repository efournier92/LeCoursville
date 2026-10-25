# Pre-Merge Walkthrough

- Date: 2026-10-24
- Branch: feat/admin-facelift
- Base: master at aca0acb6, fast-forward possible
- Scope: decisions, pre-merge checks, the merge, and the deploy work that follows
- Driver: any agent can run this file interactively

## Driver Prompt

Paste this to the next agent:

Read /Users/e/mnt/bnk/cs/lecoursville/design_specs/2026-10-24_premerge_walkthrough.md and drive it interactively. Present one step at a time, wait for done, skip, or stop, record each result in the Progress table, do not run HUMAN steps, and do not run the merge step without explicit approval.

## Why This File Exists

The branch review on 2026-10-24 found the work complete and the human decisions still open.
This file turns that review into an ordered walkthrough.
Each step is atomic and has one owner.
The driving agent presents one step at a time and records the result before moving on.

## How To Drive This

1. Read this whole file before starting.
2. Present exactly one step per message.
3. State the step id, the owner, the goal, and the exact action.
4. For a HUMAN step, wait for the user to act and report the result.
5. For an AGENT step, show the command or patch, run it only after approval, and paste the result.
6. End every message with one of: `done`, `skip`, `stop`, or a question.
7. Do not batch steps, do not preview later steps, and do not proceed on silence.
8. Record the outcome in the Progress table before moving to the next step.
9. If a step fails, stop and present its failure branch. Do not improvise a fix.
10. Stop before the merge step unless the user explicitly says `merge`.
11. Follow the Progress table for execution order. H4 and H5 sit in Part 5 because they need a deployed environment, even though their ids are lower than H7.

## Current State

| Fact | Value |
|---|---|
| Branch | feat/admin-facelift |
| Commits ahead of master | 28 |
| Merge base | aca0acb6, same as master tip |
| Working tree | clean before this file was added |
| Unit tests | 92 files, 573 passed on 2026-10-24 |
| Functions tests | 23 files, 277 passed on 2026-10-24 |
| Production build | pass, 986.78 kB initial raw, 171.78 kB transfer |
| Gate, Chromium and WebKit | 187 passed each on 2026-10-24 |
| Gate, Firefox | one flake on 2026-10-24, passed focused reruns |
| Push or deploy | none |

## Progress

Update this table as each step completes.
Use `pending`, `done`, `skipped`, or `failed`.

| Step | Owner | Status | Evidence |
|---|---|---|---|
| D1 | Human | done | Option 1: proceed to M1, accept its result, log the Firefox flake as a DISCOVERY follow-up. Final gate evidence lands with M1 |
| D2 | Human | done | Option 1: fast-forward, keep all 28 commits |
| D3 | Human | done | Option 1: add the replace guard in A1 (`verifyObject` deletes only when `mode === "create"`) |
| D4 | Human | done | Option 1: document the compensating control (immutable, super-only create) and defer the server-stamp callable |
| A1 | Agent | done | `verifyObject` takes `mode`; delete gated to `create`; call site passes `batch.mode`. New test `rejects a foreign object in replace mode without deleting it`. 278/278 functions tests; red proof: test fails on HEAD code at `expect(adapter.deleteMany).not.toHaveBeenCalled()` |
| A2 | Agent | done | Removed `feature-flags.service.ts` debug log; `admin-media.component.ts` `onerror` now uses `console.error` so read failures stay diagnosable. 573/573 unit tests, 92 files |
| A3 | Agent | done | Rules bullet moved from Open Risks to Repo Notes with `deploy.sh` line refs; media handoff Phase 4 scoped to emulator half with H3/H4/H5 deferral; `AFQ2-04` gains the D4 deferral note. Diff is 3 files, 4 insertions, 3 deletions |
| H1 | Human | done | Snapshots saved in `database-rules/2026-10-25/`: `before.json`, `after.json`, `before-storage.rules`, `after-storage.rules`, hashes and diff in `database-rules/README.md`. Prod still runs the 2026-10-04 ruleset; storage is currently open read/write on all paths |
| H2 | Human | pending | |
| H3.1 | Human | done | CLI installed 2026-10-25, caller `lecoursville-admin`, region `us-east-1`, agent MCP prompt declined |
| H3.2 | Human | done | Policy `lecoursville-media-runtime` attached to user `lecoursville-media-runtime`; one Active key `REDACTED-KEY-ID` (secret not recorded). Bucket `lecoursville`, distribution `EQYPPDTINXTD` |
| H3.3 | Human | done | Bucket had no prior CORS. Applied 4 origins, GET/HEAD/PUT, signed headers; read back matches. CLI needs `{"CORSRules": [...]}`, not a bare array |
| H3.4 | Human | done | No prior lifecycle config. Applied `abort-incomplete-multipart-uploads`, `DaysAfterInitiation: 1`, all prefixes; read back matches |
| H3.5 | Human | done | Conditional put enforced (second put returned `PreconditionFailed`); metadata `upload-batch=probe` persisted; probe deleted |
| H3.6 | Human | done | Ten secrets set (5 per project). Secret key rotated to `REDACTED-KEY-ID` after a 46-char bad paste; old key deleted. Signature test passes as `lecoursville-media-runtime`; least-privilege deny confirmed outside `Video/*`, `Music/Albums/*`, and on IAM; CloudFront `GetInvalidation` authorized |
| H3.7 | Human | done | All four origins return 200 and all four are in bucket CORS. Dev site `lecoursville-dev` is the default hosting site; prod hosts `lecoursville` under the same project id |
| H3.8 | Human + Agent | done | Dev media isolated: bucket `lecoursville-media-dev` with dev-only CORS, lifecycle abort plus 30-day expiry, public GET on two prefixes, user `lecoursville-media-runtime-dev` (no CloudFront grants), and dev secrets moved to that bucket with distribution `disabled`. Verified by signature, public GET, prod-bucket deny, CloudFront deny |
| H6 | Human | pending | |
| M1 | Agent | pending | |
| M2 | Human | pending | |
| M3 | Human | pending | |
| P1 | Human | pending | |
| P2 | Human | pending | |
| H7 | Human | pending | |
| H4 | Human | pending | |
| H5 | Human | pending | |

## Part 1: Decisions

### D1: Gate Status

Owner: HUMAN.
Goal: decide how to treat the Firefox flake before merge.
Why it matters: `docs/testing/TEST_POLICY.md` says the gate must be green with no flake, and `scripts/deploy.sh` blocks a deploy on a red gate.
Evidence: the 2026-10-24 review saw one Firefox failure in `e2e/specs/account-recovery.spec.ts:461`, then passing focused reruns, then a degraded full run with mass timeouts. The flake does not reproduce in isolation.
Reproduction command:

```bash
firebase emulators:exec --project lecoursville-dev --only auth,database,storage,hosting,functions "node scripts/e2e/seed.mjs && npx playwright test --project=firefox e2e/specs/account-recovery.spec.ts"
```

Options:

1. Proceed to M1 and accept its result, then log the flake in `docs/discovery/DISCOVERY.md` as a follow-up.
2. Stop and fix the flake before merge.
3. Merge with the gate treated as deploy-blocking only.

Recommendation: option 1, because M1 runs the gate on an idle machine and the flake is load-sensitive.
Ask: which option?
Record: the option and the final gate evidence.

### D2: Merge Shape

Owner: HUMAN.
Goal: choose how the 28 commits land on master.
Why it matters: the commit trail and the ledgers are the review evidence.
Options:

1. Fast-forward and keep all 28 commits (recommended).
2. Merge commit.
3. Squash into one commit.

Recommendation: fast-forward.
Ask: which shape?
Record: the choice.

### D3: Replace Guard

Owner: HUMAN.
Goal: decide whether to add the replace-mode guard to `verifyObject`.
Why it matters: in replace mode the presigned PUT targets the live key, and finalize deletes an object whose `upload-batch` metadata does not match. The normal UI never calls finalize without a completed PUT, so reachability is narrow. The prior redteam rejected this as `C-20261022-08`.
Options:

1. Add the guard now, run by A1 (recommended).
2. Accept the documented risk.

Recommendation: add the guard.
Ask: guard or accept?
Record: the choice.

### D4: Feature Flag Audit

Owner: HUMAN.
Goal: decide how to close the gap between `AFQ2-04` and the code.
Why it matters: `AFQ2-04` says server-stamp `roleAudit` and `featureFlagAudit`. `roleAudit` is server-stamped. `featureFlagAudit` is still written by the client under a super-only, create-only rule.
Options:

1. Document the compensating control and defer the callable (recommended).
2. Build the callable before merge.

Recommendation: option 1.
Ask: document or build?
Record: the choice.

## Part 2: Pre-Merge Fixes

### A1: Add The Replace Guard

Owner: AGENT, with approval.
Trigger: D3 option 1.
Goal: stop `verifyObject` from deleting an object in replace mode.
File: `functions/src/finalize-media-upload.ts`.
Patch intent: pass `batch.mode` into `verifyObject`, and delete only when `mode === "create"`.
In replace mode, return `uploadInvalid` without deleting.
Test intent: add a functions test with `mode: "replace"`, one single asset, and a HEAD result whose `upload-batch` is foreign. Assert the call rejects and `adapter.deleteMany` is not called.
Commands:

```bash
npm --prefix functions test
```

Expected: 278 functions tests pass.
Record: the diff summary and the test count.
Failure branch: if the test shape is unclear, stop and show the existing `rejects a missing, wrong-size, wrong-type, or foreign single object` test.

### A2: Remove Debug Logs

Owner: AGENT, with approval.
Goal: remove two leftover debug logs.
Files and lines:

- `src/app/components/admin-media/admin-media.component.ts:66`
- `src/app/services/feature-flags.service.ts:59`

Leave `functions/src/sweep-media-uploads.ts:200` in place, because it is intentional sweep logging.
Command:

```bash
CI=true npm test -- --watch=false
```

Expected: 573 unit tests pass.
Record: the diff summary.

### A3: Fix Doc Drift

Owner: AGENT, with approval.
Goal: make the handoff claims match the tree.
Edits:

- `design_specs/2026-10-22_admin_consistency_handoff.md`: move the database and storage rules out of Open Risks, because `scripts/deploy.sh` now deploys them.
- `docs/handoffs/2026-10-22_MediaUploadPipelineImplementation.md`: say Phase 4 is complete for the emulator half and deferred for the real-bucket half.
- If D4 option 1, add a note under `AFQ2-04` in `design_specs/2026-10-22_admin_open_questions.md`.

Command:

```bash
git -C /Users/e/mnt/bnk/cs/lecoursville diff -- design_specs docs/handoffs
```

Expected: only the intended wording changes.
Record: the diff summary.

## Part 3: Human Verification Before Deploy

### H1: Snapshot Production Rules

Owner: HUMAN.
Goal: keep a copy of the rules production runs today before the repo rules overwrite them.
Why it matters: `scripts/deploy.sh` now deploys `database.rules.json` and `storage.rules.prod` over the console.
Steps:

1. Open the Firebase console for `lecoursville`.
2. Open Realtime Database, then Rules, and copy the full JSON to `/tmp/prod-db-rules-before-2026-10-24.json`.
3. Open Storage, then Rules, and copy the full text to `/tmp/prod-storage-rules-before-2026-10-24.json`.
4. Diff the database copy against `database.rules.json` by eye or with a JSON-aware diff.
5. Write one line for each material difference.

Expected: a saved copy of both rule sets and a short difference list.
Record: the file paths and the difference count.
Failure branch: if the console is unavailable, stop. Do not deploy rules without a snapshot.

### H2: Verify `roles/user` Coverage

Owner: HUMAN.
Goal: confirm every production account can still read after the new rules land.
Why it matters: every authenticated read gates on `roles/user`, and the rules now stop clients from writing roles.
Commands, run from the repository root:

```bash
firebase database:get /users --project lecoursville --pretty -o /tmp/prod-users.json
node -e "const u=require('/tmp/prod-users.json')??{}; const bad=Object.entries(u).filter(([,v])=>v?.roles?.user!==true); console.log('missing roles/user:', bad.length); for (const [id] of bad) console.log(id)"
```

Expected: `missing roles/user: 0`.
If not zero: stop and backfill those accounts before the rules deploy.
Record: the count, with ids redacted.

### H3: AWS Prerequisites

Owner: HUMAN.
Goal: make the real bucket ready for the media pipeline.
Run the sub-steps in order.
Record each one.

#### H3.1: AWS Access

Owner: HUMAN.
Goal: get a working AWS CLI.
Commands:

```bash
aws --version
aws sts get-caller-identity
```

If the CLI is missing: `brew install awscli`, then `aws configure`.
Expected: a caller identity for an account that can manage IAM, S3, and CloudFront.

#### H3.2: IAM Policy

Owner: HUMAN.
Goal: create the least-privilege runtime identity.
Steps:

1. Copy the policy JSON from the AWS IAM section of `docs/specs/2026-10-22_MediaUploadPipeline.md` into `/tmp/media-iam-policy.json`.
2. Replace the bucket, account, and distribution placeholders.
3. Create the policy, user, and access key:

```bash
aws iam create-policy --policy-name lecoursville-media-runtime --policy-document file:///tmp/media-iam-policy.json
aws iam create-user --user-name lecoursville-media-runtime
aws iam attach-user-policy --user-name lecoursville-media-runtime --policy-arn <policy-arn>
aws iam create-access-key --user-name lecoursville-media-runtime
```

Expected: a policy ARN and one access key pair.
Record: the ARN and the key id. Never paste the secret key into chat or a file.
Failure branch: if the policy grants `s3:PutObjectAcl`, remove it and re-apply.

#### H3.3: Bucket CORS

Owner: HUMAN.
Goal: allow browser uploads from the four origins.
Steps:

1. Copy the CORS JSON from the Bucket CORS section of the spec into `/tmp/media-cors.json`.
2. Confirm all four origins: `https://lecoursville.com`, `https://lecoursville.firebaseapp.com`, `https://lecoursville-dev.web.app`, and `https://lecoursville-dev.firebaseapp.com`.
3. Apply and read back:

```bash
aws s3api put-bucket-cors --bucket <bucket> --cors-configuration file:///tmp/media-cors.json
aws s3api get-bucket-cors --bucket <bucket>
```

Expected: the four origins, the `GET`, `HEAD`, and `PUT` methods, and the signed headers.
Record: the bucket name and the applied origins.

#### H3.4: Lifecycle Rule

Owner: HUMAN.
Goal: abort incomplete multipart uploads after one day.
Steps:

1. Create `/tmp/media-lifecycle.json` with an `AbortIncompleteMultipartUpload` rule at `DaysAfterInitiation: 1`.
2. Apply and read back:

```bash
aws s3api put-bucket-lifecycle-configuration --bucket <bucket> --lifecycle-configuration file:///tmp/media-lifecycle.json
aws s3api get-bucket-lifecycle-configuration --bucket <bucket>
```

Record: the rule summary.

#### H3.5: Capability Probe

Owner: HUMAN.
Goal: prove conditional writes and metadata persistence on the real bucket.
Steps:

1. Write a probe with a condition and metadata:

```bash
printf 'probe' > /tmp/probe.txt
aws s3api put-object --bucket <bucket> --key __capability_probe.txt --body /tmp/probe.txt --if-none-match '*' --metadata upload-batch=probe
aws s3api put-object --bucket <bucket> --key __capability_probe.txt --body /tmp/probe.txt --if-none-match '*'
```

Expected: the first call succeeds and the second returns `412 PreconditionFailed`.
2. Confirm the metadata:

```bash
aws s3api head-object --bucket <bucket> --key __capability_probe.txt --query 'Metadata'
```

Expected: `{"upload-batch": "probe"}`.
3. Delete the probe:

```bash
aws s3api delete-object --bucket <bucket> --key __capability_probe.txt
```

Record: pass or fail for both checks.
Failure branch: if the second put succeeds or the metadata is missing, stop. The pipeline relies on both.

#### H3.6: Five Secrets In Both Projects

Owner: HUMAN.
Goal: bind all five media secrets.
Commands, run once per project and once per secret:

```bash
firebase functions:secrets:set MEDIA_AWS_REGION --project lecoursville-dev
firebase functions:secrets:set MEDIA_AWS_ACCESS_KEY_ID --project lecoursville-dev
firebase functions:secrets:set MEDIA_AWS_SECRET_ACCESS_KEY --project lecoursville-dev
firebase functions:secrets:set MEDIA_S3_BUCKET --project lecoursville-dev
firebase functions:secrets:set MEDIA_CLOUDFRONT_DISTRIBUTION_ID --project lecoursville-dev
```

Repeat with `--project lecoursville`.
Expected: ten secrets present, five per project.
Record: the secret names and projects, never the values.
Failure branch: an unset secret fails `firebase deploy`.

#### H3.7: Dev Origins

Owner: HUMAN.
Goal: confirm both dev origins in CORS and in the Firebase console.
Steps:

1. Confirm `lecoursville-dev.web.app` and `lecoursville-dev.firebaseapp.com` are on the dev project.
2. Confirm both appear in the bucket CORS JSON.

Record: confirmed or the missing origin.

#### H3.8: Dev Media Isolation

Owner: HUMAN for the AWS resources, AGENT for the code.

Goal: stop dev media from living in the production bucket, without adding a dev CDN.

Why: dev and prod shared one bucket, one distribution, and one runtime key. Keys are derived from user-supplied storage names (`functions/src/media/naming.ts:90-111`), so a dev upload or delete could overwrite or remove a live production object, and dev invalidations spent the production 1000-path monthly budget.

What was built on 2026-10-25:

- Bucket `lecoursville-media-dev` in `us-east-1`, CORS limited to the two dev origins, lifecycle abort at 1 day plus 30-day expiry on `Video/` and `Music/Albums/`, and public `s3:GetObject` on those two prefixes only.
- IAM policy `lecoursville-media-runtime-dev` and user of the same name, scoped to the dev bucket, with no CloudFront actions. One Active key.
- Code: `hasMediaCdn()` and the CDN-aware `mediaBaseUrl()` in `functions/src/media/config.ts`, `finalize-media-upload.ts` passing the three secrets, and `storage-adapter.ts` skipping invalidation when the CDN is disabled. Only the literal `disabled` disables the CDN, so a missing secret cannot repoint production at the raw bucket endpoint.
- Dev secrets: `MEDIA_S3_BUCKET=lecoursville-media-dev`, `MEDIA_CLOUDFRONT_DISTRIBUTION_ID=disabled`, and the dev key id and secret. Production secrets unchanged.

Record: `functions` suite 281 passing after the change.

### H6: Accepted Risks

Owner: HUMAN.
Goal: confirm the risks that ship with this branch.
Confirm one line at a time:

1. Production Storage allows public create under `userUploads/**`.
2. Any signed-in user can create and delete objects under `photos` and `videoScreenshots`.
3. Media reads are public, including records with `isHidden: true`.
4. The public upload path accepts non-image files today.
5. The CloudFront budget is about 333 album delete cycles per month.

Expected: an explicit yes or no for each.
Record: the five answers. A no means stop and open a follow-up.

## Part 4: Merge

### M1: Final Gate

Owner: AGENT.
Goal: produce one green gate on an idle machine.
Precondition: no other heavy process is running.
Command:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
npm run e2e:gate
```

Expected: 7 storage-prod, 11 rules, 187 per browser, 573 unit, 277 functions, 0 skipped, 0 flaky.
Record: the five counts and the `.gate-results` file timestamps.
Failure branch: capture the failing spec and the trace. Do not retry more than once without a diagnosis.

### M2: Merge To Master

Owner: HUMAN.
Goal: land the branch as a fast-forward.
Prerequisite: D2 chosen and M1 green.
Commands:

```bash
git -C /Users/e/mnt/bnk/cs/lecoursville fetch origin
git -C /Users/e/mnt/bnk/cs/lecoursville merge-base --is-ancestor master feat/admin-facelift
git -C /Users/e/mnt/bnk/cs/lecoursville checkout master
git -C /Users/e/mnt/bnk/cs/lecoursville merge --ff-only feat/admin-facelift
git -C /Users/e/mnt/bnk/cs/lecoursville log --oneline -3
```

Expected: master moves to the branch tip with no merge commit.
Failure branch: if master has moved, stop and choose rebase or merge.

### M3: Push

Owner: HUMAN.
Goal: publish master.
Command:

```bash
git -C /Users/e/mnt/bnk/cs/lecoursville push origin master
```

Expected: `origin/master` matches local master.
Record: the pushed commit.
Do not delete `feat/admin-facelift` until the deploy is green.

## Part 5: After Merge

### P1: Deploy To Dev

Owner: HUMAN.
Goal: exercise the real pipeline on dev first.
Command, run from the repository root:

```bash
bash scripts/deploy.sh dev
```

Expected: gate green, dev bundle built, and hosting, functions, database rules, and storage rules deployed.
Record: the deploy result.

### P2: Dev Smoke And Rules Check

Owner: HUMAN.
Goal: confirm the app and the rules behave on dev.
Steps:

1. Run one real upload, replace, and delete on dev.
2. Confirm an owner alert reaches `eric@lecoursville.com`.
3. Confirm a non-super account is denied on `/admin`.
4. Confirm a signed-out copy of a media link plays.

Record: pass or fail per check.

### H7: Deploy Sign-Off

Owner: HUMAN.
Goal: give the explicit sign-off that `scripts/deploy.sh` requires.
Steps:

1. Confirm M1 is green, H1 through H6 are done, and P1 and P2 are green.
2. Run from the repository root:

```bash
bash scripts/deploy.sh prod
```

3. Type `deploy` when prompted, or set `E2E_APPROVED=1` in an approved non-interactive shell.

Expected: the gate passes, the production build runs, and the deploy proceeds.
Record: the deploy result and the tag.
Failure branch: a red gate aborts the deploy. Do not bypass it.

### H4: Real-Bucket Smoke

Owner: HUMAN.
Goal: prove the pipeline against the real production bucket, not the emulator.
Prerequisite: H7 deployed to production.
Steps:

1. Upload one real MP4 with a thumbnail.
2. Play it from the admin list and from a copied `/media/explorer?id=<id>` link signed out.
3. Replace the file with the same storage name, once with a new thumbnail and once without.
4. Confirm the new bytes are served after invalidation.
5. Upload one real album with embedded art, play it, and download the zip.
6. Delete the video and the album.
7. Confirm every object is gone from the bucket.
8. Record the invalidation path count for one create, one replace, and one album delete.

Expected: all flows work and stay within the 1000 path monthly budget.
Record: pass or fail per flow and the path counts.

### H5: Production Cold-Start P95

Owner: HUMAN.
Goal: measure the three media callables in production.
Steps:

1. Open Cloud Monitoring, then Metrics Explorer.
2. Select `cloudfunctions.googleapis.com/function/execution_times`.
3. Filter by `function_name` for `createMediaUpload`, `finalizeMediaUpload`, and `deleteMedia`.
4. Set the aligner to the 95th percentile and the window to one day.
5. Record the three values after at least 20 real calls each.

Expected: values recorded. The local proxy numbers are not production numbers.
Record: the three p95 values.

## Definition Of Done

The walkthrough is done when:

- D1 through D4 are recorded.
- A1 through A3 are either applied or explicitly skipped.
- H1 and H2 have evidence.
- M1 is green.
- M2 and M3 are complete or explicitly deferred.
- H7, P1, and P2 are scheduled with a named owner.
