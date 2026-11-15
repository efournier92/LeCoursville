# Discovery

One line per finding, decision, assumption, trap, question, or outcome. Newest first. Evidence required.
Scope tokens: admin/security, admin/ui, build/perf, calendar/print, media/routing, rules/deploy, songs/ui

## Entries

- D-20261114-08 | 2026-11-14 | [outcome] | calendar/print | Mobile calendar redteam converged on a compact Timeline preview above the month grid with a full-height Expand sheet; gate 552 across the matrix, unit 950, theme clean | docs/critique/2026-11-14_MobileCalendarOrdering.md

- D-20261114-07 | 2026-11-14 | [trap] | admin/ui | A CSS-hidden mobile-only component still renders duplicate event tags in the desktop DOM and wins `.first()` locators; gate it structurally with BreakpointObserver, not only `display:none` | src/app/components/calendar-view/calendar-view.component.html:98

- D-20261114-06 | 2026-11-14 | [decision] | calendar/print | Mobile calendar shows a 3-day Timeline preview above the inline month grid; the full rolling agenda lives in a 100vh sheet opened from the preview Expand control. This beats a naive hoist that pushed the grid off-screen | src/app/components/calendar-view/calendar-view.component.html:98

- D-20261114-05 | 2026-11-14 | [outcome] | admin/ui | Mobile overnight loop converged user and admin routes: per-engine audit 210 pass user, 216 pass admin on chromium, gate 548 per browser, unit 941 | docs/critique/2026-11-14_MobileOvernight.md

- D-20261114-04 | 2026-11-14 | [trap] | build/perf | The sparse seed account still sees global seeded contacts, people, and photos, so it cannot prove empty states; empty-state review needs a data-less family in the seed | scripts/e2e/seed.mjs

- D-20261114-03 | 2026-11-14 | [trap] | admin/ui | WebKit stretches a column flex item with percentage flex-basis to its max-content width, which widened page toolbars 28px; set width and max-width 100 percent | src/app/components/shared/page-toolbar/page-toolbar.component.scss

- D-20261114-02 | 2026-11-14 | [decision] | calendar/print | Narrow-phone calendar uses a fluid seven-column track; the 44px-column pan contract is superseded because hidden weekend dates are the worse defect | e2e/specs/calendar.spec.ts:550

- D-20261114-01 | 2026-11-14 | [trap] | admin/ui | Headless Chromium reserves a 10px classic scrollbar, so its layout viewport is narrower than WebKit and Firefox; launch the capture harness with --hide-scrollbars for parity | scripts/mobile/audit.mjs

- D-20261113-03 | 2026-11-13 | [decision] | admin/ui | Data rights footer is a slim pinned "Data Privacy" bar. The information and request form live in a MatDialog, and print hides the footer host | src/app/components/site-footer/site-footer.component.html:1

- D-20261113-02 | 2026-11-13 | [trap] | calendar/print | A zero-height block (the footer host) landing exactly on a print page boundary makes Chromium emit a blank trailing PDF sheet | src/app/components/site-footer/site-footer.component.scss:37

- D-20261113-01 | 2026-11-13 | [trap] | admin/ui | mat-slide-toggle with-icon handle margin defaults to 0 24px, pushing the 14px handle outside a 36px track and the check icon over the label. Set both with-icon margins and icon size | src/styles.scss:1060

- D-20261109-12 | 2026-11-09 | [decision] | admin/ui | Data rights footer uses a family-voice split copy: friendly Update, calm Remove, and Contact, signed off with the draft marker removed | docs/handoffs/2026-11-09_UiReviewBatch.md

- D-20261109-11 | 2026-11-09 | [trap] | build/perf | The dev seed must set expression authorName to the historical author, not the seed owner, because expression-view renders authorName with yearWritten | scripts/dev-seed/index.mjs:203

- D-20261109-10 | 2026-11-09 | [decision] | admin/security | Open email signup requires messages read to be approved-user-only (`roles/user === true`). pending accounts no longer read chat | database.rules.json:23

- D-20261109-09 | 2026-11-09 | [trap] | admin/security | An RTDB ancestor `.write` overrides child `.write`, and child `.validate` sees `newData.val()` at that path. put field restrictions in `.validate` | database.rules.json:205

- D-20261109-08 | 2026-11-09 | [trap] | admin/ui | `mat-slide-toggle` sets `name` on its inner button, so `[name=...]` selectors miss the host. query `role=switch` instead | e2e/specs/media.spec.ts:1526

