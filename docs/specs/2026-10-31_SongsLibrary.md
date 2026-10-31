# Songs Library

Branch context: target branch `2026-10-31_Songs`, off the current trunk. Single PR, no data migration, no functions or Storage changes.

## Context & Motivation

LeCoursville is a big musical family. We sing: at gatherings, at Mass, around fires, at Christmas. Today there is no home for the family songbook. Recorded audio exists (the Media feature, `src/app/config/feature-config.ts:14`), but lyrics, chords, and the question "who leads this one again?" have nowhere to live.

This spec adds a Songs library: admin-authored song entries (title, plain-text lyrics with optional Ultimate-Guitar-style chords, optional source and key, zero or more family members noted as known for leading it), browsable and searchable by every approved member, with chord transposition (bracket notation only) and a print-friendly detail page.

## Glossary

Project glossary lives at `docs/GLOSSARY.md`; two terms were added there for this feature. Definitions the requirements depend on, inlined so this spec stands alone:

**Song**: a library entry at RTDB `songs/$id`: title, one plain-text `body` holding lyrics and optional chords, optional `source`, optional `musicalKey`, and `leaderIds`.

**Song Leader**: a person referenced by `leaderIds` entry as someone known for leading the song. Zero or more per song. Not the author, not the singer on a recording.

**Body**: the single plain-text field holding everything sung or played: lyrics, and optionally chords either inline in `[C]` bracket notation or on their own lines above lyric lines (Ultimate-Guitar paste style). Rendered verbatim in a monospace block.

**Bracket chord**: a chord written inside square brackets, for example `[G]`, `[Bm7]`, `[D/F#]`. The only transposable form.

## Current State

Anchored facts the design builds on:

- Nav entries come from `FEATURES` in `src/app/config/feature-config.ts:10-22`; `{ id: 'music', label: 'Music', route: '/media/audio', icon: 'library_music' }` sits at line 14. Existing features default ON when no RTDB flag record exists (`feature-config.ts:6-7`).
- Feature flags are RTDB `features/<id>` records read by `src/app/services/feature-flags.service.ts:23,37,55,58`; the load fails open (`:42-44`). Route gating uses `FeatureFlagGuard` with `data.featureId` (`src/app/services/feature-flag-guard.service.ts:17-41`), wired per route in `src/app/app-routing.module.ts` (chat at `:40-44`, expressions at `:46-50`).
- Lazy feature modules are the pattern for newer domains: calendar (`app-routing.module.ts:33-38`, module at `src/app/components/calendar/calendar.module.ts`), media (`:89-92`), family-explorer (`:78-82`), admin (`:93-98`). Non-PII routes guard with `[AuthGuardService, FeatureFlagGuard]`; PII routes add `ApprovedGuardService` (contacts `:27-32`, people `:70-75`).
- Admin: roles live at RTDB `users/$uid/roles` (`src/app/models/user.ts:24-28`); `/admin` is guarded by `[AuthAdminGuardService, SuperAdminGuard]` (`app-routing.module.ts:94-98`). Admin child routes and nav are table-driven: `ADMIN_ROUTE` and `ADMIN_NAV` in `src/app/admin/admin-nav.ts:4-16,33-45`, routes in `src/app/components/admin/admin.module.ts:25-85`. An admin file-import precedent exists: `AdminPeopleImportComponent` (`admin.module.ts:21,51-53`).
- Admin UI consistency contract: fixed 64px/56px title bar with filters in a separate row (`design_specs/2026-10-22_admin_consistency_contract.md`, discovery D-20261022-03); shared `PageToolbarComponent` and `AdminFilterBarComponent` are imported at `admin.module.ts:12-13`.
- Data access: `RtdbService` (`src/app/services/rtdb.service.ts:1-25`), a thin RxJS wrapper over modular `firebase/database`. Service pattern to copy: `src/app/services/contacts.service.ts:44-61` and `people.service.ts:41` (direct `rtdb.object('people/'+id).set/update/remove` writes from admin UI).
- Rules: domain nodes use the `people` pattern, member read and admin write (`database.rules.json:184-187`); `userUploads` adds a `$id` self-key validate (`:200-203`).
- Person model: `src/app/models/person.ts:27-45`; display name convention is `firstPreferred || firstGiven` (house pattern, `src/app/services/calendar.service.ts:81,87`). People deep-link: `/people?selected=<personId>` (query param read at `src/app/components/people/people.component.ts:49`, `openPersonDetail` at `:179`).
- Long-form text precedent: `Expression.body` is an HTML string rendered with `[innerHTML]` (`src/app/components/expression-view/expression-view.component.html:8`). This spec deliberately diverges: song bodies render via plain interpolation only.
- No song/hymn/lyric/chord/setlist code exists anywhere today (recon sweep, confirmed absent).
- E2E: 27 specs under `e2e/specs/`; specs import `test` from `e2e/helpers/fixture.ts:9,20` (console-error collector asserts clean at `:16`); auth helpers at `e2e/helpers/auth.ts:3,15`; admin REST helpers `readDb`/`writeDb`/`deleteDb` at `e2e/helpers/admin-db.ts:21,29,33`; flag flips must be restored via Admin-SDK write in `finally` (discovery D-20261030-10); rules REST checks in `e2e/specs/rules.spec.ts` with helpers at `e2e/helpers/rules.ts:20,36`. Seed: `scripts/e2e/seed.mjs` builds one `tree` (`:433`) written in a single `set` (`:507`); media records at `:386` are the pattern to copy; `FEATURE_IDS` at `:40`; chat is the only flag seeded OFF (`:441`).

