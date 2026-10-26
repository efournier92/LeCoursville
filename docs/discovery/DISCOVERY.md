# Discovery

One line per finding, decision, assumption, trap, question, or outcome. Newest first. Evidence required.
Scope tokens: admin/security, admin/ui, build/perf, media/routing, rules/deploy

## Entries

- D-20261026-04 | 2026-10-26 | [outcome] | admin/ui | Shipped the 2026-10-26 feedback batch: calendar band, neutral transport, one-card upload page, admin card gaps, features redesign, queue restyle, mobile queue, families truth, empty-state voice, account gaps, wrapping top bars | docs/specs/2026-10-26_DevFeedbackBatch.md
- D-20261026-03 | 2026-10-26 | [trap] | admin/ui | An empty projected slot still creates a wrapped flex row: hide page-toolbar-content with :empty or every toolbar grows 38px under 600px | src/app/components/shared/page-toolbar/page-toolbar.component.scss:110
- D-20261026-02 | 2026-10-26 | [decision] | admin/security | Email is immutable: no self edit, no admin edit, no Admin SDK path. The users rule pins email on profile writes only, inside the data.exists branch, so delete and creation still pass | database.rules.json:158
- D-20261026-01 | 2026-10-26 | [decision] | build/perf | Dev builds use outputHashing all and index.html is no-cache; a stale dev bundle made fixed bugs look unfixed and hid the un-run migration | angular.json:118
- D-20261025-22 | 2026-10-25 | [trap] | build/perf | WebKit's default Tab policy skips non-text controls, so keyboard e2e asserts focusability and DOM order instead of Tab traversal | e2e/specs/media.spec.ts:552
- D-20261025-21 | 2026-10-25 | [trap] | media/routing | Replace uploads read only the batch-declared assets; a later `thumbnailBlob` race breaks resume | src/app/components/admin-media-upload-video/admin-media-upload-video.component.ts:524
- D-20261025-20 | 2026-10-25 | [trap] | rules/deploy | GoDaddy nameservers lag each other and resolvers cache stale empties, so verify TXT and MX at ns03 and ns04 before trusting dig | docs/2026-10-25_LeCoursville_Email_Configuration.md
- D-20261025-19 | 2026-10-25 | [decision] | rules/deploy | eric@lecoursville.com is on Zoho Mail Free: apex MX to Zoho, merged SPF, DKIM selector zoho, no IMAP, Resend sends app mail | docs/2026-10-25_LeCoursville_Email_Configuration.md
- D-20261025-18 | 2026-10-25 | [decision] | rules/deploy | Clan-to-family migration is additive first; `--delete-legacy` needs a same-run apply plus post-checks, and rules removal follows the data | scripts/migrations/clan-to-family.mjs:188
- D-20261025-17 | 2026-10-25 | [decision] | admin/security | Family is canonical: one `families` node, `Person.familyId`, `?family=`, a one-release `?clan=` alias; `clans` and rules stay for cutover | src/app/services/family.service.ts:10
- D-20261025-16 | 2026-10-25 | [trap] | rules/deploy | `cloudfunctions.net` 403 plus `CORS Missing Allow Origin` means Cloud Run lost `roles/run.invoker`, not a CORS bug | docs/specs/2026-10-25_CallableInvokerAndRecoverySpacing.md:26
- D-20261025-15 | 2026-10-25 | [trap] | admin/ui | Material dialog styles inject after the global sheet, so the shared dialog padding scale needs `!important` to override component defaults | src/styles.scss:153
- D-20261025-14 | 2026-10-25 | [decision] | admin/ui | Page title bar is a card with a host-owned 16px gap; the filter-row join needs a global rule because component scopes cannot reach sibling elements | src/styles.scss:344
- D-20261025-11 | 2026-10-25 | [trap] | media/routing | RTDB transaction mutators run against the local sync tree: cold paths see `null` and abort; `get()` never warms it, a held `value` listener does | functions/src/helpers.ts:148
- D-20261025-12 | 2026-10-25 | [decision] | build/perf | Targeted Angular specs run via `npx ng test --include <spec.ts>` (flag repeats per file); bare vitest lacks the TestBed setup | angular.json:172
- D-20261025-13 | 2026-10-25 | [trap] | build/perf | Spec-first red proofs on new Angular API fail as TS2339 compile bundles, not runtime assertions; that exit-1 is a valid red | src/app/services/media-upload.service.spec.ts:380
- D-20261025-08 | 2026-10-25 | [decision] | build/perf | Drop the redundant `src/polyfills.ts` entry: `zone.js` is already listed in `angular.json` and the file sat outside the spec program, so test builds warned | angular.json:47
- D-20261025-07 | 2026-10-25 | [trap] | build/perf | `calendar-utils` publishes a sourcemap pointing outside the package; `vitest-base.config.ts` strips the dangling `sourceMappingURL` so Vite stops warning | vitest-base.config.ts:15
- D-20261025-06 | 2026-10-25 | [trap] | build/perf | WebKit replace test timed out at 30s on stale `storage.bytes` under full-suite load, passed focused in 2.9s; rerun the gate, do not widen the wait | e2e/specs/media.spec.ts:564
- D-20261025-05 | 2026-10-25 | [outcome] | media/routing | Infra decisions captured: dev bucket without CDN, `disabled` sentinel, scoped dev IAM, secret checks, admin-to-super risk | design_specs/2026-10-25_media_infra_decisions.md
- D-20261023-06 | 2026-10-23 | [decision] | rules/deploy | Browserless rules tests run once in a rules project; callable behavior is owned by functions specs, never the x3 browser matrix | playwright.config.ts:25
- D-20261023-04 | 2026-10-23 | [trap] | build/perf | WebKit and Firefox expect-timeouts under full-suite load pass focused in 2s; diagnose with --repeat-each loops before widening any wait | e2e/specs/admin-content.spec.ts:84
- D-20261023-03 | 2026-10-23 | [trap] | build/perf | One shared emulators:exec bleeds Storage objects and emulator process state across browser projects; each browser project needs its own exec | scripts/e2e/gate.sh
- D-20261023-02 | 2026-10-23 | [decision] | rules/deploy | Prod storage rules execute once per gate through a throwaway config; current member and stranger boundaries are pinned as accepted risk | e2e/specs/storage-rules.spec.ts:41
- D-20261022-17 | 2026-10-22 | [trap] | media/routing | Playwright route.fetch on an XHR file PUT needs postData; losing the response is tested by failing the finalize callable instead | e2e/specs/media.spec.ts:1069
- D-20261022-16 | 2026-10-22 | [decision] | media/routing | Emulator binds no MEDIA secrets, so cold starts make zero Secret Manager requests; production binds all five | functions/src/create-media-upload.ts:41
- D-20261022-14 | 2026-10-22 | [outcome] | media/routing | Media upload pipeline shipped in five local commits; gate green with 217 e2e per browser, 501 unit, and 244 functions tests | docs/critique/2026-10-22_MediaUploadImplementation.md
- D-20261022-12 | 2026-10-22 | [decision] | media/routing | Media uploads use presigned S3 PUTs with server-derived keys, transactional finalize, multipart, and object-first delete | docs/specs/2026-10-22_MediaUploadPipeline.md
- D-20261022-13 | 2026-10-22 | [outcome] | media/routing | Media upload spec redteam converged with 31 findings; 28 addressed, 3 rejected with evidence, no human decisions left | docs/critique/2026-10-22_MediaUploadPipeline.md
- D-20261022-02 | 2026-10-22 | [outcome] | build/perf | Initial bundle 3.57MB raw/600kB transfer to 822.93kB raw/133kB; first load ~2.17MB with the Firebase chunk | `npx ng build --configuration=e2e`
- D-20261022-03 | 2026-10-22 | [decision] | admin/ui | All nine admin routes use a fixed 64px/56px title bar with filters in a separate fixed row | design_specs/2026-10-22_admin_consistency_contract.md
- D-20261022-04 | 2026-10-22 | [trap] | admin/ui | Material 22 emits a null --mat-slide-toggle-handle-width, pinning the thumb left until the handle width is set | src/app/components/admin-features/admin-features.component.scss:57
- D-20261022-05 | 2026-10-22 | [decision] | admin/security | roles/user is server-stamped at signup via callable plus trigger watchdog; clients can never write roles; revoke is the ban switch | functions/src/claim-member-role.ts:18
- D-20261022-06 | 2026-10-22 | [decision] | admin/security | Role grants and roleAudit are one super-only transaction with server-derived actor/time and last-super demotion rejection | functions/src/change-user-role.ts:85
- D-20261022-07 | 2026-10-22 | [decision] | media/routing | Media reads stay public so copied /media/explorer?id=<id> links play signed out; writes stay admin; clans require auth | src/app/app-routing.module.ts:81
- D-20261022-08 | 2026-10-22 | [trap] | media/routing | An auth guard on the media parent broke signed-out single-item links; e2e covers audio and video and fails if the guard returns | e2e/specs/media.spec.ts:22
- D-20261022-09 | 2026-10-22 | [decision] | rules/deploy | Database and storage rules deploy from the repo; the emulator keeps permissive storage.rules, production uses storage.rules.prod | scripts/deploy.sh
- D-20261022-10 | 2026-10-22 | [trap] | admin/security | An RTDB child .write:false cannot revoke a parent grant; enforce with parent conditions plus validate | database.rules.json:173
- D-20261022-11 | 2026-10-22 | [question] | rules/deploy | Production rules drift, storage public-create bypass of callable limits, and the signup migration still need ops sign-off | design_specs/2026-10-22_admin_open_questions.md
