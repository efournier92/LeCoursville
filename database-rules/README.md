# Database Rules History

Versioned snapshots of the Realtime Database rules, paired by date as `before.json` (the ruleset in place before a change) and `after.json` (the reviewed ruleset to apply). The live source of truth is `database.rules.json` at the repo root, which `firebase.json` points at. Snapshots here are point-in-time copies for review and rollback.

## Layout

```
database-rules/
  2026-10-04/
    before.json   # exported from the target project's console before applying
    after.json    # copy of database.rules.json at review time
    before-storage.rules  # console export of the Storage ruleset, when it changes
    after-storage.rules   # copy of storage.rules.prod at review time
```

## Why

The apply path is no longer manual: `scripts/deploy.sh` ships `database.rules.json` and `storage.rules.prod` on both targets (`--only database` and the throwaway storage config), so a rules change reaches production as part of a deploy. The dated before/after pair is still the review record: a prod-only node silently dropped from the root file would become denied with no other trace. Diff the pair before any deploy and roll back from the console history if needed.

## Adding An Entry

1. In the Firebase console for the target project, copy the current rules to `database-rules/<date>/before.json`.
2. Copy the root `database.rules.json` to `database-rules/<date>/after.json`.
3. If the Storage ruleset changes, copy the console Storage rules to `before-storage.rules` and `storage.rules.prod` to `after-storage.rules`.
4. Run `diff database-rules/<date>/before.json database-rules/<date>/after.json` and confirm every hunk is intended.
5. Record the `sha256` of each file in the entry or the pull request.

## 2026-10-04

- `after.json` captures the account-recovery hardening: role checks use `.val() === true`, `users`/`people`/`addresses` require authentication, and the new server-only nodes (`recoveryRequests`, `adminAlerts`, `recoveryAudit`, `rateLimits`, `outboundEmails`) are locked or admin-read only.
- `before.json` is the `lecoursville` production console export captured before applying. Diff reviewed 2026-10-10: no prod-only node dropped, every hunk is either the hardening or a new branch node.
- `before.json` sha256: `2af38b3732092ebcccf6282f567cd65442bef440b7def52872af59217bc46470`.
- `after.json` sha256: `94c0fb91088f3bced4f6abafe56409cfb3464959851d5b441ebf32221d6a86b3`.

## 2026-10-10

- `after.json` tightens the `users/$uid` self-write: role provisioning on create is limited to non-admin and non-super, and the update branch now pins `roles/user` alongside the existing `roles/admin` and `roles/super` pins.
- `before.json` is the prior reviewed `2026-10-04/after.json` snapshot, not a fresh console export.
- `before.json` sha256: `94c0fb91088f3bced4f6abafe56409cfb3464959851d5b441ebf32221d6a86b3`.
- `after.json` sha256: `4f7a6c1fdebce54b175720047cc24b56f35d482271100517ea774c044f22f962`.

## 2026-10-25

- `before.json` is the `lecoursville` production console export captured 2026-10-25, before the pre-merge deploy. Its sha256 equals the `2026-10-04/after.json` hash, so production still runs the 2026-10-04 ruleset; the 2026-10-10 tightening never reached production.
- `after.json` is a copy of the repo `database.rules.json` at review time, carrying the admin-consistency and media-pipeline work.
- `before-storage.rules` is the production Storage console export. It allows `read, write` on every path with no authentication.
- `after-storage.rules` is a copy of `storage.rules.prod`.
- Material differences, production to repo:
  - Four nodes are added: `roleAudit`, `featureFlagAudit`, `mediaUploads`, `mediaDeletions`. No production-only node is dropped.
  - `users/.read` narrows from any signed-in user to super only, and `users/$uid` gains a self-read.
  - `users/.write` at the root is removed. `users/$uid` self-write is replaced: create only with no `roles/*`, delete super-only, and updates pin all three role keys.
  - `messages/.write` at the root is removed. Per-message, reply, attachment, and like writes plus validations are added under `$id`.
  - `userUploads/$id` loses the public create rule (`status === 'pending'`) and becomes `false` with an `id === $id` validate, so upload records must come from the callable.
  - Reads narrow from admin to super: `adminAlerts`, `config/adminAlertRecipients`, `recoveryRequests`, `recoveryAudit`.
  - Writes narrow from admin to super: `features`, `promotedRoute`.
  - `clans/.read` narrows from public to signed in.
  - Indexes: `media` gains `fileName` and `folderName`; `recoveryRequests` gains `status`.
  - Storage narrows from all paths open to `userUploads` (public create up to 50 MB, signed-in get/list/delete), `photos` and `videoScreenshots` (public get, signed-in list/create/delete), and a deny-all fallback.
- Deploy consequence to confirm before sign-off: the admin-to-super narrowings mean a non-super admin loses recovery requests, admin alerts, alert recipients, feature-flag writes, and promoted-route writes once production takes `after.json`.
- `before.json` sha256: `94c0fb91088f3bced4f6abafe56409cfb3464959851d5b441ebf32221d6a86b3`.
- `after.json` sha256: `94d6eab36aa160c62dfd5b9ba99df7dbd5bc2ab365fa017d304314a17ce6c4e9`.
- `before-storage.rules` sha256: `142adcc4e0e0e73ad3bb609205b39099436e4e830cc5d6e2b4f299a80c117eb0`.
- `after-storage.rules` sha256: `547a3158b35d737224a25cf5a85f64ab6a1fece49167c360b7e2e4bc9a10f55b`.