## Goals

1. Admins build a song library by pasting song text or uploading `.txt` files, through one parser with identical results.
2. Members browse, search (title, lyric text, source, leader name), and open a clean song page.
3. Optional zero-or-more song leaders, shown as person chips that deep-link into People.
4. Monospace verbatim rendering so chord-over-line alignment survives.
5. Display-only transposition of bracket chords.
6. Print-ready song sheets from the detail page.
7. Songs sits behind its own feature flag with a navbar entry; the recorded-audio destination is relabeled Audio, unchanged otherwise.

## User Stories

1. As a Member, I want to browse the family songbook at `/songs`, so that I can pick something to sing.
2. As a Member, I want to search by title, so that I find a known song fast.
3. As a Member, I want to search by any lyric line, so that I find a song whose title I forgot.
4. As a Member, I want search to ignore accents and case, so that typing `noel` finds a song titled `Noël`.
5. As a Member, I want to see who is known for leading a song, so that I know who to ask.
6. As a Member, I want to tap a leader chip and land on that person in People, so that the library connects to the family tree.
7. As a Member, I want songs with no leader to show no leader UI at all, so that the page never invents data.
8. As a Member, I want the body rendered verbatim in monospace, so that chords sit above the right syllables.
9. As a Member, I want to transpose a bracket-chord song up or down in semitones, so that it fits my voice.
10. As a Member, I want a one-tap reset of transposition, so that I get back to the written key.
11. As a Member, I want transposition to never alter the stored song, so that my experimenting cannot corrupt the library.
12. As a Member, I want to print a song with no app chrome, so that I can hand out lyric sheets at a gathering.
13. As a Member, I want an empty-library message, so that I understand the library exists but is not filled yet.
14. As a Member, I want a Songs link in the navbar, so that the library is one tap away.
15. As a Member, I want the recorded-audio library still reachable as Audio, so that nothing I use today disappears.
16. As a Member with songs disabled, I want the standard feature-disabled page, so that I understand why access is refused.
17. As an Admin, I want to paste raw song text and get a parsed editable draft, so that adding a song means paste, check, save.
18. As an Admin, I want to upload one or more `.txt` files and get the same parsed drafts, so that batch entry from an existing songbook file is fast.
19. As an Admin, I want an optional header block (`Title:`, `Source:`, `Key:`, `Leader:`) recognized at the top of pasted or uploaded text, so that a file can carry its own metadata.
20. As an Admin, I want header files without a title to fall back to the first non-empty line, so that plain Ultimate-Guitar pastes still import cleanly.
21. As an Admin, I want `Leader:` names auto-matched to people, so that linking is usually automatic.
22. As an Admin, I want unmatched leader names flagged before save, so that a typo never silently drops a leader.
23. As an Admin, I want every field editable in the draft before saving, so that no parsing mistake reaches the family.
24. As an Admin, I want to edit a published song, so that I can fix a wrong lyric, key, or leader.
25. As an Admin, I want to delete a song behind a confirmation, so that a misclick cannot destroy work.
26. As an Admin, I want `/admin/songs` in the admin sidebar under Content, so that song management lives beside Media and Photo Albums.
27. As a Super Admin, I want to toggle the songs flag on the Features page, so that I control the rollout.
28. As a Super Admin, I want database rules to block all client writes to `songs`, so that only admins can mutate the library.
29. As an unauthenticated visitor, I want to be bounced to sign-in, so that the family songbook stays private.

