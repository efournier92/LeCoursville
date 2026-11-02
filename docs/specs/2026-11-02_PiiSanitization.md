# PII Sanitization

- **Status:** Implemented for code and docs surfaces; gate green. No repo reference to the live archive slug remains.
- **Date:** 2026-11-02
- **Scope decision:** Only the owner identity (`Eric` / `efournier92`) is exempt. Every other
  real person reference must be eradicated. Production records are not purged. Real family data
  is relegated to the database.
- **Verification:** `npm run e2e:gate` green, plus a token-free PII canary that runs inside the gate.

## Goal

Remove every real-person reference other than the owner from the working tree without changing
user-visible behavior, and confirm the production database holding the real records is
auth-gated.

## Non-goals

- Purge or migrate production data.
- Rewrite git history.
- Remove the owner's identity, personal email, or role mailbox.
- Remove the retained 1984 Expressions header attribution. The owner re-confirmed retention on 2026-11-02.
- Rename the product or domain. `LeCours` as a brand or test string is exempt.

## Workstreams

### W1. Family names leave code and read from the database

- The current `src/environments/app-settings.ts` is untracked (`.gitignore:54`), so editing it
  cannot ship and a tracked-tree canary cannot see it. Move the non-secret settings (`calendar`,
  `messages`) to a tracked `src/app/config/app-settings.ts`, delete `families` there, and delete
  the untracked file. Update the three remaining importers.
- `contact-edit.component.ts` reads `FamilyService.families$`, maps to names, sorts by
  `sortOrder` then name, and tracks options by family id (not name, so duplicate names cannot
  throw NG0955). Subscribe in `ngOnInit`, unsubscribe in `ngOnDestroy`.
- Render the `familiesStatus$` loading and error states. A failed read must show a retry message,
  never a silently empty dropdown.
- Legacy `contact.family` values are name strings. Match case-insensitively against DB names and
  keep unmatched values visible. Do not rewrite stored data.
- Preflight: a read-only check confirms the `families` node is populated before the app relies on
  it. If it is empty, the dropdown shows an explicit empty state.
- Mock `FamilyService` in `contact-edit.component.spec.ts` and extend the `RtdbService` stub in
  `admin-contacts.component.spec.ts` with `list` (or mock `FamilyService` there too).
- Replace real family labels in the seed and every test with neutral invented labels; one
  canonical pair everywhere. Files: `scripts/e2e/seed.mjs`,
  `functions/src/maintenance/clan-to-family.spec.ts`, and the e2e and unit specs.
- The CSV fixture in `admin-people.spec.ts` must submit a neutral family label too.

### W2. Remove real-person text and imagery from user-facing surfaces

- `src/app/constants/expression-constants.ts`: retain the personal attribution by owner decision
  (2026-11-02). No change. The constant and its `expressions.component.ts` reference stay.
- `Screenshot_Photos.png`: real archival photo and family-farm caption. Replace with a neutral
  image or remove it and its README embed.
- `Screenshot_Chat.png`: unblurred third-party names and the owner email. Replace or re-blur it
  and update the README embed.
- `README.md:28`: remove the family-side, sibling-count, and surname narrative. Keep the product
  story generic.
- Image replacements cannot be proven by grep. W7 adds a manual visual check to the gate
  checklist.
- Owner-only references (`Eric`, `efournier92`, `eric@`) stay.

### W3. Remove the real family surname from product identifiers

The family-explorer feature previously used a real surname as its route slug, nav title, seed id, and test
fixture id.

- The repo is data-agnostic. The route stays `family-explorer/:familyId`.
- The visible example title and all seed and test fixtures use a neutral label and neutral slug
  (`archive-1` / `Example Family`).
- The live archive key and title are admin-created production data. They stay in the database and
  are not referenced by code, seeds, or fixtures.

### W4. Redact real-family identifiers in tracked docs and specs

- Cover every tracked hit, including `docs/critique/`, `design_specs/clans-ads.md`,
  `design_specs/people-from-csv.md`, `docs/specs/2026-10-28_FamilyExplorer.md`, and the dev-review
  notes.
- Mark historical rollout docs as historical; do not rewrite production reality to match the new
  neutral slug.
- Keep owner email references.
- Provide the full instance list to the user first; docs edits land only after that review.
- Applied 2026-11-02 after owner review of `/tmp/pii-inventory-2026-11-02.md`. Real identifiers became neutral placeholders, the canary now scans `docs/` and `design_specs/`, and the historical rollout docs carry a redaction note.