- D-20261109-07 | 2026-11-09 | [trap] | build/perf | Firebase Auth emulator accepts 6-character passwords (HTTP 200), so a client-only 8-character minimum is not server-enforced | src/app/components/auth/auth.component.ts:128

- D-20261109-06 | 2026-11-09 | [trap] | build/perf | `src/environments/*` is gitignored, so env contract additions stay local and out of commits unless mirrored into tracked config | .gitignore:54

- D-20261109-05 | 2026-11-09 | [trap] | rules/deploy | `npm version` exits 1 when the version is unchanged. guard for equality, and commit the bump before the release tag so the tag points at the matching version | scripts/deploy.sh:109

- D-20261109-04 | 2026-11-09 | [trap] | admin/ui | Playwright WebKit and Firefox do not open a page for a synthesized middle click, while Firefox modifier-click does. assert the anchor contract per engine | e2e/specs/nav.spec.ts:187

- D-20261109-03 | 2026-11-09 | [decision] | admin/ui | `/account` is deep-link safe while `/` triggers the one-shot promoted-route bounce, so new-tab targets point at `/account` | src/app/config/feature-config.ts:28

- D-20261109-02 | 2026-11-09 | [trap] | build/perf | The dev seed downloader must return the asset Buffer. passing a cache path to `file.save` writes nothing | scripts/dev-seed/downloader.mjs:91

- D-20261109-01 | 2026-11-09 | [outcome] | admin/ui | UI review batch WS1 to WS8 implemented and redteamed: 160 findings, 157 addressed, 2 rejected, 1 escalated (captions). gate 507 per browser, unit 921 | docs/critique/2026-11-08_UiReviewRedteam.md

- D-20261108-02 | 2026-11-08 | [decision] | build/perf | Accepted 18 `npm audit` findings: 4 high `@grpc/grpc-js` (Node-only, not in browser bundle), 14 moderate in `firebase-tools` CLI; `--force` needs major downgrade | package-lock.json

- D-20261108-01 | 2026-11-08 | [trap] | build/perf | Pinned `@angular-devkit/architect` must match `@angular-devkit/build-angular`; bumping one alone leaves a duplicate `0.2202.x` | package.json:49

- D-20261107-05 | 2026-11-07 | [trap] | calendar/print | Seed dates must be absolute; current-month dates made print e2e pass only in November 2026 | scripts/e2e/seed.mjs
- D-20261107-04 | 2026-11-07 | [outcome] | calendar/print | Calendar redteam converged: 60 findings, 2 rejected, unit 857, e2e gate 419 on three browsers | docs/critique/2026-11-07_CalendarCore.md
- D-20261107-03 | 2026-11-07 | [decision] | calendar/print | Print keeps unique `-S` spouse birthdays but never `-S` anniversaries, the primary line names the couple | src/app/components/calendar-print/calendar-print.model.ts
- D-20261107-02 | 2026-11-07 | [trap] | calendar/print | `BehaviorSubject` `[]` seed hung a warm empty calendar on loading; `peopleLoaded$` separates seed replay from real empty | src/app/services/calendar.service.ts
- D-20261107-01 | 2026-11-07 | [decision] | calendar/print | `legacyCalendarPdf` defaults off, so the Calendars admin nav hides until enabled; flag-on nav and toggle are e2e-proven | e2e/specs/admin.spec.ts