## Non-Goals

- Categories or tags (deferred; search and leaders carry discovery in v1).
- Member favorites or any per-user song state (new rules surface, deliberately out).
- Setlists, events, "sung on" history.
- Audio attachments or links from a song to Media tracks.
- Retaining imported `.txt` files anywhere (no Storage, no re-processing).
- PDF export (browser print covers it).
- Transposing chord-over-line layouts (bracket chords only).
- Server-side search, pagination, or `.indexOn` (client-side filtering at family scale, same as People).
- Member-submitted songs or edit suggestions.
- i18n of UI copy (English UI like the rest of the app).

## Prerequisites

None. Emulator gate, seed script, e2e helpers, and admin patterns all exist today.

## Design Principles

1. Copy the house pattern everywhere: lazy feature module like calendar, `RtdbService` like contacts, table-driven admin nav, admin consistency contract toolbar.
2. Plain text is the source of truth. One `body` field, pasted as-is, rendered as-is. The app never rewrites stored text; transposition is a pure display transform.
3. One parser, two doors. Paste and file upload produce the same string and flow through the same `parseSongText`; drafts are always editable before the first write.
4. Interpolation only. Song text renders inside `<pre>` via `{{ }}`, never `[innerHTML]`, so lyric content is escaped by construction.
5. Minimal surface: no callable functions, no Storage rules, no migrations. Rules gain one block; config gains two entries.

## Backend / Data Requirements

### RTDB shape

New node `songs`, one record per song, keys are `crypto.randomUUID()`:

```
songs/$id:
  id: string            // equals the key; validated by rules
  title: string         // required, trimmed, 1..200 chars
  body: string          // required, plain text, '\n' newlines, 1..100000 chars, trimmed of trailing blank lines
  source: string | null // optional, trimmed, max 200 chars, null when absent (artist, writer, hymnal)
  musicalKey: string | null // optional, trimmed, max 16 chars, null when absent (e.g. 'G', 'Dm')
  leaderIds: string[]   // 0..n person ids; every id must exist under people/; duplicates stripped on save
  createdAt: number     // epoch ms, set on create, never changed
  updatedAt: number     // epoch ms, set on every write
```

No `.indexOn`: the member list view loads the whole node once (same client-side-filtering approach as People and Contacts).

### Rules

Insert a `songs` block in `database.rules.json` immediately after the `photoAlbums` block (which ends at `database.rules.json:195`), copying the People read rule verbatim (`:185`) and the userUploads self-key validate pattern (`:200-203`):

```
"songs": {
  ".read": "auth != null && root.child('users').child(auth.uid).child('roles/user').val() === true",
  ".write": "auth != null && root.child('users').child(auth.uid).child('roles/admin').val() === true",
  "$id": {
    ".validate": "newData.child('id').val() === $id"
  }
}
```

