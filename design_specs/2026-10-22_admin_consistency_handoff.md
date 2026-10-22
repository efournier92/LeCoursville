# Admin Consistency And Hardening Handoff (2026-10-22)

## Current State

Branch `feat/admin-facelift`, cut from `master` at `aca0acb6`. Nothing pushed,
merged, or deployed. Session commits:

- `21ce572a` Unify admin headers, surfaces, and security boundaries
- `68a67bcd` Split the platform bundle and close admin trust gaps
- `09568ebf` Give admins work-queue, audit, and safety surfaces
- `c6e18b5c` Close the admin hardening round and prove the full gate
- plus the final visual-craft commit on top

Working tree contains only this handoff and the two session docs.

## Final Verification

Executed this session, last run on the final tree:

- `npm run e2e:gate` -> unit 419 passed, then chromium 188, webkit 188, firefox
  188 passed. 564 browser executions, 0 failed, 0 skipped, retries 0.
- `CI=true npm test -- --watch=false` -> 77 files, 419 tests passed.
- `npm --prefix functions test` -> 8 files, 112 tests passed.
- `npx ng build --configuration=e2e` -> initial 822.93 kB raw / 133.32 kB
  transfer; admin 352.60 kB, media 962.49 kB, calendar 104.23 kB lazy chunks.
- Measured at 1440 and 390: title bar exactly 64 px desktop and 56 px mobile on
  all nine routes; zero horizontal overflow at 390 and 360; zero console errors.
- Do not run `scripts/deploy.sh` or any Firebase deploy.

## The Visual Contract

`design_specs/2026-10-22_admin_consistency_contract.md` is the binding spec:

- One fixed-height title bar, title left, actions right at 36 px, no inputs in
  the bar, optional second-row filter bar only when a page has filters.
- One `.admin-surface`, one `.admin-error`, one `.admin-card-title`,
  one `.admin-page`; the shell owns width and gutters.
- One pagination footer, one dialog action grammar, one sort pill.
- Users is a table with an edit dialog; role history sits below it.
- Mobile: 44 px tap targets, tables collapse to cards, action rows wrap.
- `e2e/specs/admin-consistency.spec.ts` enforces the heights, filter placement,
  overflow, and tap targets on every route at desktop, 390, and 360.

## Security Posture

Closed this session: storage path trust in upload approve/reject, auto-emailed
reset links, users read exposure, messages author/nested-reply forgery,
`userUploads` unauthenticated create and id spoofing, media/clans world reads,
reset-link callable privilege (now super), upload rate-limit identity, global
cap availability, upload size, message payload bounds, attachment URL updates,
orphan reject, and approval path collisions.

Remaining human decisions are in `design_specs/2026-10-22_admin_open_questions.md`:
signup self-assertion (C-48), repo-vs-production rules (C-50), role-audit
atomicity (C-51), client-authored audit records (C-71).

## Performance And UX

- Initial bundle 3.57 MB -> 822.93 kB raw (600 kB -> 133 kB transfer); true
  first load including the statically imported Firebase/core chunk is about
  2.17 MB raw / 415 kB transfer.
- Admin, media, and calendar routes now lazy; `jspdf`/`html2canvas` removed;
  pdf.js assets down from about 21 MB to 8.8 MB.
- Duplicate per-auth user/photo listeners fixed; shell, import, and media
  subscription leaks closed; uploads folder view caches URLs and metadata.
- Users table, query-param filter state, work-queue nav badges, role history,
  flag-change history, reset-link expiry, absolute audit times, real CSV
  overwrite counts, working drag-and-drop, preview approve/reject, and
  requester-specific accessible names are all live.

## Open Risks

- Production database/storage rules are console-managed; the repo rules are
  proven only in the emulator.
- Public upload stays unauthenticated by design: per-actor rate limited and
  global soft-degraded with an admin alert, not captcha-protected.
- `roleAudit` and `featureFlagAudit` are client-authored, create-only, and
  super-writable at the tree level.
- Pagination markup is still duplicated across six tables (deferred).
- The 50 MB upload cap is duplicated client and server; keep them in sync.
- Screenshots live in `/tmp/af-shots/2026-10-22/` and `/tmp/af-final/`, not the
  repo.

## Repo Notes

This repo has `design_specs/` and now `docs/critique/` but no `docs/discovery/`.
Progressive Discovery is an available opt-in; creating `docs/discovery/` is a
one-way decision and was not taken (AFQ2-10).

## Next Actions

1. Answer the ten entries in `design_specs/2026-10-22_admin_open_questions.md`.
2. If approved: snapshot production rules and add a drift check (AFQ2-02).
3. Optional: transactional role-grant callable with server-stamped audit
   (AFQ2-03/04).
4. Optional: shared pager component; batch upload approval; alert
   acknowledgment.
5. Ship only on explicit request via `ship-changes`.

## Resume Prompt

Continue the admin consistency work from
`/Users/e/mnt/bnk/cs/lecoursville/design_specs/2026-10-22_admin_consistency_handoff.md`.
Work on `feat/admin-facelift`, do not push, merge, or deploy. Read the contract
and the open-questions file first. Re-run `npm run e2e:gate` and report any
divergence before changing anything. The remaining work is human decisions, not
unfinished machine work; the ledger is `docs/critique/2026-10-22_admin-consistency.md`.
