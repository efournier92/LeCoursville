# UI Review Batch Plan (2026-11-08)

Ordered workstream plan for the 31-item UI review ledger at `docs/critique/2026-11-08_UiReviewInstructions.md`. Read-only analysis only. No source change is made by the planner.

## Purpose

Turn UI-001 through UI-031 into ordered, spec-backed work with dependencies, conflicts, and a per-item disposition. The companion build prompt is `docs/critique/2026-11-08_UiReviewBuildPrompt.md`. Specs live under `docs/specs/2026-11-08_*.md`.

## Verification Baseline

Every ledger anchor was checked against current code. The following ledger premises are already true and must not be re-implemented.

| Premise | Reality | Evidence |
|---|---|---|
| Brand primary is a stale forest green | Already Evergreen Emerald `#27744A` | `src/styles.scss:85`, `:91`, `:108`, `:208-212` |
| Filled buttons render off-brand | Already bound to `--color-brand-solid` `#27744A` | `src/styles.scss:332`, filled sites in `admin-families`, `calendar`, `calendar-print` |
| Admin nav badge uses an off token | Already `--color-brand-solid` | `admin.component.scss:131` |
| Role badges hardcode hex | Already tokenized as `--role-*-bg/fg` | `admin-users.component.scss:20-40`, `styles.scss:120-125`, `:179-184` |
| Destructive dialogs lack a flag | Already `[class.btn-destructive]` plus `destructive?: boolean` | `confirm-dialog.component.html:9-18`, `prompt-modal.component.html:18-22`, `prompt-button.ts` |
| No raw hex exists outside `styles.scss` | 19 component SCSS files still carry literals | recon count, ledger said 18 |

What genuinely remains open is the warn token, the role badge hue (still indigo and purple), the palette consolidation sweep, and the behavioral items.

No `e2e/specs/theme.spec.ts` exists even though the ledger cites it. Theme assertions belong in `e2e/specs/dark-mode.spec.ts` and `e2e/specs/edge-cases.spec.ts`. There is no `dialogs.spec.ts` either.

## Disposition Table

Every item has a disposition and a workstream. "Small" means no spec section of its own, folded into a named spec.