Members read, admins write, nobody else touches it. Super admins pass the admin check because `roles/super` holders are also granted admin in `auth-admin-guard.service.ts:33` conventions; the rules line above stays the single source (same as `people` at `:186`).

### Service

New `src/app/services/songs.service.ts`, mirroring `contacts.service.ts:44-61` and `people.service.ts:41`:

- `songs$: Observable<Song[]>` from `rtdb.list('songs')` (value changes, single subscription held by list and detail components).
- `getSong(id: string): Observable<Song | null>` from `rtdb.object('songs/' + id)`.
- `saveSong(song: Song): Promise<void>`: `rtdb.object('songs/' + song.id).set(...)`, stamps `createdAt` (if new) and `updatedAt`.
- `updateSong(id: string, patch: Partial<Song>): Promise<void>`: `update` plus `updatedAt` stamp.
- `deleteSong(id: string): Promise<void>`: `remove()`.
- New model `src/app/models/song.ts` exporting the `Song` interface exactly as the schema above, `null`-typed optionals included.

### Parser (pure, shared by paste and file)

New `src/app/services/song-parser.ts`, exported pure function, no Angular dependencies (unit-testable like `media-naming` utilities):

```
parseSongText(raw: string, people: Person[]): {
  title: string;            // '' when absent
  body: string;             // '' when absent
  source: string | null;
  musicalKey: string | null;
  leaderIds: string[];
  unmatchedLeaders: string[]; // raw Leader: names with no person match
}
```

Deterministic rules, in order:

1. Split `raw` on `\n`. Skip leading blank lines.
2. Header block: consume consecutive lines matching `/^(title|source|key|leader)\s*:\s*(.*)$/i`. The block ends at the first non-matching line. When the block ends with a blank line, drop that one blank line; everything after is the body.
3. Field extraction: `Title:` last occurrence wins; same last-wins for `Source:` and `Key:`; every `Leader:` line contributes one candidate name. Empty values are treated as absent.
4. No header lines matched: `title` = first non-empty line (trimmed); `body` = everything after that line.
5. Leader matching: each candidate name, trimmed, lowercased, diacritics-folded (`normalize('NFD').replace(/[\u0300-\u036f]/g, '')`), compared against each person's `firstPreferred` then `firstGiven` (same folding). First match wins; the person's id is appended to `leaderIds`. No match: the raw name goes to `unmatchedLeaders`.
6. Body: trim trailing blank lines; preserve internal blank lines exactly; do not otherwise alter whitespace.
7. The parser never throws. Validation errors are the draft form's job (next section).

### Transpose (pure)

New `src/app/services/chord-transpose.ts`, pure functions:

- `BRACKET_CHORD = /\[([A-G](?:#|b)?(?:m|maj|min|sus|dim|aug|add|M)?[0-9]*(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?)\]/g`
- `hasBracketChords(body: string): boolean`: true when at least one bracket token matches.
- `transposeBody(body: string, semitones: number): string`: replaces each matched bracket chord's root (and slash bass, when present) shifted by `semitones`, wrapping within one octave (`((n + 12) % 12)`). Semitone map: C=0, D=2, E=4, F=5, G=7, A=9, B=11, plus `#` (+1) or `b` (-1) modifier on the letter. Spelling rule: if the source root letter carried a flat, the target is spelled flat (`Db`, `Eb`, `Gb`, `Ab`, `Bb`); otherwise the target is spelled sharp (`C#`, `D#`, `F#`, `G#`, `A#`). Suffixes (quality, added numbers, parentheticals) pass through unchanged. Bracket contents the regex cannot fully consume as a chord, and all text outside brackets, are returned byte-identical. `semitones === 0` returns the input string.

### Functions and Storage

Deliberately none. Parsing runs in the browser (`FileReader` for files); writes go straight to RTDB under the admin rules above. Imported files are never uploaded or retained.

## Frontend / UI Requirements

### Member routes and module

