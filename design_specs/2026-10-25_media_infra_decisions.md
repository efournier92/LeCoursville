# Media Infrastructure Decisions | 2026-10-25

Summary: durable record of the storage, credential, and deploy decisions made while wiring the media upload pipeline's real AWS infrastructure for `lecoursville-dev` and `lecoursville`. Read this before touching media secrets, buckets, or the deploy script.

## Scope

- Repo: `/Users/e/mnt/bnk/cs/lecoursville`, branch `feat/admin-facelift` merged fast-forward into `master` at `af6df3e7`.
- Window: the session of 2026-10-25 that completed `H3` (AWS prerequisites) and added `H3.8` (dev media isolation) from `design_specs/2026-10-24_premerge_walkthrough.md`.
- Two Firebase projects, `lecoursville-dev` and `lecoursville`, share one AWS account and the `us-east-1` region. Account and project numbers are deliberately omitted here: this repo is public, the project ids already live in `.firebaserc`, and the numbers buy a reader nothing.

## Findings

- Production and dev originally shared one bucket, one CloudFront distribution, one runtime IAM key, and one base URL.
  - Keys are derived from user-supplied names: `Video/<storage-name>.mp4` at `functions/src/media/naming.ts:91`, album paths at `:104-112`.
  - So a dev upload or a dev replace targets the same object namespace as production, and `delete-media` removes by prefix (`functions/src/delete-media.ts:178-188`).
  - Dev invalidations spent the production distribution's 1000-path monthly budget, and dev records resolved through `https://assets.lecoursville.com`.
- Production bucket `lecoursville` was public-read on the entire bucket: policy `PublicReadGetObject`, `s3:GetObject` on `arn:aws:s3:::lecoursville/*`, all four public-access-block flags `false`.
- Production Storage rules were wide open: `allow read, write;` on every path, no authentication (captured in `database-rules/2026-10-25/before-storage.rules`).
- Production RTDB ran the 2026-10-04 ruleset, not the reviewed 2026-10-10 one: `before.json` hashes to `94c0fb91...c46470`, the same sha256 the README records for `2026-10-04/after.json`.
- No CI exists: no `.github/`, no workflow files, and the only deploy path is `scripts/deploy.sh`, so a push to `master` never deploys.
- `scripts/deploy.sh` deploys `database.rules.json` and `storage.rules.prod` on both targets (`:39`, `:46`, `:53`, `:60`, storage via `:13-31`), which retires the old "rules are console-managed" claim.

## Decisions And Why

- **Dev gets its own bucket, not a prefix.** `lecoursville-media-dev` in `us-east-1`. The bucket is already parameterized by the `MEDIA_S3_BUCKET` secret, so isolation is a value swap; a prefix would have touched `naming.ts`, the prefix arithmetic in `delete-media.ts`, IAM conditions, invalidation paths, and the documented layout.
- **No dev CDN.** The alternative was a second distribution with OAC. Declined to keep the dev surface small; the consequence accepted is that dev objects are public at the S3 REST endpoint.
- **One sentinel controls the CDN, and a missing value keeps it.** `MEDIA_CLOUDFRONT_DISTRIBUTION_ID=disabled` makes `hasMediaCdn()` false (`functions/src/media/config.ts:41`), which switches `mediaBaseUrl()` to `https://<bucket>.s3.<region>.amazonaws.com` and makes invalidation a no-op (`functions/src/media/storage-adapter.ts:337`). Only the literal sentinel disables it, so a secret that fails to bind can never repoint production records at the raw bucket endpoint. Rejected alternative: a sixth `MEDIA_BASE_URL` secret, which would need binding in seven places for the same result.
- **Dev has its own IAM identity.** User and policy `lecoursville-media-runtime-dev`, scoped to the dev bucket prefixes, with no `cloudfront:*` grants, so a dev compromise cannot delete production media.
- **Dev bucket CORS lists only the two dev origins.** Production pages cannot write into dev storage. Production keeps its four origins.
- **Public read is scoped to two prefixes on dev** (`Video/*`, `Music/Albums/*`), narrower than production's whole-bucket grant, with no list, write, or delete.
- **Dev objects expire after 30 days**, alongside the 1-day abort of incomplete multipart uploads, so the public test surface self-clears.
- **Replace-mode deletes were guarded.** `verifyObject()` deletes only when `mode === "create"` (`functions/src/finalize-media-upload.ts:178`), so a foreign `upload-batch` in replace mode rejects without removing the live object.
- **The pre-deploy rules snapshot is committed, not staged in `/tmp`.** `database-rules/2026-10-25/` holds `before.json`, `after.json`, `before-storage.rules`, `after-storage.rules`, hashed and summarized in `database-rules/README.md`.
- **Merge shape: fast-forward.** All 35 commits preserved on `master`; no merge commit, no squash.
- **The Firefox flake is accepted, not fixed.** Proceed with the family of gate runs and log it as a discovery follow-up rather than chase a load-sensitive failure.
- **`master` is not renamed to `main` yet.** Deferred until after the production deploy, because `scripts/deploy.sh:85-95` hard-codes `master` and six README image URLs are pinned to the `master` path; both must change in the same commit as the branch move.

