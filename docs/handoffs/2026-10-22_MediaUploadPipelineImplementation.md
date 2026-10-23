# Handoff: Media Upload Pipeline Implementation

## Current State

Done. All four spec phases are implemented and committed locally on `feat/admin-facelift`. The tree is clean and nothing was pushed.

- Phase 0, prerequisites: not executable in this environment. The real AWS and Firebase values remain human-only.
- Phase 1, backend: complete at `51cfa163`.
- Phase 2, video UI and lifecycle: complete at `6671fe11`.
- Phase 3, audio album UI and zip: complete at `d9199ed1`.
- Phase 4, verification: complete at `c46d0beb`, with the full gate green on all three browsers.
- Redteam fixes: complete at `eb775507`; gate evidence persistence at `c46d0beb`.

Commits, oldest first:

- `51cfa163` Build the media upload backend and emulator sink
- `6671fe11` Ship the managed video upload flow
- `d9199ed1` Ship the managed audio album flow
- `eb775507` Harden the media pipeline after redteam
- `c46d0beb` Persist gate test evidence

Final gate evidence:

- `npm run e2e:gate`, exit 0.
- `.gate-results/chromium.json`, `.gate-results/webkit.json`, `.gate-results/firefox.json`: each 217 expected, 0 skipped, 0 unexpected, 0 flaky.
- `.gate-results/unit-tests.txt`: 80 files, 501 tests passed.
- `.gate-results/functions-tests.txt`: 19 files, 244 tests passed.
- `/tmp/final-gate8.log`: full command output.

Redteam ledger: `docs/critique/2026-10-22_MediaUploadImplementation.md`. Verdict: CONVERGED. 24 findings, 22 addressed, 2 rejected with evidence, no open high or medium technical findings, no human-only decisions derived from findings.

## Key Decisions

- Server derives every object key. The client sends names and sizes, never keys, URLs, or arbitrary content types. `functions/src/media/naming.ts` is authoritative.
- Finalize claims the batch in one transaction, releases the claim on failure, and writes records plus batch status in one root update. `functions/src/finalize-media-upload.ts`.
- Conditional writes are enforced for single and multipart creates and replaces. CompleteMultipartUpload carries `IfNoneMatch` for create and a live-object `IfMatch` for replace. `functions/src/media/storage-adapter.ts`.
- Create-mode video requires a thumbnail, so a record cannot point at a missing icon. Replace may omit it and reuses the existing icon.
- Cancel is ticketed-only. A replace cancel never deletes the live object keys. `functions/src/delete-media.ts`.
- Deletion removes and verifies objects first, then records, with `mediaDeletions` parent fields so the sweep and retry finish the record cleanup. `functions/src/delete-media.ts`, `functions/src/sweep-media-uploads.ts`.
- The emulator binds no MEDIA secrets, so cold starts make zero Secret Manager requests. Production binds all five. `functions/src/*-media*.ts`.
- Emulator media lives behind `emulatorMediaSink`. The functions emulator runs each function in its own worker, so the adapter reaches the sink over HTTP. `functions/src/emulator-media-sink.ts`.
- Audio keeps the legacy plus-for-space convention and uses `encodeURI` after substitution. Video uses the lowercase dash slug.
- Video resume persists typed title, date, sticky, hidden, and duration. A missing track or video after reload is recoverable by reselecting the file; bytes are never persisted client-side. Closed-tab resume of missing bytes is therefore a reselect, not a silent continuation.
- The gate now runs both test suites and persists per-browser JSON under `.gate-results/`, and functions install uses `npm ci` so the lockfile stays clean.

## Next Actions

1. Complete the real AWS and Firebase prerequisites below before any functions deploy.
2. Deploy functions to `lecoursville-dev` first and run one real video upload, one album upload, one replace, and one delete against the real bucket. Confirm CloudFront serves the new bytes after invalidation.
3. Run the manual checklist in `docs/specs/2026-10-22_MediaUploadPipeline.md` lines 1172 to 1183 against the real bucket.
4. Measure production cold-start p95 for `createMediaUpload`, `finalizeMediaUpload`, and `deleteMedia` after deploy. The local proxy measured module require p95 about 65 ms after the first run (first run 155 ms) and parallel AWS SDK dynamic import p95 about 44 ms. Those are not production p95 values.
5. Obtain the human deploy sign-off required by `AGENTS.md`. Do not run `scripts/deploy.sh` without typing `deploy` or setting `E2E_APPROVED=1` in the approved non-interactive path.

## Verify Commands

Run from `/Users/e/mnt/bnk/cs/lecoursville`:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git status --porcelain
npm --prefix functions run build
npm --prefix functions test
CI=true npm test -- --watch=false
npm run e2e:gate
```

Expected starting state: branch `feat/admin-facelift`, HEAD `c46d0beb`, clean tree, 244 functions tests, 501 unit tests, 217 e2e per browser.

## Real AWS Checklist

These were not executed. The emulator path works without them, but a production deploy is blocked until they exist.

- IAM policy: one Functions runtime user with the least-privilege policy at spec lines 196 to 233, scoped to the real bucket and distribution. No `s3:PutObjectAcl`.
- Bucket CORS: the JSON at spec lines 244 to 259, with both production origins and both confirmed dev origins, `GET`, `HEAD`, `PUT`, and the signed headers.
- Lifecycle rule: abort incomplete multipart uploads after one day.
- Five secrets in both `lecoursville` and `lecoursville-dev`: `MEDIA_AWS_REGION`, `MEDIA_AWS_ACCESS_KEY_ID`, `MEDIA_AWS_SECRET_ACCESS_KEY`, `MEDIA_S3_BUCKET`, `MEDIA_CLOUDFRONT_DISTRIBUTION_ID`. Binding an unset secret fails `firebase deploy`.
- Bucket capability: confirm a general-purpose bucket with conditional write support. If `If-None-Match` is unavailable, the fallback race is a human acceptance decision.
- Dev origins: confirm `lecoursville-dev.web.app` and `lecoursville-dev.firebaseapp.com` against the Firebase console and keep them in CORS.
- CloudFront invalidation budget: create is 0 paths, video replace is 2, video delete is 2, album delete is 3 wildcard paths, track delete is 1, cancel is 0. One album create plus delete is 3 paths, so the 1000 free paths per month cover about 333 album delete cycles. Album replace is not supported.
- Cold-start p95: measure in production after deploy, not from the local proxy above.

## Open Risks And Blockers

- No production or real-AWS verification was possible. Every gate result is emulator-only.
- Phase 0 prerequisites are unresolved by design. See the checklist above.
- Closed-tab resume of genuinely missing bytes requires reselecting the missing file. The gate proves missing-byte resume with reselect and lost-response resume without it. Persisting file bytes across a tab close was not implemented because the spec stores only batch metadata.
- The gate is sensitive to machine load. One run failed WebKit launch and page-load timeouts without a code change, then passed twice. Retries remain 0; a loaded machine can still produce an environmental red gate.
- The spec's e2e case 21 wording simulates a missing asset. The suite keeps that case as a lost-response case and adds a separate true missing-byte reselect case in `e2e/specs/media.spec.ts`.
- `npm run e2e:gate` takes about 10 minutes on this machine and writes its evidence under `.gate-results/`, which is gitignored.