- New lazy module `src/app/components/songs/songs.module.ts` (`SongsFeatureModule`) declaring `SongsListComponent` (`/songs`) and `SongDetailComponent` (`/songs/:id`), modeled on `src/app/components/calendar/calendar.module.ts`.
- `src/app/app-routing.module.ts`: insert after the calendar entry (after line 38) two entries in the established shape:

```
{ path: 'songs', canActivate: [AuthGuardService, FeatureFlagGuard], data: { featureId: 'songs' },
  loadChildren: () => import('./components/songs/songs.module').then(m => m.SongsFeatureModule) },
{ path: 'songs/:id', canActivate: [AuthGuardService, FeatureFlagGuard], data: { featureId: 'songs' },
  loadChildren: () => import('./components/songs/songs.module').then(m => m.SongsFeatureModule) },
```

No `ApprovedGuardService`: lyrics are not PII; this matches chat (`app-routing.module.ts:40-44`) and expressions (`:46-50`). A nonexistent `:id` renders the shared load-error state (`LvLoadErrorComponent` pattern).

### Nav and flags

- `src/app/config/feature-config.ts`: insert `{ id: 'songs', label: 'Songs', route: '/songs', icon: 'queue_music' }` immediately before the music entry (line 14), and change line 14's label from `'Music'` to `'Audio'` (id `music` and route `/media/audio` unchanged). Songs defaults ON per the existing-features convention (`feature-config.ts:6-7`); the empty state covers the pre-content window.
- Do not add `songs` to `approvalGatedLinks` (`src/app/components/navbar-links/navbar-links.component.ts:31`): not PII.
- `src/app/services/feature-flags.service.ts` around line 74 carries a toggleable id list; add `'songs'` there if the list is not derived from `FEATURES` (implementer verifies which shape it is; exactly one of the two ends up naming `songs`).

### List page (`/songs`)

- Page title bar via `PageToolbarComponent` ("Songs") with a single search input in the filter row; no other controls in v1.
- Loads `songs$` and `people` once; cards in a responsive grid (Material card list consistent with Contacts).
- Card: title, source (when present, prefixed "Source: ", otherwise nothing), leader chips (one per resolved leader), and a two-line monospace excerpt of the body (first non-blank body line plus one more, collapsed). Songs without chords, source, or leaders render without those rows entirely.
- Leader chip label: `firstPreferred || firstGiven` (house convention, `calendar.service.ts:81`). Chip links to `/people?selected=<personId>`. A `leaderIds` entry with no matching person renders the label "Unknown" without a link (resilient read; person was deleted).
- Search: case-insensitive, diacritics-folded substring match (same fold as the parser) over title, body, source, and resolved leader names; 200ms debounce; results sorted by `title.localeCompare`. Empty query shows all. Zero matches shows the shared `NoResultsMessageComponent` (`src/app/components/no-results-message/`) with the query text.
- Empty library: "No songs yet" and, for admins, a link to `/admin/songs`.

### Detail page (`/songs/:id`)

- Title as heading; below it, one muted line per present field: source, key (label "Key: G" style), leader chips (same label rule as cards, same deep link; append `last` name on the detail page chips).
- Body: `<pre class="song-body">{{ song.body }}</pre>`. The class sets `font-family: 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', monospace;` and `white-space: pre-wrap; word-break: normal;`. Rendering is interpolation only; never `[innerHTML]` (deliberate divergence from `expression-view.component.html:8`).
- Transpose controls, rendered only when `hasBracketChords(song.body)`: `-` and `+` icon buttons, current offset badge (`+2`, `-3`, hidden at 0), and `Reset`. Offset clamps to `-11..+11`. The rendered body is `transposeBody(song.body, offset)`. Transposition never calls the service; reload shows the stored body.
- Print: in `@media print` the navbar, toolbar actions, and transpose controls are hidden (`display: none`), the body block spans full width, and the page prints title plus leaders plus body. Verified in e2e via `page.emulateMedia({ media: 'print' })`.
- Presentation, 2026-10-31 amendment: bracket-inline authoring (`[G]Amazing grace`) stays the canonical format and the stored body is unchanged. On screens 601px or wider, and in print, the detail page derives a chord line above each lyric line from those brackets. On screens 600px or narrower it shows the inline `[G]` view. Chord-over input (chords on their own lines, no brackets) renders verbatim in every view.

