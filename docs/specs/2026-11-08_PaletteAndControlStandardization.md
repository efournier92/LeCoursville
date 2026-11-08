# Palette And Control Standardization

Spec for UI-001, UI-002, UI-009, UI-010, UI-017, UI-022, UI-025, UI-026, and UI-031. Workstream WS1. Foundational, lands before every other stream.

## Goal

One brand emerald contract, one warn and error tone set, one switch control, and zero raw color literals outside `src/styles.scss`. The visible result is a coherent control language in light and dark.

## Non-Goals

- No calendar tag redesign. UI-003 owns that and depends on this spec.
- No layout or information architecture change.
- No new npm dependency.
- No repaint of every screen. This is token, control, and the named small fixes.

## Current State

- Brand primary is already Evergreen Emerald `#27744A` (`src/styles.scss:85`), and `--color-brand-solid` is theme-invariant `#27744A` (`:91`, `:108`).
- Filled buttons already resolve to `--color-brand-solid` (`src/styles.scss:332`). Sites: `admin-families.component.html:9`, `calendar.component.html:26`, `calendar-print.component.html:9`.
- The toolbar is already painted `--color-brand-solid` in both modes (`styles.scss:248-251`, `:294-300`).
- There is no distinct warn token. The M3 error palette covers warn states (`styles.scss:203` comment). Error tokens exist at `:99`, `:103`, `:172`.
- Role badge tokens exist but are still indigo and purple (`styles.scss:120-125`, `:179-184`). The nav badge already uses `--color-brand-solid` (`admin.component.scss:131`).
- 19 component SCSS files still carry raw color literals. Worst: `photos-legacy.component.scss` (7), `auth.component.scss` (6), `auth-action.component.scss` (4), `admin-user-uploads.component.scss` (4), `gallery-bar.component.scss` (3), `admin-people-import.component.scss` (3), `admin-families.component.scss` (3).
- `nightlight_round` renders at `app.component.html:93` and `auth.component.html:107`. `dark_mode` has zero matches.
- `.auth-toggle` has only `color` and no inset (`auth.component.scss:102-104`). The suffix button sits flush to the outline.
- `.admin-error` has no flex layout (`admin-data.scss:38-46`). `.admin-success` is already flex (`:49-59`).
- `.media-path-preview` uses `border-radius: var(--radius-control)` (`admin-media-upload-video.component.scss:93`).
- `mat-checkbox` appears 48 times across 11 html files. Native `input[type=checkbox]` is zero. `mat-slide-toggle` appears 4 times.
- The Features card still renders `<mat-card-subtitle>` at `admin-features.component.html:47`.
- Destructive dialogs already carry a destructive flag (`confirm-dialog.component.html:9-18`, `prompt-modal.component.html:18-22`, `prompt-button.ts`).

## Palette Contract

Add these tokens in the light `html` block and re-emit any color-bearing ones in the dark block.

| Token | Light | Dark |
|---|---|---|
| `--color-warn` | `#8A5F1E` (AA on white) | `#D9AE6F` (AA on surface) |
| `--color-warn-solid` | `#A8762D` | inherits |
| `--color-on-warn-solid` | `#FFFFFF` | inherits |
| `--color-warn-container` | `#F6EBD9` | `#3A2E1B` |
| `--color-on-warn-container` | `#4A2F0E` | `#F6EBD9` |
| `--role-member-bg` | `#EBEDF0` | `#2E3438` |
| `--role-member-fg` | `#37474F` | `#C5CDD3` |
| `--role-admin-bg` | `#DCEFE3` | `#1C3A2A` |
| `--role-admin-fg` | `#123726` | `#DCEFE3` |
| `--role-super-bg` | `#27744A` | `#27744A` |
| `--role-super-fg` | `#FFFFFF` | `#FFFFFF` |

Every pair must clear 4.5:1 for text. Super uses brand solid plus white, so contrast is the brand-on-white pair already verified.

## Behavior And Acceptance Criteria

### UI-001 Palette And Filled Buttons

- Toolbar, filled buttons, and the admin nav badge render the identical computed background, `#27744A`, in light and dark.
- Warn and error are distinct roles. A `color="warn"` control renders the warn fill, not error red.
- No raw green literal remains in component SCSS after the sweep.

### UI-002 Crescent

- Both theme toggles render `dark_mode` for the moon and keep `light_mode` for the sun.
- `data-testid="theme-icon-moon"` and `theme-icon-sun` stay.
- Assert the moon slot contains the `dark_mode` ligature text.

### UI-009 Dialog Policy And Consolidation

Resolve the request and the risk with a per-dialog policy.

