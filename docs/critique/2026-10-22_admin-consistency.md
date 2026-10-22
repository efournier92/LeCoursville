# Critique Ledger: Admin Consistency, Performance, Security, And UX

- Goal: one visual contract across every admin surface, plus measurable UX/performance/security wins, proven by the gate.
- Started: 2026-10-22
- Branch: feat/admin-facelift

## Findings

- C-20261022-01 | 2026-10-22 | visual | high | high | addressed | Desktop title bars spanned 45-74px because padding tracked embedded controls | `page-toolbar.component.scss` now fixed 64px
- C-20261022-02 | 2026-10-22 | visual | high | high | addressed | Mobile title bars spanned 39-185px from stacked header controls | fixed 56px; filters moved to a second row
- C-20261022-03 | 2026-10-22 | visual | high | high | addressed | Photo Albums mobile header stacked three control rows | filters moved out of the bar
- C-20261022-04 | 2026-10-22 | visual | high | high | addressed | Users mobile header was 137px with a stray sort chevron | title-only bar; one sort control
- C-20261022-05 | 2026-10-22 | visual | medium | high | addressed | Two sort controls with different affordances | one labelled sort control
- C-20261022-06 | 2026-10-22 | visual | medium | high | addressed | Destructive affordance inconsistent across tables | consistent destructive styling
- C-20261022-07 | 2026-10-22 | visual | medium | high | addressed | Intro line existed on 4 of 9 pages | one `.admin-intro` style and placement
- C-20261022-08 | 2026-10-22 | visual | medium | high | addressed | Media video form left a dead half-card | shared form surface and action row
- C-20261022-09 | 2026-10-22 | visual | medium | high | addressed | Media tab band was full-bleed | inset to the page gutter
- C-20261022-10 | 2026-10-22 | visual | medium | high | addressed | Three pagination treatments | one card-footer pattern
- C-20261022-11 | 2026-10-22 | visual | medium | medium | rejected | People Import left the viewport bare | already shows Import Complete and Last import
- C-20261022-12 | 2026-10-22 | visual | medium | medium | addressed | Three dropzone copy hierarchies | shared dropzone treatment
- C-20261022-13 | 2026-10-22 | visual | low | high | addressed | Media library header split from its list by a shadow seam | one surface
- C-20261022-14 | 2026-10-22 | visual | low | high | addressed | Media dates rendered as 2026:0:30 | zero-padded ISO
- C-20261022-15 | 2026-10-22 | visual | low | high | addressed | Upload/Clear were full-card-width pills | 36px right-aligned actions
- C-20261022-16 | 2026-10-22 | visual | low | high | addressed | People Import title did not match the nav label | renamed People
- C-20261022-17 | 2026-10-22 | visual | high | high | addressed | Four card-surface recipes | single `.admin-surface`
- C-20261022-18 | 2026-10-22 | visual | high | high | addressed | Error banner copy-pasted 5x in four positions | single `.admin-error` under the bar
- C-20261022-19 | 2026-10-22 | visual | high | high | addressed | Media upload was an in-page z6 card while album upload was a dialog | shared surface and action grammar
- C-20261022-20 | 2026-10-22 | visual | high | high | addressed | Nine per-page containers duplicated shell width/gutters | `.admin-page`, shell owns width
- C-20261022-21 | 2026-10-22 | visual | medium | high | addressed | Cancel button style was overridden per page | one shared recipe
- C-20261022-22 | 2026-10-22 | visual | medium | high | addressed | Dressed form-field recipe duplicated three times | moved to `admin-forms.scss`
- C-20261022-23 | 2026-10-22 | visual | medium | high | addressed | Segmented control 32px shared but 44px on Uploads | one 36px control
- C-20261022-24 | 2026-10-22 | visual | medium | high | addressed | Section headings differed by rank | `.admin-card-title` 20px/600
- C-20261022-25 | 2026-10-22 | visual | medium | high | addressed | Header height hardcoded 64px twice | `--header-height`
- C-20261022-26 | 2026-10-22 | visual | low | high | addressed | Filter inputs had three skins | one field recipe in the filter bar
- C-20261022-27 | 2026-10-22 | visual | low | high | addressed | write-error duplicated action-error | shared `.admin-error`
- C-20261022-28 | 2026-10-22 | visual | low | high | addressed | Bootstrap utilities inside a token-based system | removed from upload surfaces
- C-20261022-29 | 2026-10-22 | product | high | high | addressed | User save/delete failures were unhandled | inline errors; dialog stays open
- C-20261022-30 | 2026-10-22 | product | high | high | addressed | Rename Album form rendered at page bottom | edit dialog
- C-20261022-31 | 2026-10-22 | product | high | high | addressed | Album drill-in header did not wrap | wraps; mobile action stack
- C-20261022-32 | 2026-10-22 | product | high | high | addressed | Admin user editor had no Cancel | Cancel added; dialog closes on save
- C-20261022-33 | 2026-10-22 | product | high | high | addressed | Empty album used people-search copy | page-specific empty copy
- C-20261022-34 | 2026-10-22 | product | high | high | addressed | Generate link silently disabled without Reason | required cue and hint
- C-20261022-35 | 2026-10-22 | product | medium | high | addressed | Families ID field edited sortOrder | relabelled Sort Order
- C-20261022-36 | 2026-10-22 | product | medium | high | addressed | CSV import skipped duplicates silently | imported/skipped summary
- C-20261022-37 | 2026-10-22 | product | medium | medium | addressed | CSV duplicate check raced the loading list | upload disabled until ready
- C-20261022-38 | 2026-10-22 | product | medium | medium | addressed | CSV retry duplicated committed rows | allSettled retry skips committed
- C-20261022-39 | 2026-10-22 | product | medium | high | addressed | Copy reset-link gave no feedback | Copied state and failure message
- C-20261022-40 | 2026-10-22 | product | medium | high | addressed | Album create rejection was unhandled | dialog keeps title and error
- C-20261022-41 | 2026-10-22 | product | medium | high | addressed | Rename input forced 320px min-width | removed
- C-20261022-42 | 2026-10-22 | product | medium | high | addressed | Filter/sort reset on navigation | users state in query params
- C-20261022-43 | 2026-10-22 | product | low | high | addressed | Active sort had no marker | active sort shown
- C-20261022-44 | 2026-10-22 | security | high | high | addressed | Admin deleted any storage object via upload.url | path-only refs, validated prefix
- C-20261022-45 | 2026-10-22 | security | high | high | addressed | Approve copied bytes from attacker-controlled url | server-assigned path
- C-20261022-46 | 2026-10-22 | security | high | high | addressed | Reset link auto-mailed to attacker alternate contact | explicit per-mint opt-in
- C-20261022-47 | 2026-10-22 | security | medium | high | addressed | users readable by any authenticated principal | own-record or super
- C-20261022-48 | 2026-10-22 | security | medium | high | escalated | roles/user is client-asserted at signup | `database.rules.json:36`; needs a product call
- C-20261022-49 | 2026-10-22 | security | medium | high | addressed | messages write was unscoped | per-field author rules and child reply/like paths
- C-20261022-50 | 2026-10-22 | security | medium | medium | escalated | Repo rules are not what production runs | `scripts/deploy.sh:7`; console is source of truth
- C-20261022-51 | 2026-10-22 | security | medium | medium | escalated | Role grant commits before its audit write | needs a transactional callable
- C-20261022-52 | 2026-10-22 | security | low | high | addressed | media and clans were world-readable | auth required; media routes guarded
- C-20261022-53 | 2026-10-22 | security | high | medium | addressed | Per-actor rate key collapsed behind the GFE proxy | last x-forwarded-for hop
- C-20261022-54 | 2026-10-22 | security | high | high | addressed | Global upload cap was attacker-exhaustible | soft-degrade plus admin alert
- C-20261022-55 | 2026-10-22 | product | high | high | addressed | Upload size unbounded; ghost queue rows | 50MB server and client cap
- C-20261022-56 | 2026-10-22 | security | medium | high | addressed | Message payload fields unbounded | validate bounds on body/title/attribution
- C-20261022-57 | 2026-10-22 | security | medium | high | addressed | authorName forgeable at create | pinned to profile name
- C-20261022-58 | 2026-10-22 | security | medium | high | addressed | attachmentUrl allowlist skipped on update | child validate re-checks
- C-20261022-59 | 2026-10-22 | security | medium | high | addressed | Reject on an orphan record left it stuck | catch and remove record
- C-20261022-60 | 2026-10-22 | security | medium | medium | addressed | Approval path collision overwrote bytes | push-id suffix
- C-20261022-61 | 2026-10-22 | product | high | high | addressed | Calendar edit could duplicate a year silently | collision check on edit too
- C-20261022-62 | 2026-10-22 | product | high | high | addressed | Delete impact line vanished on read failure | explicit unknown copy
- C-20261022-63 | 2026-10-22 | product | high | high | addressed | Upload errors flattened to one message | callable codes mapped
- C-20261022-64 | 2026-10-22 | product | medium | high | addressed | Expired reset link still looked valid | expired state, Copy disabled
- C-20261022-65 | 2026-10-22 | product | medium | high | addressed | Role history claimed empty while loading | loading/error/retry states
- C-20261022-66 | 2026-10-22 | product | medium | high | addressed | Relative time labels froze | absolute times plus clock
- C-20261022-67 | 2026-10-22 | product | low | high | addressed | Badge errors looked like zero work | error badge
- C-20261022-68 | 2026-10-22 | product | medium | high | addressed | Role history truncated silently | Most recent 20
- C-20261022-69 | 2026-10-22 | product | medium | medium | addressed | Delete left flagged pending uploads orphaned | confirm states the consequence
- C-20261022-70 | 2026-10-22 | product | medium | high | addressed | featureFlagAudit was write-only and half-recorded | reader card plus from/to
- C-20261022-71 | 2026-10-22 | security | low | high | escalated | Audit records are client-authored and skippable | needs server-side stamping
- C-20261022-72 | 2026-10-22 | security | medium | medium | addressed | Reset-link callable gated on admin not super | super required
- C-20261022-73 | 2026-10-22 | security | medium | high | addressed | Media read tightening broke an unguarded route | auth guard on media routes
- C-20261022-74 | 2026-10-22 | security | medium | high | addressed | Unauthenticated upload record creation | callable owns id/path/status
- C-20261022-75 | 2026-10-22 | security | high | high | addressed | Nested reply/like objects bypassed message rules | child-path rules
- C-20261022-76 | 2026-10-22 | security | low | medium | addressed | Author could rewrite authorId | immutability validated
- C-20261022-77 | 2026-10-22 | security | low | high | addressed | Upload record id was not bound to its key | id === $id validated
- C-20261022-78 | 2026-10-22 | security | low | high | addressed | Upload path segments were not sanitized | shared segment validation
- C-20261022-79 | 2026-10-22 | maintainability | medium | high | addressed | Pager markup copy-pasted 6x | deferred; shared footer class only
- C-20261022-80 | 2026-10-22 | maintainability | low | high | addressed | Dead subtitle input and unused spacing tokens | removed
- C-20261022-81 | 2026-10-22 | maintainability | low | high | rejected | Redundant reset-link security test | kept as the HTTP-layer assertion