### Admin page (`/admin/songs`)

- Component `src/app/components/admin-songs/admin-songs.component.ts` (`AdminSongsComponent`), following the admin consistency contract: fixed 64px/56px `PageToolbarComponent` title bar ("Songs"), filters in the separate row (`design_specs/2026-10-22_admin_consistency_contract.md`, D-20261022-03). Filter: the same search input as the member page.
- `src/app/admin/admin-nav.ts`: add `songs: 'songs'` to `ADMIN_ROUTE` (`:4-16`) and `{ key: 'songs', path: '/admin/' + ADMIN_ROUTE.songs, label: 'Songs', icon: 'queue_music', group: 'Content' }` to `ADMIN_NAV` immediately after the photoAlbums entry (line 39). No `featureFlag`: management stays reachable while the member flag is off, so admins can populate before launch.
- `src/app/components/admin/admin.module.ts`: route `{ path: ADMIN_ROUTE.songs, component: AdminSongsComponent }` after the photoAlbums route (`:36-41`); declare `AdminSongsComponent`; import it alongside the others (`admin.module.ts:16-23` pattern).
- Table rows: title, source, key, leaders (chip labels), updated timestamp (Title-Case prefix plus digits; never a full locale string, discovery D-20261030-19), row actions Edit and Delete.
- Add-song panel with two input doors into the same draft:
  1. Paste: a textarea and a "Parse" button.
  2. File: a multiple `.txt` file input (`accept=".txt"`); each file read via `FileReader` as text.
  Both call `parseSongText(text, people)` and open one draft dialog per parsed song. Files are never uploaded.
- Draft dialog (Material dialog, house style): editable title, source, key, body (monospace textarea), leaders multi-select over people (chip picker), plus a warning row listing `unmatchedLeaders` names ("Not found: X, Y" with a hint to pick manually). Validation on save, exact messages: `"Title is required."`, `"Lyrics are required."`, `"Title must be 200 characters or fewer."`. Save calls `saveSong`. Cancel discards.
- Edit: same dialog prefilled from the stored song; save calls `updateSong`.
- Delete: confirmation dialog ("Delete <title>? This cannot be undone.") then `deleteSong`, matching `admin-users.component.ts:91` copy convention.

## Production Risks & Mitigations

- XSS through song text: interpolation-only rendering inside `<pre>`; Angular escapes bindings; `[innerHTML]` is banned for song content by this spec.
- Chord alignment lost on wrapped lines: `pre-wrap` wraps long lines on narrow screens, which can shift a chord line from its lyric line. Accepted tradeoff (print and desktop are the primary consumption surfaces); documented here rather than solved with synced wrapping.
- Parser ambiguity (header-less file whose first line is a chord line or a lyric, not the title): drafts are always editable and previewed before save; nothing commits blind.
- Flag defaults ON with an empty library: the empty state names the cause and links admins onward; Super can flip it off on the Features page until content is loaded.
- Duplicate titles: allowed (distinct ids); the card's source and leader rows disambiguate; no silent dedupe.
- Node growth: bodies capped at 100,000 chars by validation; a family songbook of hundreds of songs is a few MB, comparable to People with addresses. No pagination in v1, revisited if the node ever crosses low tens of thousands of records.
- Transposition edge cases (French note names Do/Re/Mi inside brackets, exotic qualities): regex only rewrites fully-consumed A-G roots; anything else passes through verbatim and visibly.
- Rules deploy timing: `database.rules.json` ships with the normal release flow; emulator rules tests cover the block before deploy (and long-lived-emulator staleness is a known gate concern, D-20261030-11, owned by `scripts/e2e/gate.sh`).

## Rollout Plan

