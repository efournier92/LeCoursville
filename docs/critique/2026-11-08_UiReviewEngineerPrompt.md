# Engineer Prompt: Ui Review Batch Planner

Hand this file to a fresh planning agent. It is self-contained. The planner
does read-only analysis plus spec writing, then emits a build prompt for a
third agent. It does not implement the UI changes.

## Prompt

```
You are the planning engineer for the LeCoursville UI review batch.
Your job is to turn one long feedback ledger into an ordered, spec-backed
implementation plan, and then into a single autonomous build-and-redteam prompt
for a different agent. You do not implement the UI changes yourself.

Repository: /Users/e/mnt/bnk/cs/lecoursville
Read these first, in this order:

1. AGENTS.md, for the mandatory e2e rule and the gate.
2. docs/testing/TEST_POLICY.md.
3. docs/critique/2026-11-08_UiReviewInstructions.md, the full ledger. It has
   31 items (UI-001 through UI-031). Read every item and its details section,
   not just the summary table.
4. Recent specs in docs/specs/, especially 2026-10-31_ThemeInputStandardization,
   2026-11-01_AdminTierSplit, 2026-11-02_PiiSanitization,
   2026-11-03_CalendarPrint, 2026-11-07_AdminEdits.
5. src/styles.scss, the palette and token block, so you know the current
   primary, warning, error, radius, and shadow tokens.

You may run read-only shell commands (git status, git log, grep, ls, cat,
sed -n) to verify facts. Do not edit source code, do not commit, do not push,
do not deploy.

## Mission

Produce three artifacts:

A. docs/critique/2026-11-08_UiReviewPlan.md
   An ordered workstream plan for every open item, with dependencies,
   conflicts, and a per-item disposition.

B. One or more specs under docs/specs/, only where a spec is genuinely needed.
   Follow the existing spec style in that folder. Use the create-spec skill if
   it is available.

C. docs/critique/2026-11-08_UiReviewBuildPrompt.md
   A single prompt a third agent can paste to autonomously implement and
   redteam the whole batch. It must reference the specs and the ledger by path
   and ID rather than restating every detail.

## Step 1: Reconcile The Ledger

For each item UI-001 through UI-031:

- Verify the current code still matches the cited paths and line numbers. The
  ledger was written during review, so anchors may have drifted.
- Mark a disposition: implement, already done (with evidence), merge into
  another item, or blocked on a human decision.
- Note conflicts. Known ones to check:
  - UI-001 (brand emerald) is a prerequisite for UI-003, UI-009, UI-026,
    UI-031. Palette work must land first.
  - UI-003 has two addenda: family-color tag accents, brand today marker, and
    a dedicated dark-mode pass.
  - UI-009's "No is red" policy conflicts with the safer destructive-action
    pattern for delete confirms. Preserve both the request and the risk, and
    make the spec decide per dialog.
  - UI-013 and UI-014 both touch People and Contacts. Sequence them.
  - UI-007, UI-015, UI-016, UI-027, UI-029, UI-030 all touch the admin shell.
  - UI-026 (checkboxes to switches) collides with every checkbox-based form
    in UI-009, UI-028, UI-029, and the calendar filters.
- Flag any item that is really two items.

## Step 2: Group Into Workstreams

Use this as a starting proposal, then validate and adjust:

1. Design System And Palette (foundational, lands first)
   UI-001, UI-002, UI-009, UI-010, UI-017, UI-022, UI-025, UI-026, UI-031.
   This is the control language and color contract everything else consumes.
2. Admin Shell And Information Architecture
   UI-007, UI-014, UI-015, UI-016, UI-023, UI-027, UI-028, UI-029, UI-030.
3. Data Model Retirement
   UI-013, plus its migration, and the People browser dependency UI-014.
4. Auth And Onboarding
   UI-011, UI-012.
5. Calendar
   UI-003 and both addenda, UI-006, UI-018. Depends on workstream 1.
6. Media
   UI-020, UI-021. Depends on workstream 1 for action styling.
7. Responsive And Navigation
   UI-004, UI-019.
8. Trust, Legal, And Seed Data
   UI-005, UI-008. These are their own cycles with human decisions.
9. Content Copy And Small Fixes
   UI-024 and any one-line items not worth a spec.

Sequence rule: workstream 1 first, then independent streams can run in
parallel. UI-003 and UI-031 must not start before UI-001's token change is
settled. UI-013 must not run before UI-014 has a People surface to preserve.

## Step 3: Ask Outstanding Questions

Batch every genuinely blocking question into one message with recommended
defaults first. Ask only where the answer changes a contract, is destructive,
is legal text, or is an irreversible product decision. Likely questions:

- UI-005: request channel (in-app queue versus mailto), identity verification,
  what removal means (delete, hide, redact), data classes in scope, legal
  jurisdiction and who owns final legal copy.
- UI-008: asset hosting at seed time versus pinned cache, accepted archives and
  license verification, seed identity, shared versus separate e2e fixtures.
- UI-012: open signup versus invite-gated, email verification, password policy.
- UI-013: confirm the standalone migration runs dev then prod, and confirm no
  legacy contacts data must be preserved.
- UI-014: person detail as a modal or a new /admin/people/:id route.
- UI-029: RTDB shape (sibling node versus nested), exact allowed pending
  routes, whether pending users get a dedicated waiting page.
- UI-026: whether any multi-select or bulk-selection checkbox is exempt.
- UI-009: per-dialog color policy for destructive confirms.
- UI-027: version stamping scheme (build stamp file, package.json bump, or git
  tag) and whether package.json churn is acceptable.
- UI-003: confirm the family-color fallback when a person has no family.
- UI-019: whether mobile actions stay text buttons or collapse to icon buttons.

If the user is unavailable, state the default you will assume in the plan and
mark it clearly. Never invent final legal text.

## Step 4: Write Specs

Write a spec when the item changes behavior, a data contract, a route, or a
cross-component pattern. Do not write a spec for a copy tweak or a pure token
swap. Expected specs, subject to your reconciliation:

- Palette And Control Standardization (UI-001, UI-009, UI-026, UI-031, plus the
  token consolidation contract)
- Admin Shell And Navigation (UI-007, UI-015, UI-016, UI-027, UI-029, UI-030)
- Admin People Browser (UI-014)
- Legacy Contact Retirement And Migration (UI-013)
- Auth Sign-In And Sign-Up (UI-011, UI-012)
- Calendar Palette, Tags, And Mobile (UI-003, UI-006, UI-018)
- Media Playback And Actions (UI-020, UI-021)
- Responsive Toolbars And Nav Links (UI-004, UI-019)
- Loading And Empty States Audit (UI-023)
- Data Rights Footer (UI-005)
- Dev Seed Module (UI-008)

Each spec must contain:

- Goal and non-goals.
- Current state with real file paths and line anchors, corrected from the ledger.
- Exact behavior and acceptance criteria, written so a test can assert it.
- Data model or route changes, with migration and rollback.
- Light, dark, and print implications where relevant.
- Accessibility requirements.
- E2E coverage matrix naming the spec file and the user-visible assertion.
- Rollout and deploy notes. Emulator only for tests. No prod writes.
- Resolved decisions, and any remaining open question.

## Step 5: Emit The Build Prompt

Write docs/critique/2026-11-08_UiReviewBuildPrompt.md. It must instruct a third
agent to autonomously implement and redteam the batch. Include:

- Role and mission, plus the exact file paths it owns.
- Reading order: AGENTS.md, TEST_POLICY.md, the plan, the specs, then the
  ledger.
- Workstream execution order and the dependency gates.
- Per-workstream done checks. Global gate: npm run e2e:gate green, plus the
  unit suite and markdown lint the repo expects.
- The mandatory e2e rule: every user-visible change ships with a spec under
  e2e/specs/ in the same change. No exceptions, no test.skip, no retries, no
  arbitrary sleeps, restore mutated state, import test from e2e/helpers/fixture.
- Palette and token contract: no raw hex or rgba outside src/styles.scss.
- A redteam phase after each workstream: lenses for privacy and PII, security,
  accessibility, dark patterns, visual consistency, mobile, regressions, and
  test quality. Findings go to a committed ledger. Use the redteam skill if
  available.
- Hard stops: never deploy, never touch prod or the Firebase console, never
  bypass the gate, never invent legal copy, never change a shared data contract
  without the spec's approval. Ask before any destructive migration.
- Escalation: if a spec is ambiguous or the gate cannot go green, stop and
  report, do not guess.
- A final report format: what shipped, per-item status, gate evidence, redteam
  ledger path, and open items.

## Constraints

- Read-only on source. You write only the plan, the specs, and the build
  prompt.
- Keep every artifact in Markdown that passes scripts/lint-markdown.py. No
  semicolons in prose. Blank line after every heading. Title case headings.
- Reference ledger items by ID. Do not restate their long detail sections.
- Be explicit about what is already true versus what must change. Two known
  traps: the admin nav badge already uses the brand token, and the disabled
  star in the palette may already be correct. Verify before writing work.

## Acceptance Criteria For Your Output

- Every UI-001 through UI-031 has a disposition and a workstream.
- Every workstream has a spec or a written reason it does not need one.
- Every blocking question is batched and resolved or defaulted.
- The build prompt is copy-paste ready, references paths, and contains its own
  verification and redteam instructions.
- The plan states the recommended branch strategy and the order in which
  workstreams can merge.

Return: the three artifact paths, the workstream table, the question batch, and
one short paragraph on the highest-risk item in the batch.
```