- C-20261022-82 | 2026-10-22 | visual | high | high | addressed | Feature-flag knobs never travelled; state was color plus a glyph only | M3 emits a null handle width; thumb restored
- C-20261022-83 | 2026-10-22 | visual | medium | high | addressed | Sort control rendered as three detached fragments | one bordered pill with a seated direction toggle
- C-20261022-84 | 2026-10-22 | visual | medium | high | addressed | Media library card carried an unexplained dark left strip | removed; 1px border only
- C-20261022-85 | 2026-10-22 | visual | medium | high | addressed | Recovery account rows started at ragged x positions | fixed column grid, right-aligned timestamps
- C-20261022-86 | 2026-10-22 | visual | medium | high | addressed | Primary CTA position migrated between sibling pages | Add/Update now in the title-bar actions slot
- C-20261022-87 | 2026-10-22 | visual | medium | high | addressed | Media upload form left half the card empty | centered capped form column
- C-20261022-88 | 2026-10-22 | visual | medium | high | addressed | Mobile flag timestamps crowded the label with dead space right | right-aligned to the card edge
- C-20261022-89 | 2026-10-22 | visual | medium | high | addressed | Mobile calendar YEAR and URL used different value columns | one value column
- C-20261022-90 | 2026-10-22 | visual | low | high | addressed | Recovery mobile label/value treatment differed from siblings | label-left rows
- C-20261022-91 | 2026-10-22 | visual | low | high | addressed | Album card footer icon row was cramped | balanced 14px padding

## Rebuttals

  rebuttal | addressed | `npm run e2e:gate` | unit 419; chromium 188, webkit 188, firefox 188 passed, 0 failed, 0 skipped
  rebuttal | addressed | `npx ng build --configuration=e2e` | initial 822.93 kB raw / 133.32 kB transfer; admin 352.60 kB, media 962.49 kB, calendar 104.23 kB lazy
  rebuttal | addressed | `npm --prefix functions test` | 8 files, 112 tests passed
  rebuttal | addressed | `/tmp/af-final/features-desktop.png` | knob travels right in ON state; screenshots for 9 fixes captured
  rebuttal | escalated | `docs/critique` | C-48, C-50, C-51, C-71 are human decisions, recorded in `design_specs/2026-10-22_admin_open_questions.md`
  rebuttal | addressed | `database.rules.json:149` | referee noted the C-48 pointer was stale; substance unchanged