1. Implement on branch `2026-10-31_Songs`: model, service, parser, transpose util, rules block, member module and routes, admin page, nav and flag config, seed additions, all specs.
2. `npm run e2e:gate` green on Chromium, WebKit, Firefox (rules and storage-prod projects included per `playwright.config.ts:25`).
3. Ship behind the default-ON `songs` flag in one release; rules deploy with it. No backfill, no migration.
4. Post-launch: admins import the existing songbook; announce when the library is non-empty.

## Test Plan

Per `docs/testing/TEST_POLICY.md`: behavior asserted at the lowest provable layer, e2e for every user-visible change, deterministic waits only, state restored, `test` imported from `e2e/helpers/fixture.ts:9`.

### `e2e/specs/songs.spec.ts` (new)

Member happy paths:

1. `/songs` lists the four seeded songs, sorted by title.
2. Search by title narrows to the matching song.
3. Search by a lyric substring from a body narrows to that song.
4. Accented search: typing `noel` finds the `Noël` song.
5. Clearing the search restores the full list.
6. A no-match search shows the no-results message containing the query.
7. Card shows leader chips; detail shows the same leaders with last names.
8. Tapping a leader chip navigates to `/people` with that person open (`selected` param).
9. The no-leader seeded song renders zero leader chips on card and detail.
10. Detail body element computes to a monospace font stack and its text preserves newlines from the stored body.

Transpose:

11. On the bracket-chord song, `+` once changes the visible `[G]` to `[G#]` (sharp spelling from a natural root) and the offset badge reads `+1`.
12. A flat-root bracket (`[Bb]`) plus two renders `[C]`.
13. `Reset` restores the exact stored body text and hides the badge.
14. The chord-over-line seeded song (no brackets) renders no transpose controls.
15. After transposing, a reload shows the untransposed stored body (display-only proof).

Print:

16. `page.emulateMedia({ media: 'print' })`: navbar and transpose controls are hidden, title and body remain visible.

Flag:

17. Flip `songs` off via Admin-SDK `writeDb`, expect redirect to `/feature-disabled?feature=songs`, restore the flag to on in `finally` (D-20261030-10).

Admin authoring:

18. Paste flow: open `/admin/songs`, paste header-format text (Title, Source, Key, two `Leader:` lines, one unmatched), parse: draft opens with fields prefilled and the unmatched name listed as not found; fix leaders via the picker; save; the song appears in the member list.
19. File flow: `setInputFiles` a `.txt` with the same header content; the identical draft opens; save; result identical to the paste flow.
20. Header-less file: first non-empty line becomes the title, the rest the body.
21. Save with a cleared title is blocked with `"Title is required."`.
22. Edit: change a published song's title and key; the member detail reflects both.
23. Delete: confirmation appears naming the song; confirming removes it from the admin table and the member list.

### `e2e/specs/feature-flags.spec.ts` (extend)

24. The Features page shows a Songs row; toggling it persists (existing row patterns).

### `e2e/specs/nav.spec.ts` (extend)

25. The navbar shows Songs and Audio; Songs navigates to `/songs`; Audio still navigates to `/media/audio`.

### `e2e/specs/rules.spec.ts` (extend)

26. RTDB REST with a member token reads `songs` (allowed), an unauthenticated read is denied, a member write is denied, an admin write with a mismatched `id`/key is denied by the `$id` validate (helpers at `e2e/helpers/rules.ts:20,36`).

### Unit specs (vitest, `npx ng test --include`, D-20261025-12)

`src/app/services/song-parser.spec.ts`:

27. Header block parse: all four keys, values trimmed.
28. Last duplicate `Title:` wins.
29. Header-less input: first non-empty line is the title; remaining lines the body.
30. Leader exact match by `firstPreferred`, and by `firstGiven` fallback.
31. Leader match folds case and diacritics (`Éric` matches `eric`).
32. Unmatched leader names land in `unmatchedLeaders`, not `leaderIds`.
33. Leading blank lines skipped; the one blank line after a header block dropped; internal blank lines preserved; trailing blank lines trimmed.
34. Empty input returns empty fields without throwing.

