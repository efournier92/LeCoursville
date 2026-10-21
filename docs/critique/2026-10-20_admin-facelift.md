# Critique Ledger: Admin Facelift

- Goal: every admin surface is coherent, super-gated, responsive, covered by tests, and visually converged.
- Started: 2026-10-20
- Branch: feat/admin-facelift

## Findings
- C-20261020-01 | 2026-10-20 | product | high | high | addressed | Media audio/video album delete is an unconfirmed single click | `src/app/components/admin-media-upload-video/admin-media-upload-video.component.ts:55`
- C-20261020-02 | 2026-10-20 | product | high | high | addressed | People Import creates clans at preview time, before Confirm, so Cancel leaves writes | `src/app/components/admin-people-import/admin-people-import.component.ts:222`
- C-20261020-03 | 2026-10-20 | product | medium | high | addressed | No visible route back into /admin except clicking the logo image | `src/app/app.component.html:9`
- C-20261020-04 | 2026-10-20 | product | medium | high | addressed | A super without admin passes the guard but gets a blank Media page | `src/app/components/admin-media-upload-video/admin-media-upload-video.component.html:1`
- C-20261020-05 | 2026-10-20 | product | medium | high | addressed | Delete User uses the legacy prompt with generic copy and never names the user | `src/app/components/user-edit/user-edit.component.ts:72`
- C-20261020-06 | 2026-10-20 | product | medium | high | addressed | Uploads file counts come from a maxResults:1 list and long listings truncate silently | `src/app/components/admin-user-uploads/admin-user-uploads.component.ts:314`
- C-20261020-07 | 2026-10-20 | product | medium | high | addressed | Families CSV header errors are invisible; Import counts invalid rows and never pluralizes | `src/app/components/admin-families/admin-families.component.ts:217`
- C-20261020-08 | 2026-10-20 | product | medium | high | addressed | People Import keeps Confirm enabled with errors and silently drops rows with an empty ID | `src/app/components/admin-people-import/admin-people-import.component.ts:87`
- C-20261020-09 | 2026-10-20 | security | medium | high | addressed | Generate reset link, the most privileged one-shot action, has no confirm dialog | `src/app/components/admin-recovery/admin-recovery.component.html:108`
- C-20261020-10 | 2026-10-20 | security | medium | high | escalated | RTDB rules still grant plain admins write on features and recovery nodes, so super-only is client-side | `database.rules.json:41`
- C-20261020-11 | 2026-10-20 | security | medium | medium | addressed | Guard consumes an unvalidated promotedRoute; a /admin value creates a plain-admin redirect loop | `src/app/services/super-admin.guard.ts:27`
- C-20261020-12 | 2026-10-20 | security | medium | high | addressed | Role grant and revoke are an unaudited client write to users/{id} with no privilege-change confirm | `src/app/services/admin.service.ts:41`
- C-20261020-13 | 2026-10-20 | security | low | medium | rejected | Guard reads the first record only, so a demoted super keeps the shell until reload | `src/app/services/super-admin.guard.ts:20`
- C-20261020-14 | 2026-10-20 | security | low | high | addressed | Dead user-edit.shouldSeeRoles still trusts localStorage roles | `src/app/components/user-edit/user-edit.component.ts:65`
- C-20261020-15 | 2026-10-20 | compliance | high | high | addressed | Feature-flag checkboxes have no accessible name | `src/app/components/admin-features/admin-features.component.html:51`
- C-20261020-16 | 2026-10-20 | compliance | high | high | addressed | Click-only divs are keyboard-dead: CSV dropzones, storage folder rows, album cards | `src/app/components/admin-families/admin-families.component.html:14`
- C-20261020-17 | 2026-10-20 | compliance | medium | high | addressed | Drawer focus trap excludes the sidebar logo and only Shift+Tab is tested | `src/app/components/admin/admin.component.ts:108`
- C-20261020-18 | 2026-10-20 | compliance | medium | high | addressed | Icon-only buttons rely on matTooltip for their only name | `src/app/components/admin-photo-albums/admin-photo-albums.component.html:88`
- C-20261020-19 | 2026-10-20 | compliance | medium | high | addressed | Floated labels and placeholders use ink-3 at 3.18:1 on white | `src/app/components/admin-media-upload-video/admin-media-upload-video.component.scss:20`
- C-20261020-20 | 2026-10-20 | compliance | medium | high | addressed | Pending status chip text is 3.97:1 at 12px/600 | `src/app/components/admin-user-uploads/admin-user-uploads.component.scss:55`
- C-20261020-21 | 2026-10-20 | compliance | medium | medium | addressed | Uploads segmented filter has no aria-pressed and is 32px tall | `src/app/components/admin-user-uploads/admin-user-uploads.component.html:5`
- C-20261020-22 | 2026-10-20 | compliance | low | high | addressed | Recovery per-row errors have no alert live region | `src/app/components/admin-recovery/admin-recovery.component.html:132`
- C-20261020-23 | 2026-10-20 | reliability | medium | high | addressed | Photo albums stream has no error handler, so admin stays loading and retry cannot recover | `src/app/services/photo-albums.service.ts:17`
- C-20261020-24 | 2026-10-20 | reliability | high | high | addressed | Album delete cascade is non-atomic with no catch or in-flight state | `src/app/components/admin-photo-albums/admin-photo-albums.component.ts:438`
- C-20261020-25 | 2026-10-20 | reliability | high | medium | addressed | Folder upload failures after dialog close are unhandled and files drop silently | `src/app/components/admin-photo-albums/admin-photo-albums.component.ts:260`
- C-20261020-26 | 2026-10-20 | reliability | medium | high | addressed | Approve and reject failures are swallowed to console with no feedback | `src/app/components/admin-user-uploads/admin-user-uploads.component.ts:203`
- C-20261020-27 | 2026-10-20 | reliability | medium | high | addressed | Album photo subscription leaks per open and can overwrite another album's photos | `src/app/components/admin-photo-albums/admin-photo-albums.component.ts:360`
- C-20261020-28 | 2026-10-20 | reliability | medium | high | addressed | Storage browser renders the empty state for both in-flight and failed listings | `src/app/components/admin-user-uploads/admin-user-uploads.component.html:266`
- C-20261020-29 | 2026-10-20 | reliability | medium | high | addressed | Families and calendars writes lack failure surfaces and CSV import fires unawaited saves | `src/app/components/admin-families/admin-families.component.ts:317`
- C-20261020-30 | 2026-10-20 | reliability | medium | medium | addressed | Recovery secondary streams fail into empty states with no error message | `src/app/components/admin-recovery/admin-recovery.component.ts:124`
- C-20261020-31 | 2026-10-20 | maintainability | high | high | addressed | No e2e exercises the confirm path for reject, close, delete, or approve | `e2e/specs/admin-content.spec.ts:69`
- C-20261020-32 | 2026-10-20 | maintainability | medium | high | addressed | admin.spec and security.spec never assert the console collector | `e2e/specs/admin.spec.ts:1`
- C-20261020-33 | 2026-10-20 | maintainability | medium | high | addressed | ConfirmDialogComponent has no component spec | `src/app/components/confirm-dialog/confirm-dialog.component.ts:14`
- C-20261020-34 | 2026-10-20 | maintainability | medium | high | escalated | The gate never runs the unit suite | `scripts/e2e/gate.sh:9`
- C-20261020-35 | 2026-10-20 | maintainability | medium | medium | rejected | New deep specs duplicate the old admin smoke assertions | `e2e/specs/admin.spec.ts:128`
- C-20261020-36 | 2026-10-20 | maintainability | low | medium | addressed | Chat toggle test lacks try/finally restore | `e2e/specs/admin.spec.ts:146`
- C-20261020-37 | 2026-10-20 | maintainability | low | medium | addressed | Import busy-state test uses a hand-rolled MutationObserver instead of polling | `e2e/specs/admin-people.spec.ts:98`
- C-20261020-38 | 2026-10-20 | maintainability | low | medium | addressed | Guard spec asserts a stub UrlTree toString tautology | `src/app/services/super-admin.guard.spec.ts:46`

