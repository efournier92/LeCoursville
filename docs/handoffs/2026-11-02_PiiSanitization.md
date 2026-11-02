# Handoff: PII Sanitization

- Date: 2026-11-02
- Branch: `2026-11-02_CleanUp`
- Discovery: D-20261102-01 through D-20261102-07
- Ledger: `docs/critique/2026-11-02_PiiSanitization.md` (CONVERGED)
- Plan: `docs/specs/2026-11-02_PiiSanitization.md`
- Review inventory (outside repo, contains real names): `/tmp/pii-inventory-2026-11-02.md`

## Current State

Done and gate-green:
- Real family labels removed from seed, e2e, unit, and functions fixtures. Neutral labels are Alder and Cedar.
- The untracked `src/environments/app-settings.ts` (real 13-name list) is deleted. Non-secret settings now live in tracked `src/app/config/app-settings.ts`.
- Contact editor reads families from `FamilyService`, sorts by `sortOrder`, tracks by id, and renders loading, error, and empty states.
- `HeaderAttributionText` retains its original value by owner decision.
- Real-name chat screenshot and real family-farm screenshot deleted, README embeds removed.
- `scripts/check-pii-canary.mjs` (SHA-256 only) runs in `scripts/e2e/gate.sh` and `npm run pii:check`.
- One new contacts e2e test covers the DB-backed family dropdown.
- Docs redaction (W4) is complete: real family and person identifiers across `README.md`, `design_specs/`, and the affected `docs/` ledgers and specs now use neutral placeholders. The canary scans `docs/` and `design_specs/` and reports clean.

Verification this session: unit 769, functions 303, e2e 389 on Chromium, WebKit, and Firefox, canary clean. Full gate artifacts are dated 2026-11-02 17:11 to 17:31.

Not done by design:
- The live family-explorer key and title are admin-created production data and stay in the database. The repo no longer references them.
- Git history rewrite is declined; residual is documented.

## Key Decisions

- Only the owner identity (Eric / efournier92) is exempt. Every other real-person reference must go. The one exception is the retained 1984 Expressions header attribution, re-confirmed by the owner on 2026-11-02.
- Real family data stays in the auth-gated database. Production is not purged.
- Production storage stays public for photos and anonymous `userUploads` create is deliberate.
- The live archive key and title stay in the database as admin-managed data. The repo carries neutral fixtures only.
- Docs are documented first, redacted later; history rewrite is declined.

## Next Actions

1. [DONE 2026-11-02] W4 docs redaction applied after owner review of `/tmp/pii-inventory-2026-11-02.md`. Remaining doc work: none. The canary scope now covers `docs` and `design_specs`.
2. Optional data-only cleanup: `docs/specs/2026-11-02_FamilyArchiveKeyMigration.md` is no longer
   required for code hygiene. Execute only if the owner wants the live key renamed.
3. Commit only the PII files. Do not stage the pre-existing unrelated edits listed below.
4. Optional: add the `/tmp` inventory to the repo's private records outside git.

## Verify Commands

```bash
node scripts/check-pii-canary.mjs
CI=true npm test -- --watch=false
npm --prefix functions test
npx ng build --configuration=e2e
npm run e2e:gate
```

## Open Risks / Blockers

- Pre-existing unrelated working-tree edits are present and must not be staged with this change:
  `angular.json`, `e2e/helpers/admin-db.ts`, `functions/package*.json`, `functions/src/helpers.ts`,
  `package-lock.json`, `scripts/family/upload-people.mjs`, `scripts/migrations/clan-to-family.mjs`,
  `src/app/components/admin-media/admin-media.component.ts`, `src/app/services/admin.service.ts`,
  `src/app/services/cloud-functions.service*.ts`, `src/styles.scss`, `src/test-setup.ts`.
- `messages`, `photos`, and `photoAlbums` accept any authenticated token, `media` and published
  `familyExplorer` are public, and prod storage photos are public. Recorded, not changed.
- Git history retains the identifiers; accepted residual.
