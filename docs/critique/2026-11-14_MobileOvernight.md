# Critique Ledger: Mobile Overnight Convergence

- Goal: every user-facing route renders and operates correctly on phones and tablets in Chromium, WebKit, and Firefox. Admin surfaces reach the same bar after them.
- Branch: `2026-11-08_UxReview`
- Start epoch: `1794631035` (2026-11-14 04:37 UTC). Finish epoch: `1794682200` (2026-11-14 18:50 UTC)
- Baseline WIP commit: `39ce4caf` Snapshot UI Polish WIP Before Mobile Loop
- Harness: `scripts/mobile/routes.mjs`, `screenshots.mjs`, `audit.mjs`, `dialogs.mjs`
- Artifacts: `/tmp/mobile-overnight-2026-11-13/` (captures, audit JSON, Markdown tables, `results.json`, `dialogs.json`). Never committed.
- Matrix: 10 viewports. Visual critique at se1 320x568, iphone 390x844, ipad-mini 768x1024, phone-land 844x390.
- Entry format: `ID | area | severity | status | finding | evidence | spec | commit`

## Verdict

User-facing convergence holds at the automated bar and at the visual bar with a named residue.
Admin convergence holds at the automated bar and at the visual bar for the reviewed surfaces, with a ranked residue below.

| Matrix | Chromium | WebKit | Firefox |
| --- | --- | --- | --- |
| User routes, 10 viewports, 22 routes | 210 pass, 0 fail, 0 warn, 10 print-exempt | 210 pass, 0 fail, 0 warn, 10 print-exempt | 210 pass, 0 fail, 0 warn, 10 print-exempt |
| User routes at 200 percent text zoom | 210 pass, 0 fail | n/a (Chromium only per brief) | n/a |
| Admin routes, 10 viewports, 22 routes | 216 pass, 0 fail, 4 low warns | not re-run after admin fixes | not re-run after admin fixes |
| Dialogs at 390x844 | 5 pass, 0 fail, 1 skipped with reason | not run | not run |

Gate:

```
chromium  expected 556  skipped 0  unexpected 0  flaky 0  (7.2 min)
webkit    expected 556  skipped 0  unexpected 0  flaky 0  (10.6 min)
firefox   expected 556  skipped 0  unexpected 0  flaky 0  (9.7 min)
unit      115 files, 946 tests passed
theme     theme:check PASS
```

## Phase Checkpoints

### Phase 0, bring up (04:37 to 04:47 UTC)

- Baseline WIP committed as one snapshot, 49 files, tree clean afterward.
- Playwright browsers present (chromium-1248, webkit-2370, firefox-1555).
- Build green, seed green, three smoke shots exist. Admin login reaches `/calendar` on all three engines.

### Phase 1, harness and baseline (04:47 to 06:16 UTC)

- Harness written, then refined seven times to remove false positives: form-field wrapper and slide-toggle host as touch boxes, visually hidden and opacity-0 elements skipped, object-fit contain exempt, body and `.app-container` are not containment boxes, print surface exempt, chat split into its own route set, scrollbar gutter tolerated, icon ligatures ignored, hidden 1x1 file inputs ignored.
- Baseline before fixes: Chromium se1 and iphone, 0 pass, 22 fail, 20 warn.

### Phase 2, user-facing visual loop (06:16 to 09:00 UTC)

- 19 pages critiqued, fixed, re-captured, and re-critiqued in rounds of three. Font and contrast fixes were verified through the audit rather than by eye.
- Every fix shipped with a phone-viewport assertion in its owning spec.

### Phase 3, cross-engine and edge states (09:00 to 09:30 UTC)

- WebKit and Firefox full matrices: 210 pass, 0 fail each after the fixes.
- 200 percent text zoom on Chromium: 210 pass, 0 fail after the photos toolbar grid was allowed to shrink.
- Chromium scrollbar gutter fixed with `--hide-scrollbars`, which removes a 10px cross-engine layout drift.
- Dialogs at 390: person modal 351x717, sign-out confirm 317x226, day agenda 348x77, photo lightbox 390x844, song draft dialog 390x844. All fit, all expose their actions.
- Chat with the flag on: 9 pass, 1 low warn, flag restored to OFF.

