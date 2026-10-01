# Design Facelift — Session Handoff (2026-08-08, post-completion)

Branch: `angular-upgrade` (all facelift work UNCOMMITTED; committing is the user's call).

## State

**Build green (`npx ng build`), 213/213 tests green (`npx ng test --watch=false`).** All batches (5–10) complete. Browser-verified per page with DOM measurements + computed styles; screenshots in `/var/folders/px/4kz2zhts5wb7ph04p303k2840000gn/T/opencode/shots/` (the 2026-08-07 session's note still applies: **this model cannot view images** — verification is measurement-based; a vision model can review the shots).

## The agreed design direction (unchanged — do not re-litigate)

MODE system; Inter self-hosted; neutral gray ground `#F3F4F6`; forest green brand `#2D5A27`; honey accent `#A8762D`; `.page-content` 1200px centered column; floating frosted `app-page-toolbar` (title left / tools right); tokens on `html` in `src/styles.scss`. Scrollbar mechanics: `.app-container` is the scroll container, `scrollbar-gutter: stable`, `width: 100%`.

## Critical fixes made this session (divergences from the previous handoff)

1. **Bootstrap/angular-calendar/PhotoSwipe CSS restored** — the 2026-08-07 styles.scss rewrite had silently dropped all three imports (HEAD still had them). Result when dropped: ~300 dead Bootstrap utility classes, unstyled calendar month grid, dead PhotoSwipe, and a 635px mobile horizontal overflow on EVERY page once auth loaded (the prior session's "380/390 verified" was measured pre-auth). Now imported at the top of `src/styles.scss`. This also restored `box-sizing: border-box` app-wide — the state components were designed against.
2. **Calendar chrome contract**: `.calendar-component-container` was full-bleed with its own padding (toolbar 1238px vs 1168px elsewhere). Converted to `page-ground page-content`; tokenized its hex stragglers; day-cell min-width 180→160px so 7 cells fit the 1200px column (desktop no longer clipped; mobile pans via the existing `.calendar-scroll-container`).
3. **FeatureFlagGuard cold-start race** — decided on the flags subject's initial EMPTY map, so disabled features passed on fresh loads (chat flag is OFF in dev; it rendered anyway). Now waits for `flagsReady()` (the pattern PhotoAlbumsFeatureGuard already used). /chat now correctly redirects to /feature-disabled.
4. **Expressions eternal-skeleton bug** — `isLoading` only cleared when the filtered array was non-empty; empty list shimmered forever. Now clears on first emit + proper empty state.
5. **M3 keyboard focus invisible** — M3 ships `outline: none` on `.mat-mdc-*` + a transparent focus indicator; the global `:focus-visible` rule lost. Now `!important` 2px brand ring (verified on tab through).
6. **Global reduced-motion guard** added in styles.scss (animations/transitions → 0.01ms). Slideshow Ken Burns has its own guard.

## Token/QA additions to the shared layer

- `--radius-sm: 8px` (skeletons, thumbnails, chips)
- `--color-brand-success` / `--color-brand-success-dark` aliases (were REFERENCED by `_buttons.scss`/public-upload but never defined — upload button had been rendering with no background)
- `app-page-toolbar` gained a `[page-toolbar-left]` slot (back button before title) + title ellipsis
- `no-results-message` gained `title`/`noun`/`hint` inputs — default copy preserved for contacts/people, page-correct copy elsewhere
- `gallery-bar.scss` demoted to gallery TOOLS only (search pill, segmented, back, slideshow buttons); the frosted container is now the shared page-toolbar (photo-albums + photo-album-detail migrated)

## Batch summary (what changed)

- **Batch 5 Expressions**: list rows + view/edit cards fully tokenized (rail, ink/ink-2, radius-sm); removed the forbidden private `max-width: 1200px`; skeletons unified to pulse; empty state added. Verified flush (toolbar/card 51/1168), hover+focus-within action reveal, mobile 348px clean.
- **Batch 6 Photos**: gallery-bar → page-toolbar migration (albums + detail); detail root wrapped in page-ground/page-content (was full-width); grids tokenized (radius-sm, surface-muted, shadow tokens); skeleton shimmer→pulse; upload-progress success → brand green; admin upload dialog hexes → tokens; slideshow reduced-motion guard. Verified: albums grid flush, count chip, search filter, detail toolbar + back-button slot, mobile 348px, zero console errors. (Test album created + deleted; `enablePhotoAlbums` dev flag toggled on for verification and restored to OFF.)
- **Batch 7 Media**: media-list rows fully tokenized (rail, ink tiers, radius-sm, pulse skeleton), no-results noun="media"; media-explorer action buttons + list border tokens; audio-player + both video players tokenized (#000 video surround kept as media surface). Verified 13 audio rows desktop+mobile flush, zero console errors. NOTE: `media-search-input` and `media-types-checkboxes` components are orphaned (no template uses them) — left as-is.
- **Batch 8 Admin (8 pages)**: 3 parallel builders did the mechanical hex→token pass (~1900 lines); operator finished the semantic leftovers (status colors → accent/brand/error tints, grays → ink). `admin-forms.scss` fixed (weak gray border → card token). **Header pattern decision**: every admin page now gets `app-page-toolbar` with a title (Users, Families, Calendars, People Import, Media, Uploads, Features, Photo Albums); users' filter/sort moved into the toolbar; families/calendars' card headers stripped (redundant); admin-photo-albums title normalized. `admin-routing` tool-nav is DEAD CODE — no template renders it (resolves the open "keep vs merge" question: the sidebar is the sole nav; recommend deleting the component + `app-admin-routing` references). Verified all 8 pages flush + no overflow. Pre-existing console error: `permission_denied at /families` — dev Firebase console rules deny admin read on `families` (rules are in the Firebase console, not repo).
- **Batch 9 Public/edge**: public-upload fully tokenized (kept its deliberate 600px form column; drop-zone focus ring added; upload button pill via shared mixin); feature-disabled tokenized; prompt-modal clean as-is; calendar-printer tokenized (year chips brand green); print views are external-URL/JS — no token deps.
- **Batch 10 Final QA**: contrast math computed — ink 13–14.5:1, ink-2 5.1–6:1, brand 8:1, accent-strong 4.62:1, error 6.5:1, white-on-brand 8:1 all PASS. **ink-3 (3.18:1) and accent (3.97:1) FAIL small text** — audited every usage: all small-text ink-3 usages converted to ink-2 (icons/borders keep ink-3, ≥3:1 non-text PASS). 375px audit: all pages no horizontal scroll (fixed a 20px transient skeleton-bar overflow on people). Focus verified. Reduced-motion verified (0.01ms). Hex grep: components clean except white-on-color `#fff`, media `#000`, `rgba(0,0,0,…)` scrims (documented exemptions). Unresolved `var(--…)`: none.

## Verify commands

```bash
npx ng build          # expect: application bundle generation complete, 0 errors
npx ng test --watch=false   # expect: 65 files / 213 tests passed
```

Browser check: log in `admin@test.com` / `testtest` at `localhost:4200`; visit `/people`, `/contacts`, `/calendar`, `/expressions`, `/photos` (legacy view — albums flag is OFF), `/media/audio`, `/upload`, `/admin/users` — zero console errors; toolbar flush with content; `app-container.scrollWidth <= clientWidth`.

## Dev-DB state (restored after verification)

- `messages` node: empty (temp expression created + deleted)
- `photoAlbums`: 6 pre-existing albums (temp album deleted)
- `features`: `chat: false`, `photos: true`, `enablePhotoAlbums: false` (restored), no record for people/contacts/calendar/music/videos/expressions (default allow)

## Open risks / recommendations

- **Everything uncommitted** on `angular-upgrade`; suggest committing logical chunks.
- **Delete `admin-routing`** component (dead — no template uses it) when convenient.
- **`families` read denied for admin in dev Firebase rules** — the /admin/families page renders but data is empty; check the Firebase console rules.
- **`media-search-input` + `media-types-checkboxes`** orphaned components — delete or wire up.
- **photo-shell flag**: dev has `enablePhotoAlbums` OFF → /photos shows the legacy view. The album view is verified; flip the flag to review it.
- **Slideshow/video views** couldn't be live-verified (no photo/video data in dev albums) — code-reviewed + tokenized only.
- **The skeleton shimmer on contacts** keeps a 3-stop gradient with a brand-tinted mid (`rgba(45,90,39,0.08)`) — deliberate; the pulse pattern is used elsewhere.