### W5. Production database and storage confirmation

- Confirmed approved-user reads: `people`, `addresses`, `contacts`, `families`, `calendarEvents`.
- Broader than approved-user and must be recorded or gated:
  - `messages`, `photos`, `photoAlbums` read on `auth != null`, so a pending self-registered
    account can read them.
  - `media` is world-readable.
  - `familyExplorer/$familyId` is world-readable when `published === true`.
- Production storage serves `photos` with `get: if true` and allows unauthenticated
  `userUploads` create.
- **Decision:** production storage stays public for photos and anonymous `userUploads` create is retained as deliberate product behavior, recorded here.
  No rule change ships in this pass.
  The database-node evidence and the recommended gate stand unchanged.

### W6. Purge and regenerate on-disk artifacts

- Delete `dist`, `.angular/cache`, `playwright-report`, `test-results`, `.gate-results`,
  `.gate-logs`, `database-debug.log`, and `.firebase` before the final build.
- Rebuild only through the gate.

### W7. Verification and canary

- `npm run e2e:gate` green.
- A committed PII canary stores SHA-256 hashes of the forbidden tokens, never the tokens
  themselves, and runs inside `scripts/e2e/gate.sh`. A local unhashed list is gitignored for the
  maintainer. The canary scans the tracked tree plus the working tree and excludes only the canary
  file itself.
- Binary assets get a manual visual check in the gate checklist.
- New or updated e2e coverage: DB-backed contact family dropdown (wait on `familiesStatus$` ready,
  assert options, select and save), neutral family-explorer slug, and the expressions header
  credit.
- Unit and functions suites green.
- Cheapest iteration: unit + functions + `ng build --configuration=e2e` + one seeded chromium run
  over contacts, family-explorer, admin-family-explorer, people, and expressions.

## Risks

- The family-explorer slug change touches routes, nav, seeds, and many specs; a missed reference
  is a red gate.
- `FamilyService` loads asynchronously; the contact dropdown must wait for the ready status.
- Git history and the deployed database retain the old strings after this change. Both are
  residual by scope decision.
- Docs redaction can erase useful operational history if overdone; redact identifiers only.

## History residual

- Git history still contains the public commit subject that leaks a third-party surname.
- Historical blobs retain the family-name table, the personal attribution, the seed and test labels, the screenshots, and the README family narrative.
- A history rewrite is declined and the residual is accepted per the 2026-11-02 decision.

## Docs redaction backlog

- Affected doc paths:
  - `docs/critique/`
  - `design_specs/clans-ads.md`
  - `design_specs/people-from-csv.md`
  - `docs/specs/2026-10-28_FamilyExplorer.md`
  - `docs/critique/2026-10-25_DevReview.md`
  - `docs/critique/2026-10-28_FamilyExplorerFeedback.md`
- Method: identifier-only substitution to role addresses or placeholders.
- Redaction runs only after the owner reviews `/tmp/pii-inventory-2026-11-02.md`.

## Implementation outcome (2026-11-02)

- Real family labels removed from seed, e2e, unit, and functions fixtures. Neutral labels: Alder, Cedar.
- `src/environments/app-settings.ts` (untracked, contained the real 13-name list) deleted. Non-secret settings moved to tracked `src/app/config/app-settings.ts`.
- Contact editor reads `FamilyService` from the database, sorts by `sortOrder`, tracks by id, and renders loading, error, and empty states.
- `HeaderAttributionText` retains its original value by owner decision. The real-name chat and family-farm screenshots are deleted and their README embeds removed.
- Canonical upload rule and all existing behavior unchanged.
- `scripts/check-pii-canary.mjs` runs in `scripts/e2e/gate.sh` and as `npm run pii:check`; it stores only SHA-256 hashes and reported clean.
- Docs redaction complete: real family and person identifiers replaced with neutral placeholders across `README.md`, `design_specs/`, and the affected `docs/` ledgers and specs. The canary scans `docs/` and `design_specs/` and reports clean.
- The live archive slug is gone from code, scripts, seeds, and fixtures. The live row stays admin-managed in the database.
- Verification: unit 769, functions 303, e2e 389 on Chromium, WebKit, and Firefox. PII canary clean.
- Not done by design: git history rewrite (declined).