## Traps And Non-Obvious Behavior

- `aws s3api put-bucket-cors` needs `{"CORSRules": [...]}`. A bare rules array fails with `ParamValidation: Invalid JSON`, which reads like malformed JSON rather than wrong shape.
- An IAM secret access key is exactly 40 characters and is a different value from the access key id on the same screen. Two bad pastes produced a 46-character value and an id-in-the-secret-field; both were only caught by verifying instead of trusting a successful set.
- A stored secret can be verified without printing it: sign `sts get-caller-identity` with the values pulled from `firebase functions:secrets:access`, and compare `sha256` of each value across projects.
- `verifyObject` takes its mode as a fourth parameter, and the guard plus the `mediaBaseUrl` call site fall inside one diff hunk, so they cannot be split into separate commits without leaving a commit that does not compile.
- `scripts/deploy.sh` runs `firebase use`, which rewrites the tracked `.firebaserc` default project. A dev deploy leaves it pointing at `lecoursville-dev`.
- Production deploys hard-fail unless `HEAD` is `master` (`scripts/deploy.sh:82-90`); dev only warns.
- `deploy.sh` requires an interactive `deploy` at the prompt after a green gate, or `E2E_APPROVED=1` in an approved non-interactive shell. Never set that variable on the user's behalf.
- The rules deploy narrows four reads and two writes from `admin` to `super` (`adminAlerts`, `config/adminAlertRecipients`, `recoveryRequests`, `recoveryAudit`, plus writes to `features` and `promotedRoute`), narrows `users/.read` to super with self-read retained, and narrows `clans/.read` to signed-in. Any non-super admin loses those screens the moment production takes the new rules.

## Evidence And Artifacts

- `firebase functions:secrets:access` across both projects: dev and prod now differ on bucket, distribution, key id, and secret; values are 40 characters where they should be.
- Signature test with the dev key returns the `lecoursville-media-runtime-dev` user ARN.
- Put to `Video/__probe.txt` in the dev bucket succeeds and a public GET on `https://lecoursville-media-dev.s3.us-east-1.amazonaws.com/Video/__probe.txt` returns the body; the same put to the production bucket returns `AccessDenied`; `cloudfront:GetInvalidation` on the production distribution returns `AccessDenied`.
- Conditional-write probe on the production bucket: second `--if-none-match '*'` put returns `PreconditionFailed`, and `upload-batch` metadata persists.
- Functions suite `281 passed` and `tsc` clean after the config change; unit suite `573 passed` after the log cleanup.
- `database-rules/2026-10-25/` plus `database-rules/README.md` carry the full production diff and sha256 values.
- Discovery entries `D-20261025-01` through `-04` in `docs/discovery/DISCOVERY.md`.

## Open Questions

- `H2` was never run: production `roles/user` coverage is unverified, and no one has counted production admins that are not `super`.
- `H4` (real-bucket smoke) and `H5` (production cold-start p95) remain undone by design.
- The Firefox flake from `D1` is still unlogged as a discovery follow-up until the gate supplies real evidence.
- Old secret versions from the two bad pastes still exist in Secret Manager. `gcloud` is not installed, so pruning needs the console.
- Whether a non-super admin exists in either project is unknown; that determines whether the admin-to-super narrowing is safe to ship.

## Next Actions

- Run `bash scripts/deploy.sh dev` and complete the `P2` dev smoke with `dev-` prefixed storage names.
- Then `H7` production deploy with sign-off, and `H4`/`H5` against the real bucket.
- After the production tag, do the `master` to `main` rename as one change with `deploy.sh` and the README URLs.
- Continue from `design_specs/2026-10-24_premerge_walkthrough.md`; it owns the step order and the Progress table.
