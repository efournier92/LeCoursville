# Critique Ledger: Admin Consistency, Performance, Security, And UX

- Goal: one visual contract across every admin surface, plus measurable UX/performance/security wins, proven by the gate.
- Started: 2026-10-22
- Branch: feat/admin-facelift

## Findings

- C-20261022-01 | 2026-10-22 | visual | high | high | open | Desktop title bars span 45-74px because padding tracks whatever controls a page embeds | `/tmp/af-shots/2026-10-22/metrics.json`
- C-20261022-02 | 2026-10-22 | visual | high | high | open | Mobile title bars span 39-185px because filters and secondary buttons stack inside the header | `/tmp/af-shots/2026-10-22/metrics.json`
- C-20261022-03 | 2026-10-22 | visual | high | high | open | Photo Albums mobile header stacks three control rows and pushes the first album below the fold | `admin-photo-albums.component.html:5`
- C-20261022-04 | 2026-10-22 | visual | high | high | open | Users mobile header is 137px: full-width filter plus a sort row whose chevron floats mid-row | `admin-users.component.html:3`
- C-20261022-05 | 2026-10-22 | visual | medium | high | open | Two sort controls: Users has a chevron menu, Photo Albums plain text with no affordance | `admin-users.component.html:25`
- C-20261022-06 | 2026-10-22 | visual | medium | high | open | Destructive affordance is red only on Users; Families and Calendars icon deletes are near-black | `admin-families.component.html:148`
- C-20261022-07 | 2026-10-22 | visual | medium | high | open | Intro line exists on 4 of 9 pages, so toolbar-to-content rhythm differs page to page | `admin-features.component.html:4`
- C-20261022-08 | 2026-10-22 | visual | medium | high | open | Media video tab form fills half its card, leaving a dead white column | `admin-media-upload-video.component.html:9`
- C-20261022-09 | 2026-10-22 | visual | medium | high | open | Media tab band is full-bleed while every card respects the page gutter | `admin-media.component.scss:66`
- C-20261022-10 | 2026-10-22 | visual | medium | high | open | Three pagination treatments: floating, card footer, and an extra page counter | `admin-photo-albums.component.html:257`
- C-20261022-11 | 2026-10-22 | visual | medium | medium | open | People Import leaves the viewport bare below one card; reads unfinished | `admin-people-import.component.html:3`
- C-20261022-12 | 2026-10-22 | visual | medium | medium | open | Three dropzone copy hierarchies across People, Families, Photo Albums | `admin-people-import.component.html:14`
- C-20261022-13 | 2026-10-22 | visual | low | high | open | Library header card is split from its list by a shadow seam; Families uses one card | `admin-media.component.html:38`
- C-20261022-14 | 2026-10-22 | visual | low | high | open | Media library renders dates as 2026:0:30, unlike the ISO format on Users and Recovery | `admin-media.component.html:60`
- C-20261022-15 | 2026-10-22 | visual | low | high | open | Upload/Clear are full-card-width pills while every other admin CTA is fixed width | `admin-media-upload-video.component.html:75`
- C-20261022-16 | 2026-10-22 | visual | low | high | open | Page title People Import does not match the People nav label | `admin-people-import.component.html:3`
- C-20261022-17 | 2026-10-22 | visual | high | high | open | Four card-surface recipes: M3 default, radius+shadow token, shadow only, mat-elevation-z6 | `admin-user-uploads.component.scss:14`
- C-20261022-18 | 2026-10-22 | visual | high | high | open | Error banner block copy-pasted 5x and mounted at four different positions | `admin-photo-albums.component.scss:5`
- C-20261022-19 | 2026-10-22 | visual | high | high | open | Media upload is an in-page z6 card while album upload is a MatDialog: two interaction grammars | `admin-media-upload-video.component.html:3`
- C-20261022-20 | 2026-10-22 | visual | high | high | open | Nine per-page containers re-declare max-width/margin already applied by the admin shell | `admin.component.scss:163`
- C-20261022-21 | 2026-10-22 | visual | medium | high | open | Cancel button class is white-text in shared styles and overridden per page | `src/app/styles/admin-forms.scss:26`
- C-20261022-22 | 2026-10-22 | visual | medium | high | open | Dressed form-field recipe duplicated verbatim in three components | `admin-media-upload-video.component.scss:37`
- C-20261022-23 | 2026-10-22 | visual | medium | high | open | Segmented control is 32px shared but 44px on Uploads; toolbar wrapping patched per page | `admin-user-uploads.component.scss:26`
- C-20261022-24 | 2026-10-22 | visual | medium | high | open | Section headings differ: 1.25rem bold, 20px/600, and 20px/500 for the same rank | `admin-people-import.component.scss:28`
- C-20261022-25 | 2026-10-22 | visual | medium | high | open | Header height is hardcoded as 64px in two calc()s while the toolbar is theme-sized | `admin.component.scss:5`
- C-20261022-26 | 2026-10-22 | visual | low | high | open | Filter inputs have three skins: gallery pill, white-filled outlined field, default outlined | `shared/gallery-bar.scss:13`
- C-20261022-27 | 2026-10-22 | visual | low | high | open | write-error duplicates action-error under a second name with different metrics | `admin-families.component.scss:29`
- C-20261022-28 | 2026-10-22 | visual | low | high | open | Admin forms import Bootstrap utilities inside an otherwise token-based system | `admin-media-upload-audio-album.component.html:3`
- C-20261022-29 | 2026-10-22 | product | high | high | open | User-card Save and Delete failures are unhandled, so a rejected privilege change looks saved | `user-edit.component.ts:77`
- C-20261022-30 | 2026-10-22 | product | high | high | open | Rename Album form renders at page bottom, far from the trigger that opened it | `admin-photo-albums.component.html:228`
- C-20261022-31 | 2026-10-22 | product | high | high | open | Album drill-in header does not wrap; Delete Album is off-screen on phones | `admin-photo-albums.component.scss:221`
- C-20261022-32 | 2026-10-22 | product | high | high | open | Admin-mode user cards have no Cancel and no unsaved-changes guard | `user-edit.component.html:67`
- C-20261022-33 | 2026-10-22 | product | high | high | open | Empty album drill-in shows the people-search empty copy with no Add Photos pointer | `admin-photo-albums.component.html:221`
- C-20261022-34 | 2026-10-22 | product | high | high | open | Generate reset link is silently disabled until Reason is typed, with no required cue | `admin-recovery.component.html:112`
- C-20261022-35 | 2026-10-22 | product | medium | high | open | Families field labeled ID edits sortOrder, not the family identity | `admin-families.component.html:196`
- C-20261022-36 | 2026-10-22 | product | medium | high | open | CSV import silently skips duplicate families with no imported/skipped summary | `admin-families.component.ts:316`
- C-20261022-37 | 2026-10-22 | product | medium | medium | open | CSV duplicate check races the still-loading family list | `admin-families.component.ts:317`
- C-20261022-38 | 2026-10-22 | product | medium | medium | open | CSV partial failure leaves committed rows, so retry duplicates them | `admin-families.component.ts:333`
- C-20261022-39 | 2026-10-22 | product | medium | high | open | Copy reset-link gives no success feedback and swallows fallback failure | `admin-recovery.component.ts:341`
- C-20261022-40 | 2026-10-22 | product | medium | high | open | Album create rejection is unhandled after the dialog closes, losing the typed title | `admin-photo-albums.component.ts:367`
- C-20261022-41 | 2026-10-22 | product | medium | high | open | Rename input forces min-width 320px and overflows a 360px phone | `admin-photo-albums.component.scss:196`
- C-20261022-42 | 2026-10-22 | product | medium | high | open | Filter and sort state reset on every navigation | `admin-users.component.ts:122`
- C-20261022-43 | 2026-10-22 | product | low | high | open | Sort reversal is duplicated and the active sort has no visible marker | `admin-users.component.html:26`
- C-20261022-44 | 2026-10-22 | security | high | high | open | Admin session deletes any storage object via attacker-authored upload.url | `user-upload.service.ts:212`
- C-20261022-45 | 2026-10-22 | security | high | high | open | Approve copies bytes from attacker-controlled url/path into the public photos tree | `user-upload.service.ts:138`
- C-20261022-46 | 2026-10-22 | security | high | high | open | Reset link is auto-emailed to an attacker-chosen alternate contact with no admin opt-in | `functions/src/admin-generate-reset-link.ts:228`
- C-20261022-47 | 2026-10-22 | security | medium | high | open | users is readable by any authenticated principal, exposing the admin roster | `database.rules.json:33`
- C-20261022-48 | 2026-10-22 | security | medium | high | open | roles/user is client-asserted at signup, so content read access is self-granted | `database.rules.json:36`
- C-20261022-49 | 2026-10-22 | security | medium | high | open | messages write is unscoped: any user can forge or delete any message | `database.rules.json:15`
- C-20261022-50 | 2026-10-22 | security | medium | medium | open | Repo rules are not what production runs; deploy ships hosting and functions only | `scripts/deploy.sh:7`
- C-20261022-51 | 2026-10-22 | security | medium | medium | open | Role change commits before its audit write, and roleAudit is rewritable by any super | `user-edit.component.ts:95`
- C-20261022-52 | 2026-10-22 | security | low | high | open | media and clans are world-readable with no authentication | `database.rules.json:28`

## Rebuttals

