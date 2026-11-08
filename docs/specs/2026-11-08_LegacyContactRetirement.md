# Legacy Contact Retirement And Migration

Spec for UI-013. Workstream WS3. Runs only after UI-014's People browser is merged.

## Goal

Retire the legacy admin Contacts stack, delete the `Contact` model and the `contacts` RTDB node, and ship a standalone idempotent migration. People becomes the sole source of truth for contact data.

## Non-Goals

- No change to the user-facing `/contacts` route or `ContactsFromPeopleService`.
- No change to `ContactCard` or `contact-info`, which are People view models.
- No deletion of the `contacts` feature flag.

## Current State

- Legacy files exist: `src/app/models/contact.ts`, `src/app/services/contacts.service.ts`, `src/app/components/contacts/contact-edit/`, `src/app/components/contacts/contact-view/`, `src/app/components/admin-contacts/`.
- `app.module.ts` declares both the legacy stack and `AdminContactsComponent`. `admin.module.ts:69-74` routes `/admin/contacts` to `AdminContactsComponent`.
- `admin-nav.ts:9,41` declares the Contacts route and nav item.
- `database.rules.json:18-21` has a live `contacts` block with user read and admin write.
- `scripts/e2e/seed.mjs:43` seeds the `contacts` node.
- `scripts/migrations/` has no contacts migration.
- Keep: `/contacts` route, `ContactsComponent`, `ContactsFromPeopleService`, `ContactCard`, `contact-info`, and the `contacts` feature flag.

## Delete List

| Path | What |
|---|---|
| `src/app/models/contact.ts` | Legacy `Contact` class |
| `src/app/services/contacts.service.ts` | Legacy node reads and writes |
| `src/app/components/contacts/contact-edit/` | Legacy edit surface |
| `src/app/components/contacts/contact-view/` | Declared, unused by templates |
| `src/app/components/admin-contacts/` | Legacy admin fixup list |
| `app.module.ts` legacy declarations and export | Remove |
| `admin.module.ts` legacy contacts routes | Remove |
| `admin-nav.ts` contacts route and nav item | Remove |
| `database.rules.json` `contacts` block | Remove last |

## Migration

New script `scripts/migrations/drop-legacy-contacts.mjs`.

- Standalone, no app import. Uses the Admin SDK through the functions package with the same `createRequire` pattern as `scripts/e2e/seed.mjs`.
- Takes explicit `--project <id>` and refuses without `--confirm`.
- Dry-run by default. Reports node size and record count, then exits.
- Deletes only `contacts/`. Idempotent: a second run reports nothing and exits zero.
- Refuses to run while the rules still allow client writes to `contacts`.
- Logs before and after counts and a timestamp. Never touches another node.
- Add `npm run migrate:drop-contacts`.

## Ordering

1. Ship the code that stops writing and removes the UI.
2. Run the migration in dev, then prod, with human confirmation.
3. Drop the `contacts` rules block and deploy rules.
4. Confirm a client write to `contacts` is denied.

## Downstream Updates

- Remove the seed node at `scripts/e2e/seed.mjs:494`.
- Drop the `/contacts` fixture row in `functions/src/admin-analytics-summary.ts:26`.
- Update the e2e specs that reference the legacy stack: `admin.spec.ts:116`, `nav.spec.ts:155-169`, `security.spec.ts:475-489`, `rules.spec.ts:591-595,685-688,741`, `admin-system.spec.ts:364-377`, `feature-flags.spec.ts:124`, `loading.spec.ts:9,80-87`, `pending-membership.spec.ts:96`, `auth.spec.ts:36-37,122`, `admin-content.spec.ts:449`.
- Distinguish user-facing `/contacts` tests (keep) from `/admin/contacts` and node tests (remove or rewrite to People).
- Delete the legacy unit specs: `admin-contacts.component.spec.ts`, `contact-edit.component.spec.ts`, `contact-view.component.spec.ts`.

## Light, Dark, And Print

No visual change to retained pages. The `/contacts` People view already uses tokens.

## Accessibility

No change to retained pages. Removing a duplicate admin route reduces dead navigation.

## E2E Coverage Matrix

| Change | Spec file | Assertion |
|---|---|---|
| Admin contacts gone | `e2e/specs/admin.spec.ts` | `/admin/contacts` does not resolve and no nav item renders |
| User contacts still works from People | `e2e/specs/contacts.spec.ts` | Contact detail renders from People data |
| Rules block removed | `e2e/specs/rules.spec.ts` | Direct client write to `contacts` is denied |
| Migration idempotent | migration dry-run plus a dev run | First run deletes, second run reports zero and exits zero |
| PII check clean | `npm run pii:check` | No canary leak in seed or fixtures |

## Rollout And Rollback

Dev then prod. No data preservation because People is the source of truth. Roll back the code by revert. The deleted node cannot be restored from this repo, so the dry-run report is the safety record. Take a backup export before the prod run if the operator requires one.

## Resolved Decisions And Open Questions

- Resolved: no legacy contacts data is preserved.
- Resolved: migration runs dev then prod with `--confirm`, dry-run first.
- Open human decision: whether a prod backup export is required before deletion.
