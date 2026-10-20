# Database Rules History

Versioned snapshots of the Realtime Database rules, paired by date as `before.json` (the ruleset in place before a change) and `after.json` (the reviewed ruleset to apply). The live source of truth is `database.rules.json` at the repo root, which `firebase.json` points at. Snapshots here are point-in-time copies for review and rollback.

## Layout

```
database-rules/
  2026-10-04/
    before.json   # exported from the target project's console before applying
    after.json    # copy of database.rules.json at review time
```

## Why

The apply path is manual: `scripts/deploy.sh` deliberately never targets `database`. A prod-only node silently dropped from the root file would become denied with no record. A dated before/after pair lets a reviewer diff exactly what changes and roll back from the console history.

## Adding An Entry

1. In the Firebase console for the target project, copy the current rules to `database-rules/<date>/before.json`.
2. Copy the root `database.rules.json` to `database-rules/<date>/after.json`.
3. Run `diff database-rules/<date>/before.json database-rules/<date>/after.json` and confirm every hunk is intended.
4. Record the `sha256` of each file in the entry or the pull request.

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
