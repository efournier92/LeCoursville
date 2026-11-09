# Critique Ledger: 2026-11-08 UI Review Batch

- Goal: Implement and redteam UI-001 through UI-031 across workstreams WS1 to WS8
- Started: 2026-11-08
- Branch: 2026-11-08_UxReview
- Lens set: visual, accessibility, testing, product, security

## Findings

### WS1 Design System And Palette

- C-20261108-01 | 2026-11-08 | visual | high | high | addressed | UI-001 warn acceptance is unimplemented: `color="warn"` resolves to the M3 error palette and no component consumes the new warn tokens | `src/styles.scss:230`, `src/app/components/admin-photo-albums/admin-photo-albums.component.html:51`
- C-20261108-02 | 2026-11-08 | testing | high | high | addressed | Switch conversion left a literal `>` text node after six toggles, rendering a visible `Is Sticky? >` row with no spec guarding it | `src/app/components/admin-media-upload-video/admin-media-upload-video.component.html:44`
- C-20261108-03 | 2026-11-08 | accessibility | high | high | addressed | Forced-light print block re-declares an old brand hex and omits `--role-*`, so Super and dark-mode role badges print invisible | `src/styles.scss:707`
- C-20261108-04 | 2026-11-08 | visual | medium | high | addressed | White on `--color-warn-solid` computes 3.97:1, under the spec's 4.5:1 text floor, and warn-solid is not re-emitted in dark | `src/styles.scss:101`
- C-20261108-05 | 2026-11-08 | visual | medium | high | addressed | Warning banners take ink from `--color-accent-strong` while the fill uses `--color-warn-tint`, so warn surfaces bypass the warn tokens | `src/app/components/admin-people-import/admin-people-import.component.scss:132`
- C-20261108-06 | 2026-11-08 | visual | medium | high | addressed | UI-026 leaves two switch sizes: Features uses 36x20 tracks while converted switches use the Material default 52x32 | `src/app/components/admin-features/admin-features.component.scss:112`
- C-20261108-07 | 2026-11-08 | testing | medium | high | addressed | Badge color assertions are light-only and the nav badge has none, so the semantic error badge white on `#F2B8B5` (about 1.7:1) ships untested | `e2e/specs/admin-roles.spec.ts:144`
- C-20261108-08 | 2026-11-08 | testing | medium | high | addressed | The Super-to-Content-Admin disabled rule is untested: the unit test checks only `roles.admin` and no e2e toggles Super | `src/app/components/user-edit/user-edit.component.spec.ts:323`
- C-20261108-09 | 2026-11-08 | testing | medium | high | addressed | Eight converted switches (Published, both Is Sticky, both Should Hide, both circa, chat Sticky) have no spec that toggles them | `e2e/specs/media.spec.ts:826`
- C-20261108-10 | 2026-11-08 | testing | medium | high | addressed | The media-types unit test clicks the host element and never asserts the inner `role="switch"` or `aria-checked` | `src/app/components/media-types-checkboxes/media-types-checkboxes.component.spec.ts:38`
- C-20261108-11 | 2026-11-08 | testing | medium | high | addressed | The commit records no break-restore red proof for the new role-switch and destructive-dialog tests | `git show -s --format=%B c64537c5`
- C-20261108-12 | 2026-11-08 | testing | medium | high | addressed | The per-dialog policy test covers only a light-mode two-button prompt, leaving the one-action info prompt and dark neutral No unasserted | `e2e/specs/edge-cases.spec.ts:233`
- C-20261108-13 | 2026-11-08 | product | medium | high | addressed | The global `.admin-error` flex rule puts the upload banner message and `.admin-error-reason` side by side instead of stacked | `src/app/styles/admin-data.scss:38`
- C-20261108-14 | 2026-11-08 | product | medium | medium | addressed | The forced sign-out prompt has one action but renders as a destructive error-red confirm with a warning triangle | `src/app/errors.service.ts:88`
- C-20261108-15 | 2026-11-08 | visual | low | high | addressed | The 175 ms switch transition is set on `.mdc-switch`, which does not animate travel, so the real thumb travel stays at 75 ms | `src/styles.scss:987`
- C-20261108-16 | 2026-11-08 | accessibility | low | high | addressed | The converted Published switch no longer matches the stale `.upload-form mat-checkbox` rule, so its grid alignment is dropped | `src/app/components/admin-family-explorer/admin-family-explorer.component.scss:10`
- C-20261108-17 | 2026-11-08 | accessibility | low | high | addressed | The chat-edit Sticky switch label is an unassociated sibling span, so the control relies solely on its aria-label | `src/app/components/chat-edit/chat-edit.component.html:107`
- C-20261108-18 | 2026-11-08 | product | low | high | addressed | Destructive confirm labels drift across three languages: message-edit says Yes, photos-legacy says Delete, confirm-dialog says Cancel | `src/app/components/message-edit/message-edit.component.ts:142`
- C-20261108-19 | 2026-11-08 | product | low | high | addressed | The media-type switches never bind checked state to `type.isSelected`, and when all are off the filter silently falls back to all types | `src/app/components/media-types-checkboxes/media-types-checkboxes.component.html:3`
- C-20261108-20 | 2026-11-08 | product | low | medium | addressed | Role switches are not optimistic-with-rollback: a switch reads ON but grants nothing until Save plus a second confirm | `src/app/components/user-edit/user-edit.component.html:100`

