# Dev Seed Module

Spec for UI-008. Workstream WS8. Independent spec and build track. Never touches prod.

## Goal

A dev-only, reseedable module that fills every user-facing page with fictional non-family dummy data so the dev project can be reviewed end to end.

## Non-Goals

- No change to the bulk `scripts/e2e/seed.mjs` fixture set. It gains only one small pinned upload fixture.
- No production data. No real family member, contact, or location.
- No copyrighted media or lyrics.

## Current State

- No dev-data module exists. `scripts/dev-seed/` is absent.
- `scripts/e2e/seed.mjs` is 625 lines and coupled to the e2e gate. `scripts/family/upload-people.mjs` is a one-off uploader.
- `.firebaserc` defaults to `lecoursville-dev`. Prod is `lecoursville`. `scripts/deploy.sh` owns dev deploy.

## Shape

- New module `scripts/dev-seed/` with `index.mjs` and `npm run seed:dev`.
- Per-class manifest: videos, expressions, photo albums, audio albums, songs, people, contacts, calendar events, families.
- A license ledger recording source URL, license, and attribution for every public-domain asset.
- Idempotent reseed under a `devseed-` id prefix and a `dev-seed/` storage prefix. A rerun replaces only its own records.
- Hard guard: refuse unless the project is exactly `lecoursville-dev`, and require an explicit `--confirm`. Never read a prod credential.
- `--clean` removes only `devseed-` records.

## Content

- 20 public-domain videos, small mp4 or webm.
- 20 public-domain expressions or quotes with correct attribution. No invented or misattributed living-person quotes.
- Several photo albums with public-domain images.
- Several audio albums with public-domain recordings.
- A song set with public-domain or original placeholder lyrics. Never ship copyrighted lyrics.
- Fictional people, contacts, calendar events, and families, cross-linked to seeded media.

## Pipeline

- Download to a gitignored cache, verify checksum and license metadata, upload to the dev Storage bucket, write records through the Admin SDK, and print a summary.
- Delete the cache after a successful run, or on exit, so assets do not linger on disk. Keep only the manifest and license ledger in the repo.

## E2E Reuse For Admin Media Upload

Yes, reuse the manifest and downloader to prove Admin Media Upload, with guardrails.

- The e2e gate never hits the dev project and never downloads live from an archive at gate time. A live download would make the gate slow and flaky.
- Commit a tiny pinned public-domain fixture set, or cache it under the same gitignored cache with a checksum, and have the e2e seed reference it.
- A new `e2e/specs/admin-upload.spec.ts` drives the real Admin Media Upload UI against the emulator, uploads one pinned small mp4, and asserts the stored object and the media record.
- Keep this fixture set separate from the bulk dev seed so a full reseed never changes e2e determinism.
- The dev seed module and the e2e fixture share the manifest format and the license ledger, not the runtime.

## Decisions

- Download at seed time into a gitignored cache, do not commit bulk assets, and clear the cache after the run.
- Accept Internet Archive and Library of Congress sources with a human-checked license ledger.
- Use a dedicated `devseed-` content owner.
- Keep fully separate from the e2e seed at runtime, while sharing the manifest format and license ledger.
- Reuse a tiny pinned fixture subset to add an Admin Media Upload e2e spec.

## Safety And Rollback

- Project guard plus `--confirm` before any write.
- `--clean` is scoped to `devseed-` records only.
- Roll back by running `--clean`. No production exposure at any point.

## Accessibility And UX

The seeded data exists to exercise real pages. It must not add controls. Seed enough varied content to prove empty, populated, and long-list states.

## Verification

- A dev deploy and a browser pass over every user-facing page.
- Redteam on prod safety, license compliance, and idempotency.
- A rerun proves no duplicate records. A `--clean` proves no stray records. The cache is gone after the run.

## E2E Coverage

- `e2e/specs/admin-upload.spec.ts` uploads one pinned small public-domain mp4 through the real Admin Media Upload UI against the emulator and asserts the stored object and record.
- This is the only Playwright addition. The bulk dev seed stays dev infrastructure and is verified by the browser pass plus an idempotency dry-run.
- The gate must stay offline and deterministic, so the pinned fixture is committed or cached with a checksum, never fetched live during the gate.

## Resolved Decisions And Open Questions

- Resolved: assets download at seed time into a cleared cache, bulk set separate from e2e, dedicated dev owner.
- Resolved: reuse a small pinned fixture for an Admin Media Upload e2e spec.
- Resolved: sources are Internet Archive and Library of Congress with a human-checked ledger.
- Open human decision: who signs off the license ledger before the first dev run.