- C-20261020-39 | 2026-10-20 | reliability | high | high | addressed | Confirm dialog has no re-entrancy guard; double click stacks dialogs and can double-fire reset-link generation | `src/app/services/confirm-dialog.service.ts:15`
- C-20261020-40 | 2026-10-20 | correctness | high | high | addressed | user-edit role snapshot survives card recycling, so later role edits compare against the page-load user | `src/app/components/user-edit/user-edit.component.ts:34`
- C-20261020-41 | 2026-10-20 | reliability | medium | high | addressed | Albums error fallback completes albums$, leaving the public gallery and album picker unrecoverable | `src/app/services/photo-albums.service.ts:31`
- C-20261020-42 | 2026-10-20 | reliability | medium | high | addressed | Families import failure reuses csvErrors, disabling Import and dead-ending retry | `src/app/components/admin-families/admin-families.component.ts:342`
- C-20261020-43 | 2026-10-20 | scale | medium | medium | addressed | ZIP download loads every blob at once after listAll, with no cap or concurrency limit | `src/app/components/admin-user-uploads/admin-user-uploads.component.ts:449`
- C-20261020-44 | 2026-10-20 | data-integrity | low | medium | addressed | People import saves drafted clans before people; a later failure leaves orphans | `src/app/components/admin-people-import/admin-people-import.component.ts:433`
- C-20261020-45 | 2026-10-20 | reliability | low | high | addressed | Folder count falls back to 0 on a listAll error with no unknown marker | `src/app/components/admin-user-uploads/admin-user-uploads.component.ts:337`
- C-20261020-46 | 2026-10-20 | reliability | low | medium | addressed | Media delete is fire-and-forget; a rejected write looks successful | `src/app/components/admin-media-upload-video/admin-media-upload-video.component.ts:58`
- C-20261020-47 | 2026-10-20 | maintainability | low | high | addressed | Dead get isSidenavOpen accessor left after the template switched to a boolean | `src/app/components/admin/admin.component.ts:64`
- C-20261020-48 | 2026-10-20 | maintainability | low | high | addressed | Unused .admin-page-actions class in the shared admin data styles | `src/app/styles/admin-data.scss:130`
- C-20261020-49 | 2026-10-20 | maintainability | low | medium | rejected | Old admin smoke tests overlap the per-route specs but assert the seeded default state through the canonical route entry | `e2e/specs/admin.spec.ts:189`
- C-20261020-50 | 2026-10-20 | maintainability | low | high | addressed | Showing X-Y of Z range builder duplicated in three components | `src/app/components/admin-users/admin-users.component.ts:69`
- C-20261020-51 | 2026-10-20 | maintainability | low | medium | addressed | Pagination on bounded lists (recipients, calendars) breaks the paginate-where-it-grows rule | `src/app/components/admin-calendars/admin-calendars.component.ts:24`
- C-20261020-52 | 2026-10-20 | maintainability | low | medium | addressed | Orphaned featureDefs alias only read by its own spec | `src/app/components/admin-features/admin-features.component.ts:29`
- C-20261020-53 | 2026-10-20 | maintainability | low | medium | addressed | onRetry duplicates the nonMessagePhotos subscription block | `src/app/components/admin-photo-albums/admin-photo-albums.component.ts:142`

  rebuttal | addressed | `CI=true npm test` | confirm service wired and cancel unit-tested
  rebuttal | addressed | `CI=true npm test` | preview read-only, clan writes only in confirm
  rebuttal | addressed | `e2e/specs/account-recovery.spec.ts` | Generate confirm exercised end-to-end
  rebuttal | escalated | `database.rules.json:41` | rules out of scope; logged as AFQ-08
  rebuttal | addressed | `user-edit.component.ts` | privilege-change confirm added; audit trail logged as AFQ-09
  rebuttal | rejected | `super-admin.guard.ts:20` | guards gate route entry; server rules reject post-demotion writes
  rebuttal | addressed | `admin-features.component.html:51` | label projected into the checkbox; unit asserts text
  rebuttal | addressed | `admin-families.component.html:21` | dropzones are buttons; rows and cards handle Enter/Space
  rebuttal | addressed | `photo-albums.service.ts:31` | error signal plus reload; unit proves re-emission
  rebuttal | addressed | `admin-photo-albums.component.ts:479` | try/catch plus in-flight; atomicity logged as AFQ-10
  rebuttal | addressed | `e2e/specs/admin-content.spec.ts:131` | confirm paths end-to-end with DB restore
  rebuttal | addressed | `e2e/specs/admin.spec.ts:1` | collector asserted after every test
  rebuttal | addressed | `confirm-dialog.service.ts:15` | in-flight promise shared; unit covers two concurrent calls
  rebuttal | addressed | `user-edit.component.ts:34` | ngOnChanges resets the role snapshot; unit covers recycling