| ID | Disposition | Workstream | Spec |
|---|---|---|---|
| UI-001 | Implement, partial. Emerald already landed. Add distinct warn token, prove toolbar and filled-button parity, kill duplicate green literals. | WS1 | Palette And Control |
| UI-002 | Implement, small. Replace `nightlight_round` at both sites with `dark_mode`. | WS1 | Palette And Control |
| UI-003 | Implement. Family-color tag accent, brand today marker, dedicated dark pass. Depends on UI-001. | WS5 | Calendar Palette Tags Mobile |
| UI-004 | Implement. Anchors plus native new-tab behavior. | WS7 | Responsive Toolbars And Nav |
| UI-005 | Implement as its own create-spec, build, redteam cycle. RTDB queue, hard delete, short safe copy. | WS8 | Data Rights Footer |
| UI-006 | Implement, small. Remove hanging indent. | WS5 | Calendar Palette Tags Mobile |
| UI-007 | Implement. Group order to System, People, Content. | WS2 | Admin Shell And Navigation |
| UI-008 | Implement as its own spec and build track. Dev guard and license ledger. | WS8 | Dev Seed Module |
| UI-009 | Implement, partial. Destructive flag exists. Remaining is the per-dialog policy decision plus the 19-file consolidation sweep. | WS1 | Palette And Control |
| UI-010 | Implement, small. Add suffix inset. | WS1 | Palette And Control |
| UI-011 | Implement. Reorder, copy, hide toolbar Sign In on root, lift theme toggle. | WS4 | Auth Sign-In And Sign-Up |
| UI-012 | Implement. Add create-account path and mode. | WS4 | Auth Sign-In And Sign-Up |
| UI-013 | Implement. Delete legacy stack, ship idempotent migration. Runs after UI-014 lands. | WS3 | Legacy Contact Retirement |
| UI-014 | Implement. Dense people table, import stays reachable. | WS2 | Admin People Browser |
| UI-015 | Implement. Content order plus Photo Albums as a Media tab. | WS2 | Admin Shell And Navigation |
| UI-016 | Implement. System order Features, Analytics, Users, Recovery. | WS2 | Admin Shell And Navigation |
| UI-017 | Implement, small. Remove the subtitle. | WS1 | Palette And Control |
| UI-018 | Implement. Fluid seven-column mobile grid. | WS5 | Calendar Palette Tags Mobile |
| UI-019 | Implement. Stacked left-aligned mobile toolbars. | WS7 | Responsive Toolbars And Nav |
| UI-020 | Implement. Playback diagnosis plus share placement. | WS6 | Media Playback And Actions |
| UI-021 | Implement. Same action row as UI-020. | WS6 | Media Playback And Actions |
| UI-022 | Implement, small. Shared `.admin-error` flex shape. | WS1 | Palette And Control |
| UI-023 | Implement. Loaded signal, one loading field, empty-state audit. | WS2 | Loading And Empty States Audit |
| UI-024 | Implement, small. Drop-zone copy. | WS6 | Media Playback And Actions |
| UI-025 | Implement, small. `--radius-sm` on the path box. | WS1 | Palette And Control |
| UI-026 | Implement. 48 `mat-checkbox` occurrences across 11 files to `mat-slide-toggle`. | WS1 | Palette And Control |
| UI-027 | Implement. Right-align plus `package.json` bump in deploy. | WS2 | Admin Shell And Navigation |
| UI-028 | Implement. Role order and "Member" naming. | WS2 | Admin Shell And Navigation |
| UI-029 | Implement. Pending promoted route, sibling node. | WS2 | Admin Shell And Navigation |
| UI-030 | Implement. Count open plus pending. | WS2 | Admin Shell And Navigation |
| UI-031 | Implement, partial. Nav badge and tokens already correct. Retune role tokens from indigo and purple to the brand family. | WS1 | Palette And Control |

## Workstreams

Workstream order and merge order. WS1 is foundational and lands first.

| WS | Name | Items | Depends On | Spec |
|---|---|---|---|---|
| WS1 | Design System And Palette | UI-001, 002, 009, 010, 017, 022, 025, 026, 031 | none | Palette And Control Standardization |
| WS2 | Admin Shell And Information Architecture | UI-007, 014, 015, 016, 023, 027, 028, 029, 030 | WS1 | Admin Shell And Navigation plus Admin People Browser plus Loading And Empty States Audit |
| WS3 | Data Model Retirement | UI-013 | WS2, specifically UI-014 | Legacy Contact Retirement And Migration |
| WS4 | Auth And Onboarding | UI-011, 012 | WS1 | Auth Sign-In And Sign-Up |
| WS5 | Calendar | UI-003, 006, 018 | WS1, including UI-026 switch conversion | Calendar Palette Tags And Mobile |
| WS6 | Media | UI-020, 021, 024 | WS1 | Media Playback And Actions |
| WS7 | Responsive And Navigation | UI-004, 019 | WS1 | Responsive Toolbars And Nav |
| WS8 | Trust, Legal, And Seed Data | UI-005, 008 | none, own cycles | Data Rights Footer and Dev Seed Module |

## Conflicts And Splits

- **UI-001 gates UI-003, UI-009, UI-026, UI-031.** The warn and role tokens must be settled in WS1 before WS5 or WS1-adjacent streams consume them.
- **UI-003 is three items.** Tag family-color accent, brand today marker, and a dark-mode pass. The spec keeps them one deliverable because they share the same token and template surface.
- **UI-009 conflicts with UI-026 and UI-028.** Its checkbox audit touches the same forms the switch migration rewrites. Resolve by converting checkboxes in WS1 first, then auditing actions.
- **UI-009 "No is red" conflicts with safe destructive UX.** Painting No red pushes users toward Yes. The spec records the request and defaults to a per-dialog policy. This is a human decision.
- **UI-013 depends on UI-014.** The people browser must exist before the legacy contacts stack is removed, so the People surface preserved is the new one.
- **UI-015 and UI-031 both touch admin chrome.** Photo Albums moves into a Media tab while badge tokens change. Both sit in or after WS1 and do not conflict at file level.
- **UI-027 version source touches `deploy.sh`.** Any change there is deploy-affecting and needs explicit sign-off.
- **UI-029 is two items.** The approved route and the pending route, plus the data-node decision. One spec covers both.

