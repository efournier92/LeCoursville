# Family Archive Key Migration

- **Status:** Optional data-only cleanup. The repo no longer references the legacy slug.
- **Date:** 2026-11-02
- **Related:** `docs/specs/2026-11-02_PiiSanitization.md` W3

## Goal

Optionally move the live family-explorer archive off the real-surname data key to a neutral key.
The live key is admin-created production data, so it is out of code scope. Run this only if the
owner wants the live key renamed. The app, seeds, and fixtures already use neutral identifiers.

## Preconditions

- Owner sign-off on the migration window and the key change.
- A read-only export of the legacy archive taken before any write.
- A maintenance window so no client writes land during the transform.

## Steps

1. Export the legacy archive at `<legacy-key>` to a read-only snapshot.
2. Transform the key and payload to the neutral key.
3. Write the neutral key preserving `title`, `published`, `updatedAt`, `updatedBy`, and `people`.
4. Old deep links require a hosting-layer redirect or keeping the old key until the nav link is updated.
5. Update the nav title and link, which are admin-managed database data. The seed and fixtures
   already use neutral identifiers.
6. Deploy the neutral key.
7. Verify parity before removing anything.
8. Delete the legacy key only after every parity check passes.

## Testing Criteria

- People count parity between the legacy snapshot and the neutral key.
- Title and published parity between the legacy snapshot and the neutral key.
- Old deep links require a hosting-layer redirect or keeping the old key until the nav link is updated.
- `npm run e2e:gate` is green.
- `npm run pii:check` is clean.
- A manual visual check confirms no legacy name appears in the bundle or in rendered pages.

## Rollback

Restore the exported legacy key and revert the route and title change.

## History Residual

See `docs/specs/2026-11-02_PiiSanitization.md` for the accepted history residual and the docs redaction backlog.
