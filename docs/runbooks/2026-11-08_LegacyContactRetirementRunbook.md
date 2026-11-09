# Legacy Contact Retirement Runbook

Operator runbook for UI-013 and the `contacts` RTDB node. The code change is shipped. The migration has not been run against any project.

## Scope

Delete the retired `contacts` Realtime Database node in dev and then prod. People is the sole source of truth, so no legacy contact data is preserved. The script is `scripts/migrations/drop-legacy-contacts.mjs` and the npm alias is `npm run migrate:drop-contacts`.

## Preconditions

- This change is deployed, so the legacy admin UI and the app writes are gone.
- The `contacts` block is removed from `database.rules.json` and the rules are deployed. The script first refuses while the checked-in rules still grant a client write, then reads the target project's deployed rules and refuses while those still grant a write at the top level or under `contacts/$id`.
- Only `lecoursville-dev` and `lecoursville` are accepted, and the log names the environment.
- A prod backup export is an open human decision. Take one before the prod run if the operator requires it, because the deleted node cannot be restored from this repo.

## Commands

Run the dry run first. It reports the timestamp, the project, the environment, the record count, and the byte size, then exits without writing. The dry run cannot verify that People is the sole source of truth, so it prints that warning explicitly.

```bash
npm run migrate:drop-contacts -- --project lecoursville-dev
```

Run the prod dry run before the dev delete so the prod count and byte size are reviewed while nothing has been destroyed.

```bash
npm run migrate:drop-contacts -- --project lecoursville
```

Verify People is the sole source of truth or take an export, then acknowledge it. `--confirm` exits non-zero without `--acknowledge-people-source`.

```bash
npm run migrate:drop-contacts -- --project lecoursville-dev --confirm --acknowledge-people-source
```

Delete in prod after the dev run is clean.

```bash
npm run migrate:drop-contacts -- --project lecoursville --confirm --acknowledge-people-source
```

The script deletes only `contacts/`. It reads the node back after the delete and exits non-zero if records remain. A second run reports zero records and exits zero, so the migration is idempotent. The old `--rules <path>` bypass is gone. The checked-in check always reads `database.rules.json` from the repo root.

## Verification

- The dev run logs `after: records=0 bytes=...`.
- A second dev run logs `nothing to delete` and exits zero.
- A direct client write to `contacts` is denied by the deployed rules. The gate covers this boundary in `e2e/specs/rules.spec.ts`.
- The user-facing `/contacts` page still renders from People.

## Ordering Note

The spec lists migration before the rules block removal. The script requirement says it must refuse while client writes are allowed. This runbook drops the rules block before the migration, which satisfies the check and prevents clients from recreating the node between the migration and the rules deploy.

## Rollback

Revert the code with git. The deleted node is not restorable from this repo. The dry-run report and any operator backup export are the safety record.

## Current Status

- Script, dry run, unit test, and runbook shipped with UI-013.
- Migration not run against dev, prod, or the emulator.
- Rules block removal ships in the same code change as the UI removal.