### Phase 4, admin loop (09:30 to 18:30 UTC)

- Admin and staff sets audited. The `admin-nav` landmark was wrong on phones (the sidebar is a drawer), so the dashboard was blocked until the landmark became `.admin-content`.
- Reviewed admin dashboard, users, features, families, people, media, recovery, calendars, uploads, songs. Fixed table overflow, pinned-bar occlusion, touch targets, destructive-action separation, long URL handling, and legend and fold economy.
- Admin matrix after fixes: 216 pass, 0 fail, 4 low warns.

### Phase 5, regression gate

- Unit suite 941 passed. `theme:check` PASS.
- First full gate run: chromium 548 and webkit 548 clean; firefox had one intermittent failure in "editing a published song updates the member detail after reload" (title field received the key value). The test passes in isolation (3.3s) and the full firefox stage passed on rerun with 548, 0 unexpected, 0 flaky.
- Final gate on the finished tree, stage by stage because one full gate invocation hung past ninety minutes at the functions step: chromium, webkit, and firefox each report 556 expected, 0 skipped, 0 unexpected, 0 flaky. Unit 946 passed. `theme:check` PASS. The functions build, functions tests, PII canary, prod-rules pass, and rules project all passed in the earlier full invocation and their sources did not change after it.

## Findings, newest first

