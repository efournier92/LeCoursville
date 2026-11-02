# Handoff | Theme + Input Standardization (Emerald, Read-Only User Face)

- Date: 2026-11-01 (second round, evening)
- Branch: `theme+input-standardization` in worktree `/Users/e/mnt/bnk/cs/lecoursville-theme`
- Committed: `f67e64ce` (implementation) -> `b465409d` (merge origin/master #49+#50) -> `4ca10bcc` (ledger evidence)
- Uncommitted: the second redteam round (rules hardening, role-read refactor, radius unification, spec + ledger + discovery updates). Nothing pushed.
- Spec: `docs/specs/2026-10-31_ThemeInputStandardization.md`
- Ledger: `docs/critique/2026-10-31_ThemeInputStandardization.md` (35 findings, validator clean, referee verdict CONVERGED)

## Current State

### Shipped On The Branch

- Emerald palette both modes. `$evergreen` M3 palette. theme-invariant brand-solid fills.
- Control standard: 44px controls, radius ladder. Text-entry controls (Material and raw) take the 16px card radius. the pill radius is buttons-only.
- User-facing read-only for expressions and contacts. admin parity via `/admin/expressions` + `/admin/contacts`. `isAdminRoute` is a live `Router.url` getter.
- `npm run theme:check` wired pre-build: raw hex including `.ts`, radius ladder, role ban, rules audit, dark parity.

### Second Round (this session)

- `C-17` expressions read-only is now enforced server-side: expression-create validate requires admin-or-super, and a `messageType` child validate limits member writes to `'chat'` at message and reply level.
- `C-18` `/contacts` read tightened from `roles/user` to admin-or-super. verified no member-reachable client reads that node (member contacts derive from `/people`).
- `C-09` role reads left the templates (`canDelete`, `isSuperUser` getters), exemptions dropped, ban regex widened to any identifier `.roles` except the `formUser` edit model.
- `C-05` gallery search wrapper moved off the 999px pill. computed-radius assertions in the family-explorer and photos specs.
- `C-01..C-34` settled with evidence. Two lows escalated to the human (below).

### Verification (executed this session, post-change)

- `npm run e2e:gate` -> chromium 367, webkit 367, firefox 367, 0 failed, 0 skipped. unit 752. functions 298. rules project 22.
- `npm run theme:check` -> PASS.
- `python3 ~/.config/opencode/scripts/check_critique.py <ledger>` -> clean.
- Referee -> CONVERGED, no blocking findings.

## Human Agenda (2 items, both low, neither blocking)

1. `C-21` data-exposure posture. `/media` is anonymously readable, `/messages` and `/photos` require any signed-in account, and self-registration grants `roles/user`. Decide whether that stays. Recommend: keep `/media` public (the public gallery depends on it), and treat messages/photos as member-only by decision, not accident.
2. `C-35` admin tiering. The `/admin` shell is super-only while rules let plain `roles.admin` users read contacts and write expressions. Decide: admit plain admins to `/admin/expressions` + `/admin/contacts`, or tighten the rules to super.

## Next Actions

1. Commit the uncommitted round via `ship-changes` (user's call). Rules are emulator-verified but not deployed.
2. Any deploy must go through `scripts/deploy.sh` sign-off. the rules changes only take effect when the database rules are deployed with the bundle.
3. Maintenance contract: any new message or reply write must stamp `messageType: 'chat'` on create and must not re-send `messageType` on update, or members will be denied.

## Verify Commands

```bash
npm run theme:check
npm run e2e:gate
python3 ~/.config/opencode/scripts/check_critique.py /Users/e/mnt/bnk/cs/lecoursville-theme/docs/critique/2026-10-31_ThemeInputStandardization.md
```

## Open Risks And Blockers

- Uncommitted work: a crash before commit loses the second round.
- Playwright browser binaries vanished from the cache mid-session. `npx playwright install webkit firefox` restored them. A whole-browser failure with "Executable doesn't exist" is an environment fault, not a regression.
- `C-21` and `C-35` are accepted risk until the user decides.

## References

- Discovery: `D-20261101-01..08` in `docs/discovery/DISCOVERY.md`
- Gate artifacts: `.gate-results/{chromium,webkit,firefox}.json`, `unit-tests.txt`, `functions-tests.txt`