- D-20261102-10 | 2026-11-02 | [outcome] | security | PII ship redteam converged: 16 findings settled, contact legacy values preserved, canary hardened, gate unit 769, functions 303, e2e 389 on three browsers | docs/critique/2026-11-02_PiiShipRedteam.md
- D-20261102-09 | 2026-11-02 | [decision] | security | Live archive key and title stay admin-created production data; the repo carries `archive-1` and `Example Family` only | scripts/e2e/seed-fixtures.mjs
- D-20261102-08 | 2026-11-02 | [trap] | security | A canary ledger that spells a hashed token turns the gate red; describe forbidden tokens instead of quoting them | scripts/check-pii-canary.mjs
- D-20261102-07 | 2026-11-02 | [trap] | security | A PII canary stores only SHA-256 hashes, normalizes punctuation, scans docs and root config, and describes tokens rather than spelling them | scripts/check-pii-canary.mjs
- D-20261102-06 | 2026-11-02 | [trap] | security | The real 13-name family list lived in an untracked `src/environments/app-settings.ts`, so a tracked-tree canary never sees it; move non-secret settings to tracked code | src/app/config/app-settings.ts
- D-20261102-05 | 2026-11-02 | [find] | security | Core PII nodes require an approved user, but messages/photos/photoAlbums accept any authenticated token, media is public, published familyExplorer is public, and prod storage serves photos publicly; all recorded, storage kept public by owner decision | database.rules.json:22
- D-20261102-04 | 2026-11-02 | [outcome] | security | Code-side PII eradication shipped green: 389 e2e per browser, unit 766, functions 303, canary clean; docs redaction, archive-key migration, and history residual remain | docs/critique/2026-11-02_PiiSanitization.md
- D-20261102-03 | 2026-11-02 | [decision] | security | Docs redaction is the eventual goal but runs only after the owner reviews the instance inventory; git history rewrite declined and the residual is documented | /tmp/pii-inventory-2026-11-02.md
- D-20261102-02 | 2026-11-02 | [decision] | security | The real family-explorer archive key migrates to a neutral key at the next deploy; the slug stays until then, with a runbook and parity criteria | docs/specs/2026-11-02_FamilyArchiveKeyMigration.md
- D-20261102-01 | 2026-11-02 | [decision] | security | Only the owner identity is exempt from PII eradication; every other real-person reference must go, and real family data is relegated to the auth-gated database | docs/specs/2026-11-02_PiiSanitization.md

- D-20261101-12 | 2026-11-01 | [outcome] | admin/security | Merged theme+input-standardization onto #51 keeping both: role-based expression gating, chat admin edit guard, and superOnly nav restored; branch keeps its contacts/expressions content routes, so a content admin sees 7 sidebar items (8 with photo albums) and a super 13/14 | src/app/admin/admin-nav.ts:38
- D-20261101-11 | 2026-11-01 | [decision] | admin/security | Songs is a content-tier item, so a content admin gets 6 sidebar items with the photo-album flag on and 5 with it off; the spec's 5/4 counts predate songs landing on trunk | src/app/admin/admin-nav.ts:43
- D-20261101-10 | 2026-11-01 | [trap] | admin/ui | `admin-nav` renders with `aria-busy` and a skeleton before `isNavReady`, so an `admin-nav-link-*` absence assertion passes while the nav is still loading; gate it on `toHaveAttribute('aria-busy', 'false')` | e2e/specs/admin-roles.spec.ts:133
- D-20261101-09 | 2026-11-01 | [outcome] | admin/security | Admin Tier Split redteam converged: 8 findings, 4 rejected by spec text, 4 fixed; functions 303, unit 751, e2e build clean, gate 362 on three engines | docs/critique/2026-11-01_AdminTierSplit.md

- D-20261101-08 | 2026-11-01 | [outcome] | admin/security | Redteam round 2 closed the medium set: `/contacts` read admin-or-super, expression-create and `messageType` writes admin-only at message and reply level, role reads moved to TS getters, text-entry radius unified at 16px. gate 367 e2e x3, unit 752, functions 298, rules 22 | docs/critique/2026-10-31_ThemeInputStandardization.md
- D-20261101-07 | 2026-11-01 | [trap] | build/perf | Playwright browser binaries can vanish from the cache between runs. a webkit stage then fails all 367 with "Executable doesn't exist" and looks like a product regression. Run `npx playwright install webkit firefox` before trusting a red browser stage | playwright.config.ts:25
- D-20261101-06 | 2026-11-01 | [outcome] | admin/ui | theme+input-standardization shipped on its branch: emerald + control standard + read-only user face, master #49/#50 merged in, gate 366x3 green, theme:check clean; 5 HUMAN findings open in the ledger | docs/handoffs/2026-11-01_ThemeInputStandardization.md
- D-20261101-05 | 2026-11-01 | [trap] | admin/ui | A singleton BehaviorSubject service replays REAL DATA as a late subscriber's first emission after list-to-detail nav; skip(1) drops it forever - filter empties with skipWhile, not by position | src/app/components/admin-contacts/admin-contacts.component.ts:38
- D-20261101-04 | 2026-11-01 | [find] | admin/ui | theme:check completeness script gates zero raw hex (incl .ts, data-color exemptions), radius ladder, roles-ban, rules audit, dark parity; wired pre-build in gate.sh | scripts/check-theme-standardization.mjs
- D-20261101-03 | 2026-11-01 | [decision] | admin/ui | User-facing app read-only: expressions and contacts editing admin-only via /admin/expressions + /admin/contacts (reused components, route-based isAdminRoute); messaging and /upload preserved | docs/specs/2026-10-31_ThemeInputStandardization.md
- D-20261101-02 | 2026-11-01 | [decision] | admin/ui | Emerald palette #27744A light / #8CCDA3 dark with theme-invariant brand-solid fills; success split from brand; input borders computed to true 3:1 (#878E99 / #6B7683) | docs/specs/2026-10-31_ThemeInputStandardization.md
- D-20261101-01 | 2026-11-01 | [trap] | admin/ui | Pill container-shape on outlined mat-form-fields inflates the notched-outline layout and collapses inputs to 0px width; fields take the 16px card radius, pills stay on buttons | src/styles.scss:249
- D-20261031-22 | 2026-10-31 | [outcome] | songs/ui | Songs Library findings D-20261031-08..21 archived; gate, print, rules, and UX evidence linked | .gate-results/gate-summary.txt