| ID | Area | Severity | Status | Finding | Evidence | Commit |
| --- | --- | --- | --- | --- | --- | --- |
| MOB-035 | admin/uploads | high | fixed | Reject rendered as a peer of Preview; Approve and Reject now separate outlined pills with 16px gaps, labeled row actions, wrapped meta date, hidden single-page pagination | audit admin 216 pass | `bf8eedc8` |
| MOB-034 | admin/calendars | high | fixed | Feed URL had no copy control and split mid-token; added copy with Copied state, ellipsized URL, actions moved to row top-right | `/tmp/mobile-overnight-2026-11-13/chromium/audit-admin.json` | `bf8eedc8` |
| MOB-033 | admin/people | high | fixed | Table mode broke headers mid-word at 768 and 844; cards keep two-up compact fields, a chevron, and an Import short label | audit admin | `bf8eedc8` |
| MOB-032 | admin/users | high | fixed | Role pill clipped at 320, dates wrapped mid-value, row icons were 24px; pills wrap, dates stay whole, icons 44px, delete uses the danger token | audit admin | `bf8eedc8` |
| MOB-031 | admin/features | high | fixed | Legend clipped at 320 and no toggle reached the fold; legend wraps, intro cut, changed chip moved under the route, off track darkened | audit admin | `bf8eedc8` |
| MOB-030 | admin/media | high | fixed | Pinned upload bar had no separation and hid form content; opaque bar, hairline, shadow, scroll padding, safe area | audit admin | `bf8eedc8` |
| MOB-029 | admin/tables | high | fixed | Admin tables clipped columns on phones; shared `.admin-table-scroll` wrapper with overflow-x auto on users, families, recovery, people, calendars | audit admin 0 table-scroll fails | `bf8eedc8`, `f4f0e6e0` |
| MOB-028 | expressions | medium | fixed | Family pill took its own line; it is right-aligned on the author line now | critique round 4 | `aea038cc` |
| MOB-027 | songs/detail | high | fixed | Chord chips fused with lyric words and the tool row ate the fold; chords sit above the word, meta joined, 44px tool row, 60ch tablet measure | `songs.spec` chord test | `aea038cc` |
| MOB-026 | family-explorer | medium | fixed | Filter pill floated mid-band and the removal paragraph detached from the capped column; both align to the gutter | critique round 3 | `aea038cc` |
| MOB-025 | upload | medium | fixed | Landscape fold hid the dropzone and the folder row was bare text; short-height compaction, tinted folder row, sentence case | critique round 3 | `aea038cc` |
| MOB-024 | media/detail | high | fixed | Third-party error text was the loudest element and metadata was missing; inline back link, title and meta above the player, content-sized fallback, filled primary action | `media.spec` back-link and fallback tests | `aea038cc` |
| MOB-023 | photos/album, slideshow | medium | fixed | Tablet grid read as two posters and the counter looked like filler; three columns at 768, slideshow glyph, tabular 1/2 counter, darker pill | `photos.spec` column and counter tests | `aea038cc` |
| MOB-022 | chat | high | fixed | Title card ate a third of the fold and a vertical action rail squeezed text to 200px; inline heading, horizontal action row, compact timestamps | critique round 3 | `aea038cc` |
| MOB-021 | people, feature-disabled, auth | medium | fixed | Dangling separator dots, clipped long surnames, unbalanced disabled copy, title-case subtitle | `people.spec` separation test | `084a827e` |
| MOB-020 | family-explorer | medium | fixed | Tablet content span and roots indent | critique round 2 | `084a827e` |
| MOB-019 | upload | high | fixed | Fold sliced the dropzone at 320; compaction, touch copy, 44px glyph, folder row | `public-upload.spec` | `084a827e` |
| MOB-018 | media/detail | high | fixed | Drive error chrome in the hero slot and no title; in-app fallback, heading, no filter on detail, one-line related rows | `media.spec` | `084a827e` |
| MOB-017 | expressions | high | fixed | Sort caret detached, straight quotes, two metadata kinds with one prefix, 734px cards | `expressions.spec` | `084a827e` |
| MOB-016 | album, slideshow | high | fixed | Tablet grid capped at two columns, phone chrome ate the fold, controls sat in the home-indicator zone | `photos.spec` | `084a827e` |
| MOB-015 | photos | high | fixed | One album per phone screen, stacked controls, "1 photos" | `photos.spec` two-column test | `be8ccb11` |
| MOB-014 | people, contacts | high | fixed | Run-on names, inert-looking names, mid-word clipping, stacked controls | `people.spec` | `be8ccb11` |
| MOB-013 | songs | high | fixed | No tap affordance, monospace previews, duplicated preview line | `songs.spec` preview test | `be8ccb11` |
| MOB-012 | auth, auth/action | high | fixed | Tab wrap at 320, CTA below a 568 fold, card flush to edges, no way back to sign-in | `auth.spec` convergence tests | `be8ccb11` |
| MOB-011 | calendar | high | fixed | Saturday column clipped at 320 and 280; fluid seven-column track | `calendar.spec` narrow-phone test | `be8ccb11` |
| MOB-010 | shell | high | fixed | Theme switcher centered in the app bar read as the page's primary control; right cluster at touch widths | `dark-mode.spec` mobile placement test | `be8ccb11` |
| MOB-009 | shell | low | fixed | Header icon buttons stayed 40px; width and height set to 44 explicitly | audit warn count 0 | `f7803c30` |
| MOB-008 | photos | high | fixed | WebKit stretched the column toolbar slot to max-content; width and max-width 100 percent | `photos.spec` 320px toolbar test | `f7803c30` |
| MOB-007 | harness | medium | fixed | Audit false positives: scrollbar gutter, inline text, icon ligatures, hidden file inputs | audit warn count 0 | `c78f508a`, `f7803c30`, `aea038cc` |
| MOB-006 | shell, gallery | medium | fixed | Primary actions under 44px: header icons, gallery search, privacy link, month pill, song back, Material buttons | audit hit-targets | `c78f508a` |
| MOB-005 | calendar | high | fixed | 844x390 scrolled 993px inside 834px; compact layout through 1023px, 24px chip links on tablets | `calendar-mobile.spec` landscape test | `c78f508a` |
| MOB-004 | matrix | high | fixed | Touch minimums stopped at 600px; widened to 1024px | audit fail count 20 to 0 | `c78f508a` |
| MOB-003 | matrix | medium | fixed | Inline controls 16 to 23px tall across six pages; 24px floor at touch widths | `e2e/helpers/touch.ts` plus six specs | `77bd175f` |
| MOB-002 | matrix | high | fixed | Text inputs 14 to 14.4px caused iOS focus zoom; 16px at touch widths plus a shared guard | `public-upload.spec`, `photos.spec` | `77bd175f` |
| MOB-001 | contacts | high | fixed | 340px scrolled inside 310px at 320; grid track min-width, wrap, long-name wrapping | `contacts.spec` 320px test | `77bd175f` |

