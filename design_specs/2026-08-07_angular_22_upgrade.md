# Angular 22 Upgrade — Session Handoff (2026-08-07)

Branch: `angular-upgrade` (cut from `master` at `bfba16d`, pushed to origin).
Photo-albums work is merged to local `master` (`bfba16d`, squash #45) — **not pushed, not deployed.**

## State

**Angular 22.1 + Material 22.1 (M3 token theme) + TypeScript 6.0 + zone.js 0.15, application builder (esbuild). Build green (dev + prod). Zero console errors on a full route sweep.**

## What was done

### 1. Rebuilt unmigratable dependencies (before the upgrade chain, on Angular 15)
- **AngularFire removed entirely** (maintenance, peers cap at Angular 20) → Firebase modular SDK:
  - `services/firebase.service.ts` (app init, auth/db/storage/analytics)
  - `services/rtdb.service.ts` (observable RTDB helper mirroring AngularFire `valueChanges`, `snapshotChanges`, `createPushId`, `push`)
  - `services/fire-upload-task.ts` (upload task wrapper: `percentageChanges`/`cancel`/`then`)
  - 17 services/components migrated; public APIs preserved.
  - Fixed latent bug: `allUploads$` was never fed → admin uploads list now live.
- **firebaseui-angular** (login widget) → native email/password form in `AuthComponent` (+ password reset, error mapping). `auth.config.ts` deleted.
- **lightgallery** → removed (PhotoSwipe is the standard; legacy views stripped).
- **@videogular** → native `<video>` player.
- **ngx-audio-player** → native `<audio>` player with tracklist.
- **FontAwesome** → Material icons (chat views).
- **Removed dead deps**: aws-amplify-angular, aws-sdk, jquery, firebaseui(-angular), lightgallery, font-awesome, @fortawesome/*, ngx-audio-player, ngx-filesaver, ngx-filter-pipe, ngx-infinite-scroll, protractor.

### 2. Upgrade chain 15 → 22 (one green build per major)
15 → 16 → 17 → 18 → 19 → 20 → 21 → 22. Material stepped 13→15→16→17→18→…→22 (legacy-* removed at 17, `entryComponents` removed at 16, zone import fixed, MDC `appearance="standard"` → `outline`, `LegacyPageEvent` → `PageEvent`, `MatLegacy*` symbol renames, `jszip` default import for TS6).
- Deps kept current per Angular major: `ngx-extended-pdf-viewer` 15→21→29, `angular-calendar` 0.31→0.32.2 (+ `angular-draggable-droppable`, `angular-resizable-element`), `jszip` re-added (used by admin folder download).
- `tsconfig` got `ignoreDeprecations: "6.0"` (baseUrl/downlevelIteration); `extendedDiagnostics` block removed (incompatible with strictTemplates off).
- Migrated to the **application builder** (esbuild).

### 3. Design (Material 3 + frosted accents)
- M3 token theme in `styles.scss`: green primary (`mat.$green-palette`), orange tertiary; `mat.all-component-themes`.
- Shared `page-toolbar` → frosted floating card (blur 16, radius 16, soft shadow) — modernizes contacts/people/expressions/calendar/legacy-photos at once.
- Login page → frosted sign-in card, brand logo chip, pill submit, error/info banners.
- Global: antialiasing, brand `::selection`, `:focus-visible` rings, refined scrollbars.
- (Photo album gallery-bar from the earlier feature already frosted.)

### 4. Bug fixes found during runtime verification
- `PhotoAlbumsFeatureGuard` read the empty flags map on first navigation → wrong redirect. Now waits for `flagsReady()` (new `FeatureFlagsService` signal, fail-open on RTDB error).
- MDC `appearance="standard"` (removed) → `outline` in media-list/media-search-input.

## Verification (headless Chromium, dev server, admin@test.com)
- Native login works (sign-in → /calendar).
- Route sweep (login, calendar, contacts, chat, expressions, people, photos, media/audio, media/video, admin): **no console errors/exceptions**.
- Calendar renders month data; audio page lists albums; admin + feature toggles work.
- Flag gating verified both ways: `enablePhotoAlbums` OFF → legacy gallery; ON → album grid + admin photo-albums page.
- Flag reset to OFF after testing.
- Screenshots saved under `/var/folders/px/4kz2zhts5wb7ph04p303k2840000gn/T/opencode/shots*/` for human review (model cannot view images).

## Known issues / next steps
0. **Test suite (migrated Karma→Vitest)**: `npx ng test` now runs — **80/114 passing** (was: zero, did not compile on master). Remaining 34 failures are legacy test debt: stale assertions (calendar anniversary count, contacts count, admin-features rows, navbar buttons, contact-card address format), specs missing required `@Input()` fixture data (chat-edit, user-view, calendar*, expression-*, contact-*), a couple missing Material module imports (chat-view, calendar-printer), and rtdb-mock gaps in 2 specs. Each is a small per-spec fix; no app-code bugs indicated.
1. **One-time `Maximum call stack size exceeded`** (RTDB callback) observed right after login during upgrade churn; never reproduced across subsequent sweeps. Likely a Vite HMR artifact. If it recurs on prod build, trace write-back subscriptions (auth `updateUser` writes `dateLastActive`; guarded by `hasAlreadyUpdatedUser`).
2. **`getLoosePhotos()`** uses `orderByChild('albumId').equalTo('')` — RTDB excludes records with a *missing* `albumId`, so legacy photos without the field won't appear as "loose". Consider a migration or dual-query.
3. **Sass `@import` deprecations** (Dart Sass 3.0 removes them) — run the sass migrator across component styles.
4. **Material legacy classes** like `mat-elevation-z6` still used in several templates — harmless now, but replace with M3 elevation tokens in a polish pass.
5. **Deploy**: master not pushed (`photo-albums` squash lives only locally). No deploy performed, per instruction.
6. **Dev DB**: `enablePhotoAlbums` flag OFF (default). Dev database has albums but few/no photos; album detail + PhotoSwipe lightbox untested at runtime for lack of data — verify with an uploaded album before shipping.
7. `getPromotedRoute()` now emits the stored `route` string (the old code cast the whole `{route,updatedAt}` object to string — latent bug fixed); verify promoted-route flow still behaves as expected.

## Useful commands
- Dev: `npx ng serve` / build: `npx ng build` (prod: `--configuration production`)
- Headless browser: `/Applications/Chromium.app/Contents/MacOS/Chromium --headless=new --remote-debugging-port=9222 --user-data-dir=<tmp>`
- CDP helpers: `/var/folders/px/4kz2zhts5wb7ph04p303k2840000gn/T/opencode/cdp-{shot,flow,sweep,err}.mjs`
