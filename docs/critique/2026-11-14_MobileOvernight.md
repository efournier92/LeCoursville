# Critique Ledger: Mobile Overnight Convergence

- Goal: every user-facing and admin route renders and operates correctly on phones and tablets in Chromium, WebKit, and Firefox.
- Branch: `2026-11-08_UxReview`
- Start epoch: `1794631035` (2026-11-14 04:37 UTC)
- Baseline commit: `39ce4caf` Snapshot UI Polish WIP Before Mobile Loop
- Harness: `scripts/mobile/routes.mjs`, `scripts/mobile/screenshots.mjs`, `scripts/mobile/audit.mjs` at commit `cebd88a3`
- Artifacts: `/tmp/mobile-overnight-2026-11-13/` (never committed)
- Matrix: 10 viewports; visual critique at se1 320x568, iphone 390x844, ipad-mini 768x1024, phone-land 844x390
- Entry format: `ID | phase | route | viewport | engine | severity | status | finding | evidence | spec | commit`

## Phase Checkpoints

### Phase 0: bring up (04:37 to 04:47 UTC)

- Baseline WIP committed as one snapshot, 49 files, tree clean afterward.
- Playwright browsers present: chromium-1248, webkit-2370, firefox-1555.
- Build green. Seed green. Three smoke shots exist at `/tmp/mobile-overnight-2026-11-13/<engine>/iphone/smoke-home-{full,fold}.png`.
- Admin login reaches `/calendar` on all three engines. Firefox does not paint `.cal-days` on the first frame but the route is correct.

### Phase 1: harness and baseline (04:47 onward)

- Harness built, then refined three times to remove false positives: form-field wrapper as the touch box, slide-toggle host as the touch box, visually-hidden and opacity-0 text skipped, object-fit contain images exempt, body and `.app-container` are not containment boxes, print surface exempt from mobile invariants, chat split into its own route set.
- Baseline before fixes (Chromium, se1 and iphone): 0 pass, 22 fail, 20 warn, 2 print-exempt.

## Findings

- MOB-001 | phase1 | /contacts, /contacts/person-a | 320x568 | chromium | high | verified | Contact list scrolled 340px inside a 310px container because a long unbroken surname overflowed the card and the mobile grid track had no `min-width: 0`. Fixed in `contacts.component.scss`, `contact-info.component.scss`, `contact-card.component.scss` | audit `app-container-overflow` 340 > 310 before, warn-only after | `e2e/specs/contacts.spec.ts:94` | `77bd175f`
- MOB-002 | phase1 | /upload, /family-explorer/archive-1, /photos, /photos/album-1 | 320x568, 390x844 | chromium | high | verified | Text-entry inputs rendered 14 to 14.4px, so iOS zooms the viewport on focus. Raised to 16px at <=600px with a shared guard | audit `input-font-size` before, clean after | `e2e/specs/public-upload.spec.ts`, `e2e/specs/photos.spec.ts` | `77bd175f`
- MOB-003 | phase1 | /songs, /people, /contacts/person-a, /family-explorer/archive-1, /upload, /photos | 320x568 | chromium | medium | verified | Inline controls measured 16 to 23px tall: song titles, clickable person names, removal link, folder button, gallery search. Raised to a 24px floor at <=600px | audit `hit-targets` under-24 before, gone after | `e2e/helpers/touch.ts` plus the six owning specs | `77bd175f`