## Resolved Answers

The blocking questions were walked in interactive mode. These answers are now binding in the specs.

| ID | Question | Decision |
|---|---|---|
| UI-005 | Request channel | In-app queue on Realtime Database, not Firestore. The project has never used Firestore, so one feature must not add a second database, rules file, and SDK. No mailto fallback. |
| UI-005 | Removal semantics | Hard delete the record after verification, with a pre-delete export and a minimal non-PII audit entry. |
| UI-005 | Legal copy | Short, safe, human-reviewed wording. No promised response window, no claimed legal basis, no invented jurisdiction text. |
| UI-008 | Asset hosting | Download at seed time into a gitignored cache and clear the cache after the run. |
| UI-008 | Sources | Internet Archive and Library of Congress with a human-checked license ledger. |
| UI-008 | E2E reuse | Yes. Add `e2e/specs/admin-upload.spec.ts` driven by a small pinned fixture that proves Admin Media Upload against the emulator. Gate stays offline and deterministic. |
| UI-012 | Signup posture | Open email/password signup, server approval still required, no email-verification gate before approval, minimum 8-character password plus Firebase error mapping. |
| UI-013 | Migration scope | Dev then prod with `--confirm`, dry-run by default. No legacy contacts data preserved. |
| UI-014 | Person detail | Reuse `person-detail-modal` for view. Editing is a follow-up. CSV import moves to a toolbar action. |
| UI-029 | RTDB shape | Sibling `promotedRoutePending` with `{route, updatedAt}`. Allowed set is `/photos`, `/media/video`, `/media/audio`, `/expressions`, `/account`, `/upload`. No waiting page. Default `/photos`. |
| UI-026 | Multi-select exemption | All data-bound booleans become switches. Any future row-selection checkbox stays a checkbox. |
| UI-009 | Destructive color policy | Benign confirms use brand Yes and neutral No. Destructive confirms use error-solid on the destructive action and neutral Cancel. Do not paint No red. |
| UI-027 | Version scheme | Bump `package.json` in `deploy.sh` with `npm version --no-git-tag-version` before build. Commit the bump with the release. Deploy-affecting, needs sign-off. |
| UI-003 | Family color fallback | `var(--color-brand-primary)`. |
| UI-019 | Mobile actions | Text labels, stacked and left-aligned. |

## Branch Strategy And Merge Order

Use trunk-based branches off the current default branch. One branch per workstream keeps the gate runs isolated.

1. `ui/ws1-palette-control` off main. Merge first. This is the token and control baseline.
2. After WS1 merges, branch and run in parallel: `ui/ws2-admin-shell`, `ui/ws4-auth`, `ui/ws5-calendar`, `ui/ws6-media`, `ui/ws7-responsive`.
3. Merge order after WS1: WS2, then WS4, WS5, WS6, WS7 in any order, each rebased on main.
4. `ui/ws3-legacy-contacts` branches after WS2 with UI-014 merged, then merges last.
5. WS8 runs as two independent cycles, `ui/ws8-data-rights` and `ui/ws8-dev-seed`. Neither blocks the core batch merge.

Every branch must be gate-green before merge. No branch merges a red or skipped gate.

## Highest-Risk Item

UI-005, the data rights footer, is the highest-risk item. It is the only item that creates a legal obligation, changes a data contract, invites untrusted input, and can leak or destroy PII if the request flow is wrong. The chosen hard-delete path raises the stakes because it is irreversible, so it needs verification, a pre-delete export, and a minimal audit entry. It must stay in its own create-spec, build, redteam cycle and never ride the core batch merge. UI-013 is the second risk because its migration deletes a live RTDB node, so it requires the code-stop-writes first, dry-run, `--confirm`, and a dev-then-prod order.