- C-20261020-54 | 2026-10-20 | data-integrity | high | high | addressed | Draft clans survive cancel in the lookup map, so a re-parse imports people with unwritten clan ids | `admin-people-import/admin-people-import.component.ts:478`
- C-20261020-55 | 2026-10-20 | correctness | medium | high | addressed | user-edit mutates the shared input object, so Cancel leaves unsaved roles and names on the card | `src/app/components/user-edit/user-edit.component.ts:100`
- C-20261020-56 | 2026-10-20 | reliability | medium | high | addressed | Confirm service shares one answer across different callers and discards the second caller's data | `src/app/services/confirm-dialog.service.ts:20`
- C-20261020-57 | 2026-10-20 | reliability | medium | high | addressed | ZIP download drops failed blobs and presents the partial archive as complete | `src/app/components/admin-user-uploads/admin-user-uploads.component.ts:466`
- C-20261020-58 | 2026-10-20 | correctness | medium | high | addressed | Toggle failure leaves the checkbox on while the DB keeps the old value | `admin-features/admin-features.component.ts:83`
- C-20261020-59 | 2026-10-20 | data-integrity | medium | medium | addressed | Album cascade has no photo-stream error path; deletes album with no photo list | `src/app/components/admin-photo-albums/admin-photo-albums.component.ts:141`
