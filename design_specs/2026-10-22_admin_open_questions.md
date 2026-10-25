# Admin Consistency: Open Questions For Human Review

Decision log for the 2026-10-22 admin pass. Every entry below is a decision the
code cannot settle on its own. Redteams chose the default recorded here; the
default is already applied on branch `feat/admin-facelift` and nothing is
pushed, merged, or deployed.

Status: all ten entries are now `CERTAIN`; the user reviewed them on
2026-10-22 and each entry records the decision made.

## AFQ2-01: Signup self-asserts `roles/user`

- Question: should a new account's read access be granted by the client or by
  the server?
- Recommendation: server-side. Extend the existing account-created function to
  stamp `roles/user`, and remove the client write. The flag is the trust root
  for every authenticated read gate in `database.rules.json`.
- Strongest counter: every existing user already carries the bit, so the change
  needs a migration and a signup-contract change the emulator gate cannot prove
  against production.
- Verdict: `CERTAIN`, user decision (2026-10-22): open membership, server
  stamps `roles/user`; clients can never write roles; admin revoke is the ban
  switch.
- Evidence: C-20261022-48, `database.rules.json:149`.
- Revisit cost: medium (function, migration, two e2e specs).

## AFQ2-02: Repository rules are not what production runs

- Question: accept console-managed database/storage rules, or bring them under
  the repo deploy?
- Recommendation: accept for now, but snapshot the current production rules
  into the repo and add a drift check. A rules deploy is a deliberate ops task,
  not part of this branch.
- Strongest counter: until rules are hand-applied, none of this round's
  hardening is proven live in production.
- Verdict: `CERTAIN`, user decision (2026-10-22): override; database and
  storage rules now deploy from the repo, with `RULES_ONLY=1` for rules-only
  ships and production storage in `storage.rules.prod`.
- Evidence: C-20261022-50, `scripts/deploy.sh:7`.
- Revisit cost: low for the snapshot, high for a rules deploy.

## AFQ2-03: Role grant and its audit write are not atomic

- Question: move grant + `roleAudit` into one super-gated callable with
  rollback, or keep two client writes?
- Recommendation: callable with the rollback pattern already used by
  `close-recovery-request`.
- Strongest counter: both writes are already super-only; the failure mode is a
  missing audit row, not a wrong grant, and a callable adds deploy surface.
- Verdict: `CERTAIN`, user decision (2026-10-22): build the transactional
  super-only callable with server-derived actor/time and last-super guard.
- Evidence: C-20261022-51, `src/app/services/admin.service.ts:74`.
- Revisit cost: medium.

## AFQ2-04: Audit records are client-authored

- Question: server-stamp `roleAudit` and `featureFlagAudit`, or keep
  super-authored client writes?
- Recommendation: fold server stamping into the AFQ2-03 callable. Until then
  the create-only super rule is the compensating control.
- Strongest counter: writers are super-only and records are create-only, a
  trust assumption this codebase already makes elsewhere.
- Verdict: `CERTAIN`, user decision (2026-10-22): server-stamped, folded into
  the role-grant callable.
- Deferred: user decision (2026-10-25). The callable is not in this branch. The shipped control is the create-only, super-only rule at `database.rules.json:221-226`; `roleAudit` is already server-stamped at `functions/src/change-user-role.ts:89-104`. Recorded as `D4` in `design_specs/2026-10-24_premerge_walkthrough.md`.
- Evidence: C-20261022-71, `src/app/services/feature-flags.service.ts:98`.
- Revisit cost: low once the callable exists.

## AFQ2-05: Public upload callable is still unauthenticated

- Question: keep the public upload path, or require anonymous auth / captcha?
- Recommendation: keep it public, since that is the product's purpose. It is
  now server-assigned, size-capped, input-bounded, per-actor rate-limited, and
  the global cap soft-degrades instead of blocking.
- Strongest counter: a determined attacker can still fill the admin review
  queue within the per-actor budget; a captcha would be the real fix.
- Verdict: `CERTAIN`, user decision (2026-10-22): keep it public with rate
  limits and the soft global cap.
- Evidence: C-20261022-54, `functions/src/create-user-upload.ts`.
- Revisit cost: medium (captcha provider or anonymous auth).

## AFQ2-06: Media and clans now require authentication

- Question: is public media intended?
- Recommendation: no. The navbar only links media for signed-in users, and the
  media routes now carry the auth guard.
- Strongest counter: if any public page ever linked media, signed-out visitors
  now get a redirect instead of content.
- Verdict: `CERTAIN`, user decision (2026-10-22): member reads for media,
  admin-only writes, clans require auth, and copied
  `/media/explorer?id=<id>` links must play signed out. Uploads stay supported
  for regular users and are covered by e2e.
- Evidence: C-20261022-52, `database.rules.json`, `app-routing.module.ts`.
- Revisit cost: low (revert one rule and one guard).

## AFQ2-07: First load is still ~2.17 MB raw / ~415 kB transfer

- Question: accept the remaining vendor weight, or invest in vendor splitting?
- Recommendation: accept. The 1.35 MB shared chunk is Firebase plus core
  Angular/Material that the shell needs; feature libs (pdf viewer, calendar,
  media) are now lazy.
- Strongest counter: mobile users on slow links still pay ~415 kB before first
  paint, and the budget only measures the 822 kB initial, not the statically
  imported shared chunk.
- Verdict: `CERTAIN`, user decision (2026-10-22): accept the remaining vendor
  weight; admin/media/calendar stay lazy with a 1.2/1.5 MB initial budget.
- Evidence: build report; C-20261022-50 context.
- Revisit cost: medium.

## AFQ2-08: Pagination markup is still duplicated

- Question: extract a shared pager component now or later?
- Recommendation: later. Behavior is pinned by e2e and the duplication is
  presentational; extracting it touches six tables with no user-visible win.
- Verdict: `CERTAIN`, user decision (2026-10-22): accepted the deferral
  (C-20261022-79).
- Revisit cost: low risk, medium churn.

## AFQ2-09: Ideas deliberately not built

- Batch approve of pending uploads into one album (M effort, partial-failure
  risk).
- Alert acknowledgment for `adminAlerts` (needs a rules decision).
- Visual-regression screenshot baselines (previously declined in AFQ-07).
- Verdict: `CERTAIN`, user decision (2026-10-22): accepted as not built for
  this round.

## AFQ2-10: Progressive Discovery

- Question: opt this repository into `docs/discovery/`?
- Recommendation: yes, now that the work spans multiple sessions.
- Verdict: `CERTAIN`, user decision (2026-10-22): opted in. Index created at
  `docs/discovery/DISCOVERY.md` with entries D-20261022-01 through -11.
- Evidence: handoff note in `design_specs/2026-10-20_admin_facelift_handoff.md`.