### WS2 Admin Shell And Information Architecture

- C-20261108-21 | 2026-11-08 | correctness | high | high | addressed | A second same-day deploy aborts after the deploy has run: `tag_build` still pushes a tag the first run created and `set -e` exits non-zero | `scripts/deploy.sh:76`
- C-20261108-22 | 2026-11-08 | correctness | medium | high | addressed | The version bump is never committed and `tag_build` runs first, so the release tag points at a commit whose package.json declares the old version | `scripts/deploy.sh:88`
- C-20261108-23 | 2026-11-08 | correctness | medium | high | addressed | `/account` is in the allowed pending-route set but no such route exists, so selecting it sends pending users to the wildcard 404 | `src/app/components/admin-features/admin-features.component.ts:30`
- C-20261108-24 | 2026-11-08 | correctness | low | high | addressed | An invalid or feature-disabled pending route falls back with only a one-shot console warning and no user-visible warning | `src/app/services/routing.service.ts:96`
- C-20261108-25 | 2026-11-08 | correctness | low | high | addressed | The 404 card CTA label comes from the approved route while its click routes by approval, so a pending user reads one destination and lands another | `src/app/components/auth/auth.component.ts:183`
- C-20261108-26 | 2026-11-08 | security | low | high | addressed | Admin guards send not-yet-approved users to the approved landing route instead of the configured pending route | `src/app/services/auth-admin-guard.service.ts:39`
- C-20261108-27 | 2026-11-08 | security | low | high | addressed | The promotedRoutePending node is world-readable with no `.validate`, so its shape and allowlist are enforced only client-side | `database.rules.json:178`
- C-20261108-28 | 2026-11-08 | mobile | low | medium | addressed | The People table keeps `overflow:hidden` at phone width, so a long unbroken Contact or Address value clips with no ellipsis | `src/app/components/admin-people/admin-people.component.scss:51`
- C-20261108-29 | 2026-11-08 | testing | high | high | addressed | The UI-023 zero-expressions spec loads seeded cards before deleting, so it never takes the cold empty path and its recorded red proof is not reproducible | `e2e/specs/expressions.spec.ts:84`
- C-20261108-30 | 2026-11-08 | testing | medium | high | addressed | The loading audit spec omits admin-users, admin-recovery, admin-media, admin-analytics, and admin-people-import, and the retry case is absent | `e2e/specs/loading.spec.ts:101`
- C-20261108-31 | 2026-11-08 | testing | medium | high | addressed | No test exercises a signed-in pending user hitting `/` or clicking the logo after the bounce change | `e2e/specs/pending-membership.spec.ts:81`
- C-20261108-32 | 2026-11-08 | testing | medium | high | addressed | The People browser error state and `retryPeople` path are untested despite the spec routing them to edge-cases | `docs/specs/2026-11-08_AdminPeopleBrowser.md:59`
- C-20261108-33 | 2026-11-08 | testing | medium | high | addressed | The shell seed matrix is unmet: recovery fixtures live in-spec, so no seeded outstanding request exists and no closed-status row is exercised | `e2e/specs/admin.spec.ts:158`
- C-20261108-34 | 2026-11-08 | testing | medium | high | addressed | UI-027's deploy bump is unproven: the test reads the same package.json and never invokes deploy.sh, so `set_release_version` can be deleted and still pass | `e2e/specs/admin.spec.ts:240`
- C-20261108-35 | 2026-11-08 | testing | medium | high | addressed | No red proofs recorded for the new super-only rules or the pending-route access change | `docs/testing/TEST_POLICY.md:105`
- C-20261108-36 | 2026-11-08 | testing | low | high | addressed | The row-detail e2e only mouse-clicks and reads text, never pressing Enter, asserting aria, or asserting the zero-box modal host renders | `e2e/specs/admin-people.spec.ts:46`
- C-20261108-37 | 2026-11-08 | product | medium | high | addressed | The People browser Spouse column prints the raw `spouseId` (for example `person-d`) instead of the spouse name | `src/app/components/admin-people/admin-people.component.ts:203`
- C-20261108-38 | 2026-11-08 | visual | medium | high | addressed | The eleven-column table is fixed-layout with no widths, so long headers and names truncate at ordinary laptop widths | `src/app/components/admin-people/admin-people.component.scss:40`
- C-20261108-39 | 2026-11-08 | visual | medium | high | addressed | On the Photo Albums section the page title moves below the tabs because the Media toolbar is hidden while the section switcher stays above | `src/app/components/admin-media/admin-media.component.html:2`
- C-20261108-40 | 2026-11-08 | product | low | high | addressed | `/admin/photo-albums` renders Media without redirecting, so section switching yields a contradictory URL and no sidebar highlight | `src/app/components/admin/admin.module.ts:43`
- C-20261108-41 | 2026-11-08 | visual | low | high | addressed | The People/Import segmented control uses 32px options and 13px type while the Media control uses 36px and 14px | `src/app/components/admin-people/admin-people.component.scss:13`
- C-20261108-42 | 2026-11-08 | visual | low | high | addressed | The People pagination overrides the shared 12px top padding to zero and sits flush against the last row | `src/app/components/admin-people/admin-people.component.scss:59`
