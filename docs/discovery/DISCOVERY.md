# Discovery

One line per finding, decision, assumption, trap, question, or outcome. Newest first. Evidence required.
Scope tokens: admin/security, admin/ui, build/perf, media/routing, rules/deploy

## Entries

- D-20261022-12 | 2026-10-22 | [decision] | media/routing | Media uploads use presigned S3 PUTs with server-derived keys, transactional finalize, multipart, and object-first delete | docs/specs/2026-10-22_MediaUploadPipeline.md
- D-20261022-13 | 2026-10-22 | [outcome] | media/routing | Media upload spec redteam converged with 31 findings; 28 addressed, 3 rejected with evidence, no human decisions left | docs/critique/2026-10-22_MediaUploadPipeline.md
- D-20261022-01 | 2026-10-22 | [outcome] | admin/ui | Full gate green after the final wave: 196 e2e per browser and 421 unit tests | `npm run e2e:gate`
- D-20261022-02 | 2026-10-22 | [outcome] | build/perf | Initial bundle 3.57MB raw/600kB transfer to 822.93kB raw/133kB; first load ~2.17MB with the Firebase chunk | `npx ng build --configuration=e2e`
- D-20261022-03 | 2026-10-22 | [decision] | admin/ui | All nine admin routes use a fixed 64px/56px title bar with filters in a separate fixed row | design_specs/2026-10-22_admin_consistency_contract.md
- D-20261022-04 | 2026-10-22 | [trap] | admin/ui | Material 22 emits a null --mat-slide-toggle-handle-width, pinning the thumb left until the handle width is set | src/app/components/admin-features/admin-features.component.scss:57
- D-20261022-05 | 2026-10-22 | [decision] | admin/security | roles/user is server-stamped at signup via callable plus trigger watchdog; clients can never write roles; revoke is the ban switch | functions/src/claim-member-role.ts
- D-20261022-06 | 2026-10-22 | [decision] | admin/security | Role grants and roleAudit are one super-only transaction with server-derived actor/time and last-super demotion rejection | functions/src/change-user-role.ts
- D-20261022-07 | 2026-10-22 | [decision] | media/routing | Media reads stay public so copied /media/explorer?id=<id> links play signed out; writes stay admin; clans require auth | src/app/app-routing.module.ts:81
- D-20261022-08 | 2026-10-22 | [trap] | media/routing | An auth guard on the media parent broke signed-out single-item links; e2e covers audio and video and fails if the guard returns | e2e/specs/media.spec.ts:22
- D-20261022-09 | 2026-10-22 | [decision] | rules/deploy | Database and storage rules deploy from the repo; the emulator keeps permissive storage.rules, production uses storage.rules.prod | scripts/deploy.sh
- D-20261022-10 | 2026-10-22 | [trap] | admin/security | An RTDB child .write:false cannot revoke a parent grant; enforce with parent conditions plus validate | database.rules.json:173
- D-20261022-11 | 2026-10-22 | [question] | rules/deploy | Production rules drift, storage public-create bypass of callable limits, and the signup migration still need ops sign-off | design_specs/2026-10-22_admin_open_questions.md