`src/app/services/chord-transpose.spec.ts`:

35. `hasBracketChords` true/false for bracket and bracket-less bodies.
36. `G` plus 1 gives `G#`; `B` plus 1 wraps to `C`.
37. Flat roots stay flat: `Bb` plus 2 gives `C`; `D` minus 1 gives `Db`.
38. Suffixes preserved: `G7` plus 2 gives `A7`; `Bm7` minus 2 gives `Am7`.
39. Slash bass transposes: `G/B` plus 1 gives `G#/C`.
40. Non-chord brackets (`[Verse]`, `[Do]`) and surrounding text pass through byte-identical.
41. Offset 0 returns the identical string.

### Seed (`scripts/e2e/seed.mjs`)

42. `FEATURE_IDS` gains `songs` (on; chat stays the only off flag, `:441`).
43. A `songs` block (modeled on the media block at `:386`) with exactly: one bracket-chord song with source, key `G`, and two `leaderIds` referencing seeded people; one chord-over-line song (no brackets) with one leader; one lyrics-only song with no leaders and `source: null`; one French-accented song (`Noël`) for story 4. Add the `songs` key to the `tree` object (`:433`) so the single `set` persists it (`:507`).

## Summary Of Changes

Sign-off checklist:

1. `docs/GLOSSARY.md`: Song and Song Leader entries added.
2. `src/app/models/song.ts`: new `Song` interface.
3. `src/app/services/songs.service.ts`: new service (list/get/save/update/delete).
4. `src/app/services/song-parser.ts`: new pure parser (paste and file share it).
5. `src/app/services/chord-transpose.ts`: new pure transposer (bracket chords only, display-only).
6. `database.rules.json`: new `songs` block (member read, admin write, `$id` validate).
7. `src/app/components/songs/`: new lazy module with list and detail pages (monospace body, search, leader chips, transpose, print CSS, empty states).
8. `src/app/components/admin-songs/`: new admin page (paste + `.txt` import, draft/edit dialog with unmatched-leader warnings, delete confirm).
9. `src/app/app-routing.module.ts`: `/songs` and `/songs/:id` routes with auth + flag guards.
10. `src/app/config/feature-config.ts`: Songs nav entry; Music relabeled Audio.
11. `src/app/services/feature-flags.service.ts`: `songs` toggleable (unless derived from `FEATURES`).
12. `src/app/admin/admin-nav.ts` + `src/app/components/admin/admin.module.ts`: admin Songs route and nav item under Content.
13. `scripts/e2e/seed.mjs`: songs flag on plus four seeded songs.
14. Specs: new `e2e/specs/songs.spec.ts`; extended `feature-flags.spec.ts`, `nav.spec.ts`, `rules.spec.ts`; new unit specs `song-parser.spec.ts`, `chord-transpose.spec.ts`, `songs.service.spec.ts`.
15. No functions, no Storage changes, no migrations.

## Verification Steps

1. `npx ng test --include src/app/services/song-parser.spec.ts --include src/app/services/chord-transpose.spec.ts --include src/app/services/songs.service.spec.ts` (flag repeats per file, D-20261025-12).
2. `npm run test -- functions` equivalent stays green (no functions changes; the suite must prove nothing broke).
3. `npx ng build --configuration=e2e`, then the emulator loop from `AGENTS.md` for focused iteration.
4. `npm run e2e:gate`: full matrix green (Chromium, WebKit, Firefox, rules, storage-prod).
5. Manual: paste a real Ultimate-Guitar export, print one song, transpose one bracket song on a phone.

## Open Questions

None. All frontier decisions resolved in rounds (nav/flag slot, single body field, multiple leaders, search-only discovery, print + transpose scope, brackets-only transpose, optional-header import, client-side parse with plain text in RTDB, both paste and file input doors, confirmed test seams).