- D-20261031-07 | 2026-10-31 | [find] | admin/ui | Only the inner icon pill toggled the dark/light chip; make the outer chip `<button role="switch">` with the pill `pointer-events: none` | src/app/components/auth/auth.component.html:79
- D-20261031-06 | 2026-10-31 | [trap] | admin/ui | `BehaviorSubject` seed `[]` made `app-media-list` read loaded-empty and flash the empty message over the skeleton; `ReplaySubject(1)` fixes it | src/app/services/media.service.ts:15
- D-20261031-05 | 2026-10-31 | [trap] | admin/ui | Angular Material 22 no longer emits `.mat-elevation-z#` (`elevation-classes()` absent), so `mat-elevation-z8` on `mat-toolbar` is dead; set `box-shadow` explicitly | src/styles.scss:346
- D-20261031-04 | 2026-10-31 | [decision] | rules/deploy | Zoho-to-Gmail forward rejected: paid-only on Free (routing too); stay Free, Zoho app push notifies; revisit = Mail Lite | https://www.zoho.com/mail/help/email-forwarding.html
- D-20261031-03 | 2026-10-31 | [outcome] | admin/ui | Destructive-button redteam: `--color-error-solid` + `.btn-destructive`, red confirm both themes, delete confirm; unit 14, e2e 63 chromium | docs/critique/2026-10-31_DestructiveButtons.md
- D-20261031-02 | 2026-10-31 | [trap] | admin/ui | `color="warn"` is M2-only, a no-op on Material 22; style filled destructive buttons with `--mat-button-filled-*` on the element | node_modules/@angular/material/fesm2022/button.mjs:129
- D-20261031-01 | 2026-10-31 | [decision] | admin/ui | Destructive filled surfaces use theme-invariant `--color-error-solid` (#B3261E) with white ink; `--color-error` still lightens for text/borders in dark | src/styles.scss:92
- D-20261030-20 | 2026-10-30 | [outcome] | admin/ui | Feedback batch gate green on branch 2026-10-30_Feedback, pending commit/PR: 274 e2e per browser on chromium/webkit/firefox, unit and functions stages green | .gate-results/firefox.json
- D-20261030-19 | 2026-10-30 | [trap] | build/perf | WebKit and Firefox format toLocaleString stamps and color-mix() differently; e2e asserts a Title-Case prefix plus digits, never a full locale string | e2e/specs/admin-system.spec.ts:406
- D-20261030-18 | 2026-10-30 | [trap] | admin/ui | Theme-toggle prefs writes re-emit userObservable; a promoted-route bounce guard must count actual bounces, not emissions, or guard redirects die on first emit | src/app/app.component.ts:71
- D-20261030-17 | 2026-10-30 | [trap] | admin/ui | mat-icon is outside .mdc-button__label, set position:relative by MDC; absolute children anchor to it until position:static | src/app/components/navbar-links/navbar-links.component.scss:48
- D-20261030-16 | 2026-10-30 | [find] | admin/ui | `adminAnalyticsSummary` returns a fixture unless configured; real GA4 needs numeric GA_PROPERTY_ID (not the G- id) plus GA_SA_JSON | functions/src/admin-analytics-summary.ts:110
- D-20261030-15 | 2026-10-30 | [trap] | admin/ui | `mat.all-component-colors` on html[data-theme="dark"] re-emits tokens and beats html-level `mat.*` overrides; re-emit the overrides inside the dark block after it | src/styles.scss:243
- D-20261030-14 | 2026-10-30 | [trap] | rules/deploy | An ENOENT wipe of dist fixtures was external, not the suite; check for a parallel ng build before blaming late-browser failures | docs/critique/2026-10-28_FamilyExplorerFeedback.md
- D-20261030-12 | 2026-10-30 | [trap] | build/perf | Playwright transpiles spec-imported `.mjs` to CommonJS; `import.meta` in any transitive import is a load-time SyntaxError, so keep fixture modules pure | scripts/e2e/seed-fixtures.mjs:4
- D-20261030-10 | 2026-10-30 | [trap] | admin/ui | A spec that flips a feature flag must restore it via Admin-SDK writeDb in a finally; sibling specs survive un-restored flags only by alphabetical file order | e2e/specs/security.spec.ts:99
- D-20261030-11 | 2026-10-30 | [trap] | rules/deploy | A long-lived emulator serves database.rules.json from its boot time; compare the emulator etime with the rules mtime before trusting a gate-equivalent run | scripts/e2e/gate.sh
- D-20261030-06 | 2026-10-30 | [trap] | admin/ui | Playwright center-click on a Material drawer backdrop times out when the drawer covers the center; click a position on the visible strip instead | e2e/specs/family-explorer.spec.ts:166
- D-20261030-04 | 2026-10-30 | [trap] | admin/ui | Symmetric marriageYears entries emit duplicate memo chips; dedupe by unordered spouse pair | src/app/components/family-explorer/family-tree-node.component.ts:44
- D-20261030-03 | 2026-10-30 | [decision] | rules/deploy | A denied RTDB read must clear the explorer loading state in the subscribe error callback or the page hangs | src/app/components/family-explorer/family-explorer.component.ts:71
- D-20261030-02 | 2026-10-30 | [trap] | build/perf | Seeding a long-lived emulator needs the FIREBASE_DATABASE/AUTH/STORAGE_EMULATOR_HOST vars plus GCLOUD_PROJECT, else the Admin SDK hangs on ADC | scripts/e2e/seed.mjs:7
- D-20261030-01 | 2026-10-30 | [trap] | admin/ui | tree-styles.scss is global under ViewEncapsulation.None; scope every selector under app-person-tree or `.person-name` leaks to contact cards | src/app/components/shared/tree-styles.scss:2
- D-20261026-03 | 2026-10-26 | [trap] | admin/ui | An empty projected slot still wraps: hide page-toolbar-content with :empty or bars grow 38px under 600px | src/app/components/shared/page-toolbar/page-toolbar.component.scss:110
- D-20261026-02 | 2026-10-26 | [decision] | admin/security | Email is immutable: no self or admin edit, rule pins it on the data.exists branch only | database.rules.json:165
- D-20261026-01 | 2026-10-26 | [decision] | build/perf | Dev builds hash assets and index.html is no-cache; stale dev bundles made fixes look broken | angular.json:123
- D-20261025-22 | 2026-10-25 | [trap] | build/perf | WebKit's default Tab policy skips non-text controls, so keyboard e2e asserts focusability and DOM order instead of Tab traversal | e2e/specs/media.spec.ts:572
- D-20261025-21 | 2026-10-25 | [trap] | media/routing | Replace uploads read only the batch-declared assets; a later `thumbnailBlob` race breaks resume | src/app/components/admin-media-upload-video/admin-media-upload-video.component.ts:524
- D-20261025-20 | 2026-10-25 | [trap] | rules/deploy | GoDaddy nameservers lag each other and resolvers cache stale empties, so verify TXT and MX at ns03 and ns04 before trusting dig | docs/2026-10-25_LeCoursville_Email_Configuration.md
- D-20261025-19 | 2026-10-25 | [decision] | rules/deploy | eric@lecoursville.com is on Zoho Mail Free: apex MX to Zoho, merged SPF, DKIM selector zoho, no IMAP, Resend sends app mail | docs/2026-10-25_LeCoursville_Email_Configuration.md
- D-20261025-18 | 2026-10-25 | [decision] | rules/deploy | Clan-to-family migration is additive first; `--delete-legacy` needs a same-run apply plus post-checks, and rules removal follows the data | scripts/migrations/clan-to-family.mjs:7
