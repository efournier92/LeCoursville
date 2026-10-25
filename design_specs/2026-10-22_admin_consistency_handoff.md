# Admin Consistency And Hardening Handoff (2026-10-22)

## Current State

Branch `feat/admin-facelift`, cut from `master` at `aca0acb6`. Nothing pushed,
merged, or deployed. Session commits:

- `21ce572a` Unify admin headers, surfaces, and security boundaries
- `68a67bcd` Split the platform bundle and close admin trust gaps
- `09568ebf` Give admins work-queue, audit, and safety surfaces
- `c6e18b5c` Close the admin hardening round and prove the full gate
- `bf650300` Record the admin consistency contract, ledger, and open questions
- plus the final visual-craft and approved-decisions commits

Working tree contains only this handoff and the two session docs.

## Final Verification

Executed this session, last run on the final tree:

- `npm run e2e:gate` -> unit 421 passed, then chromium 196, webkit 196, firefox
  196 passed. 588 browser executions, 0 failed, 0 skipped, retries 0.
- `CI=true npm test -- --watch=false` -> 77 files, 419 tests passed.
- `npm --prefix functions test` -> 10 files, 127 tests passed.
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

The user reviewed and decided all ten entries in
`design_specs/2026-10-22_admin_open_questions.md` on 2026-10-22. Applied since:
membership is server-stamped (`claimMemberRole` plus a trigger watchdog, clients
can never write roles), role grants and audit are one super-only transaction
(`changeUserRole`, server-derived actor/time, last-super guard), and database and
storage rules now deploy from the repo (`RULES_ONLY=1` for rules only, production
storage in `storage.rules.prod`).

Media access follows the decided split: reads stay public so copied
`/media/explorer?id=<id>` links play video or audio signed out, writes stay
admin-only, clans require authentication, and uploads keep working for regular
users. `e2e/specs/media.spec.ts` covers both an audio and a video link, and its
red proof (re-adding the old guard) is recorded in the ledger.

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

- Public upload stays unauthenticated by design: per-actor rate limited and
  global soft-degraded with an admin alert, not captcha-protected.
- Production storage rules allow public create under `userUploads/**`, so
  direct Storage writes bypass the callable's rate limits (C-93).
- `roleAudit` and `featureFlagAudit` are client-authored, create-only, and
  super-writable at the tree level.
- Pagination markup is still duplicated across six tables (deferred).
- The 50 MB upload cap is duplicated client and server; keep them in sync.
- Screenshots live in `/tmp/af-shots/2026-10-22/` and `/tmp/af-final/`, not the
  repo.

## Repo Notes

This repo now opts into Progressive Discovery: `docs/discovery/DISCOVERY.md`
exists with entries D-20261022-01 through -11. Grep it by scope token before
re-exploring; see `log-discoveries` for the read and append contracts.

Rules deployment is no longer console-managed: `scripts/deploy.sh` ships `database.rules.json` and `storage.rules.prod` (`:39` and `:46` via `--only hosting,functions,database`, `:53` and `:60` via `--only database`, and storage through `deploy_storage_rules` at `:13-31`). The "proven only in the emulator" caveat is retired.

## Next Actions

1. Ops sign-off to run `bash scripts/deploy.sh prod` (or `RULES_ONLY=1` for a
   rules-only ship). Nothing has been deployed.
2. Decide whether to bind production storage public-create to custom claims or
   a callable-only path (C-93).
3. Optional: shared pager component; batch upload approval; alert
   acknowledgment.
4. Ship only on explicit request via `ship-changes`.

## Resume Prompt

Continue the admin consistency work from
`/Users/e/mnt/bnk/cs/lecoursville/design_specs/2026-10-22_admin_consistency_handoff.md`.
Work on `feat/admin-facelift`, do not push, merge, or deploy. Read the contract
and the open-questions file first. Re-run `npm run e2e:gate` and report any
divergence before changing anything. The remaining work is human decisions, not
unfinished machine work; the ledger is `docs/critique/2026-10-22_admin-consistency.md`.