## Residuals And Rejections

Accepted, low or out of scope:

- Material icon buttons keep a 40px box above 1024px. At touch widths they are 44px. The theme pill art is 22px tall inside a 44px button.
- Dense inline chips keep the 24px inline floor rather than 44px: calendar event chips in seven columns and grid day cells at 280px cannot reach 44px width without clipping.
- Contacts cards keep the labeled ADDRESS / PHONE / EMAIL groups. That density is settled design from the prior UI review, not a defect.
- Calendar weekend numerals stay red. It is the settled palette and the dot legend now explains event colors.
- Agenda auto-scroll on day selection was not added. It is a behavior change beyond layout and needs a product decision.
- Account shows the header session toggle and the persisted "Always Dark" preference. They are different settings by design per `dark-mode.spec`, so the duplicate-control finding was rejected.
- The `sparse` seed account still sees global seeded contacts, people, and photos, so true empty states were not reachable. The empty-state review is deferred until the seed gains a data-less family.
- Red album covers are 1x1 red fixture pixels from `scripts/e2e/seed.mjs`, not a styling defect.
- A cross-origin Drive error page that fires `load` cannot be detected. The in-app fallback covers a missing or unrecognized id and a load timeout only.
- Chat new-message opens an inline editor, not a dialog, so the dialog sweep records it as skipped with that reason.
- Firefox renders calendar rows about 30px taller and loses the dark selected-day fill. Font-metric delta, logged not fixed.
- Ranked admin residue: recovery still leads with the creations log, admin people and songs cards keep label-heavy rows, and admin songs needs a compact card hierarchy with a phone FAB. None are correctness or overflow issues.
- Admin and user matrices were not re-run on WebKit and Firefox after the admin fixes. The three-engine gate covers those surfaces instead.

## Commits

- `39ce4caf` Snapshot UI Polish WIP Before Mobile Loop
- `cebd88a3` Add Mobile Capture And Audit Harness
- `77bd175f` Fix Mobile Touch Targets And 320px Contacts Overflow
- `c78f508a` Widen Touch Minimums To Tablets And Fix Calendar Landscape
- `f7803c30` Fix WebKit Toolbar Stretch And Button Boxes
- `be8ccb11` Converge Phone Craft On Auth, Calendar, Songs, People, And Photos
- `084a827e` Converge Album, Slideshow, Expressions, Media, Upload, And Explorer Surfaces
- `aea038cc` Polish Remaining Member Surfaces And Chat List
- `bf8eedc8` Converge Admin Tables, Media, Features, Calendars, And Uploads
- `f4f0e6e0` Wrap The Admin Calendars Table For Phone Scroll

## Reproduce

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
npx ng build --configuration=e2e
firebase emulators:exec --project lecoursville-dev --only auth,database,storage,hosting,functions \
  "node scripts/e2e/seed.mjs && node scripts/mobile/screenshots.mjs --engine=chromium --routes=user --viewports=se1,iphone,ipad-mini,phone-land && node scripts/mobile/audit.mjs --engine=chromium --routes=user"
firebase emulators:exec --project lecoursville-dev --only auth,database,storage,hosting,functions \
  "node scripts/e2e/seed.mjs && node scripts/mobile/dialogs.mjs --engine=chromium"
```