| Dialog class | Primary action | Decline action |
|---|---|---|
| Benign confirm | brand fill Yes | neutral Cancel |
| Destructive confirm (Delete, Remove, Reset) | `--color-error-solid` on the destructive action | neutral Cancel |
| Info prompt with one action | brand fill | none |

Do not paint No red. Record this decision in the spec and surface it to the operator as the one human override point. Then complete the consolidation sweep: replace every raw color literal in the 19 files with an existing or new semantic token, and add any missing shadow, overlay, or tint tokens to `styles.scss`.

### UI-010 Password Reveal Inset

- `.auth-toggle` gets `margin-right: 4px` or an equivalent suffix inset.
- The icon-button bounding box right edge sits inside the field content box in outlined and filled appearances, at 36px and 44px.
- Scan the other `matSuffix` outlined fields for the same flush target and apply the inset consistently.

### UI-017 Features Subtitle

- Remove `<mat-card-subtitle>` from the Features card title.
- The page intro stays. The title row does not wrap awkwardly at mobile width.

### UI-022 Notice Alignment

- `.admin-error` becomes `display: flex`, `align-items: flex-start`, `gap: 8px`, with a 20px icon box and a 1px top nudge.
- Every icon-plus-text notice shares the shape. Text-only notices still render correctly.
- Icon and text share a vertical center within 2px in light and dark.

### UI-025 Path Box Radius

- `.media-path-preview` uses `var(--radius-sm)`.
- Grep for other non-interactive panels using `--radius-control` and fix any that misapply the button pill.

### UI-026 Switches

- Replace all 48 `mat-checkbox` controls in 11 files with `mat-slide-toggle` as switch rows.
- Keep `color="primary"`. Keep existing privilege rules: checking Super forces Content Admin on and disables the Content Admin switch.
- Whole label clickable, 44px row, visible focus, `role="switch"`, 150 to 200ms transition, `prefers-reduced-motion` respected, optimistic with rollback.
- Calendar and print filters become a stacked switch-row group.
- A grep proves no `mat-checkbox` remains in `src/app/**/*.html`.

### UI-031 Badge Palette

- Nav badge already uses brand. Retune the role tokens to the table above.
- Semantic badges keep error and warn tones.
- No hardcoded badge hex remains. Badges never rely on color alone.

## Light, Dark, And Print

- Every color-bearing override is re-emitted in the dark block. Use `scripts/check-theme-standardization.mjs` dark-parity check.
- Print inherits light values. Verify a destructive confirm and a badge in print media are legible.

## Accessibility

- Switches keep Space-to-toggle, Tab reachability, and visual and focus order matching.
- Focus ring uses `--color-focus`.
- Icon-only controls keep an accessible name.
- Contrast holds 3:1 for UI edges and 4.5:1 for text in both modes.

## E2E Coverage Matrix

| Change | Spec file | Assertion |
|---|---|---|
| Toolbar and filled button parity | `e2e/specs/dark-mode.spec.ts` | Computed background equals `#27744A` on toolbar and `+ Add Family` in both modes |
| Crescent glyph | `e2e/specs/dark-mode.spec.ts` | Moon slot renders `dark_mode`, toggle still works |
| Destructive dialog policy | `e2e/specs/edge-cases.spec.ts` | Destructive primary is error fill, cancel is neutral, No is never red |
| Password reveal inset | `e2e/specs/auth.spec.ts` | Toggle right edge is inset from the field content box |
| Features subtitle removed | `e2e/specs/admin-system.spec.ts` | Subtitle text absent, title present |
| Notice alignment | `e2e/specs/admin-family-explorer.spec.ts` | Icon and text share a vertical center |
| Path box radius | `e2e/specs/media.spec.ts` | Computed radius is 8px |
| Switch control | `e2e/specs/admin-content.spec.ts`, `e2e/specs/calendar.spec.ts` | Each former checkbox is a switch with `role="switch"`, toggles, and persists |
| Role badge tone | `e2e/specs/admin-roles.spec.ts` | Badge backgrounds resolve to brand-family tokens |

## Rollout And Rollback

Single deployable change. No schema change. Roll back by reverting the branch. The token values are inert data, so a revert is safe in both modes.

## Resolved Decisions And Open Questions

- Resolved: brand emerald is already live. This spec does not repaint it.
- Resolved: destructive confirm policy uses error on the destructive action and neutral cancel. "No is red" is not implemented for destructive dialogs.
- Open human decision: confirm the destructive-dialog policy if the product owner still wants literal "No is red". Default is the safe pattern.
- Open human decision: confirm no bulk-selection checkbox needs to stay.
