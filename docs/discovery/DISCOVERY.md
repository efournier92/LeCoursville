# Discovery

One line per finding, decision, assumption, trap, question, or outcome. Newest first. Evidence required.
Scope tokens: admin/security, admin/ui, build/perf, media/routing, rules/deploy, songs/ui

## Entries

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
- D-20261025-17 | 2026-10-25 | [decision] | admin/security | Family is canonical: one `families` node, `Person.familyId`, `?family=`, a one-release `?clan=` alias; `clans` and rules stay for cutover | src/app/services/family.service.ts:13
