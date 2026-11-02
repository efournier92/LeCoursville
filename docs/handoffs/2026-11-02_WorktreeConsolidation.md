# Handoff | Worktree Consolidation And Branch Merges

- Date: 2026-11-02
- Branch: `master` at `119b0bbe`, tree clean, `origin/master` in sync
- Gate: `npm run e2e:gate` green on master, 388 specs on Chromium, WebKit, and Firefox

## What Happened

Four open worktrees were triaged against master and all work was either merged or preserved.

| Worktree | Branch | Outcome |
|---|---|---|
| `lecoursville` | `master` | Kept, fast-forwarded to `119b0bbe` |
| `lecoursville-songs` | `2026-10-31_Songs` | Already merged as #50, tree-identical. Worktree removed, branch deleted |
| `lecoursville-dark` | `dark-mode` | Already merged, ancestor of master. Worktree removed, branch deleted |
| `lecoursville-theme` | `theme+input-standardization` | Merged as PR #52, squash. Worktree removed, branch deleted |
| `lecoursville-wt` | `user-flows-polish` | Salvaged as PR #53, squash. Worktree removed, branch deleted |

Backups kept on `origin`: `archive/2026-10-31_Songs`, `archive/theme+input-standardization`, `archive/user-flows-polish`.

## Merge Detail

### #52 Theme And Input Standardization

The branch was cut from #50 and predated the #51 admin tier split, so a plain merge would have reverted it. A redteam found three real reversions before merge.

- Restored the admin chat edit guard, `messageType.authorId` or `roles.admin`.
- Kept role gating for expression controls on `/expressions`, dropped the branch's route gating.
- Kept the `superOnly` nav model and the two-arg `visibleAdminNav`.
- Kept the branch's `messageType` rules hardening, which narrows rather than loosens.

### #53 Salvage User-Flow Polish

`user-flows-polish` was a month old with 17 conflicting files and four areas since redesigned on master. Only the still-novel work moved.

- Ported: PhotoSwipe real dimensions, photos empty state, contributor upload CTA, contacts dedupe and `/contacts/:id` deep link, calendar print and empty-state polish, auth password toggle and reset error copy.
- Dropped: person-tree keyboard work already on master, the nav revert commit that nets to a no-op, the family-color removal, the old auth not-found card and promoted-route CTA.

## Open Items

- **`contacts` read rule.** The theme branch had tightened `database.rules.json` `contacts` read from `roles/user` to admin-or-super (its ledger `C-18`). The merge restored `roles/user` to avoid an undeclared contract change. The branch's own evidence says no member-reachable client reads that node, so either state is defensible. Needs a decision before the next rules review.
- **Flows auth backlog.** The old branch's not-found route state and account CTA were not ported. Master's auth owns Google sign-in, recovery, and a feature-flag driven promoted route, so those two need a rebuild on the current screen rather than a port.
- **Stash preserved.** `stash@{0}` on master, `agent-f21-1792959358-11736-runtime-bump-holdout`, was not touched by any of this work.
- **Branch debt elsewhere.** `angular-upgrade`, `feat/account-recovery`, `feat/admin-facelift`, and `photo-albums` still exist locally, unexamined here.

## Verification

- `npm run e2e:gate` on master after both merges: exit 0, 388 passed per browser, 0 skipped, 0 flaky.
- Merge trees verified content-equal to their source branches before branch deletion.
