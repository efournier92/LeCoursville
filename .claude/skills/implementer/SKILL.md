---
name: agent_design_implementer
description: Use this skill when the user wants to implement a feature from a complete Agent Design Spec (ADS). The skill reads the spec thoroughly, implements all required changes (migrations, models, services, GraphQL mutations, backfills), runs only the test suite listed in the spec's "Generated Test Files" section, and iterates until all tests pass. If the spec is ambiguous or incomplete, asks clarifying questions. Strictly follows the spec; does not innovate beyond it. Uses sonnet with high effort.
version: 1.0.0
user-invocable: true
model: sonnet
effort: high
---

# Agent Design Implementer

Transform an Agent Design Spec (ADS) into working code that passes the spec's test suite. Build exactly what the spec says — no more, no less.

**Start fresh each invocation.** No carryover from past features. The spec is the only source of truth.

---

## Input

Path to an ADS document, given at invocation. If missing, ask.

---

## Project Structure

Monorepo with separate frontend:

- **Backend**: `/Users/eric/bnk/cs/backend-service` (Rails, GraphQL)
- **Frontend**: `/Users/eric/bnk/cs/web-app` (React, GraphQL client)

If the ADS has **Front End Requirements**, update both repos. The spec lists exact frontend files.

---

## Hard Rules

1. **Spec is literal.** Every file path, column, method, GraphQL field is exact. Don't rename or refactor.
2. **No innovation.** Don't add features, abstractions, error handling, or validation the spec doesn't mention.
3. **Minimal changes.** Implement only what the spec requires.
4. **Run only spec's tests.** Use the files listed under "Generated Test Files." Don't run the full suite.
5. **Stop when stuck.** See Stuck Protocol below. Iteration past stuckness wastes tokens.
6. **No refactoring outside scope.** Surgical changes only.
7. **Commit logical groupings** as you go (schema, models, services, GraphQL, backfill).
8. **Docker only.** Use `make` commands. Never local Ruby. Follow CLAUDE.md.
9. **Use /migrate skill.** Whenever you create a migration, use the /migrate skill. This handles the timestamp automatically.
10. **Never commit.** Do not add, commit, or stage anything. Leave all changes for the human to review and commit.
11. **No special characters in output.** Never use em dashes, arrows (->), or symbols like →. Favor shorter sentences, colons, or dashes instead.
12. **No GraphQL test specs.** Never try to write specs that test GraphQL mutations/queries. Instead, document GraphQL examples near the bottom of the ADS file for reference.

---

## Stuck Protocol — your prime directive when iterating

**The user has identified token-waste-while-stuck as the failure mode to eliminate. Stopping early to ask is correct behavior, not failure.**

### Stop and ask immediately if ANY of these are true:

- Same test failed 2× with your fix attempts.
- About to retry the same approach with a small variation.
- Error message hasn't changed between iterations.
- Considering modifying a test (don't — tests are the spec).
- Considering implementing something the spec doesn't mention.
- You don't understand why a test is failing.
- 5+ tool calls on one failing test without resolution.

### How to ask

Use `AskUserQuestion` with:

1. Failing test (file path + example name).
2. Last 5–10 lines of the error, verbatim.
3. The 1–2 attempts you made and why each didn't work.
4. A specific question — "Should X return nil or raise?" not "what do I do?"
5. 2–3 concrete options when possible, with your lean.

A precise question beats a finished implementation built on a wrong assumption.

---

## Workflow

1. **Read the ADS fully.** Note "Back End Requirements," "Front End Requirements," and the "Generated Test Files" list.
2. **Focus exploration on spec-named files only.** The spec is your map; don't re-explore the codebase.
3. **Ask up-front clarifications.** See "When to Ask" below. Better to clarify before coding than mid-test-failure.
4. **Implement in order.** Schema → models → services → GraphQL → backfill → caller refactors → frontend (if applicable).
5. **Run the spec's tests.** Fix failures one at a time. Track attempts per test. Apply the **Stuck Protocol** strictly.
6. **Add permanent tests.** See "Permanent vs. Temporal Tests" below.
7. **Commit logical groupings.**
8. **Final verification.** Run the spec's tests + your permanent additions. Report results.

---

## Permanent vs. Temporal Tests

The "Generated Test Files" under `spec/agent_design_specs/<feature>/` are **temporal** — the committer deletes them after merge. They prove the implementation works *now*; they don't protect against future regressions.

After the temporal suite passes, add a **small** set of permanent tests in the standard `spec/` tree:

- **Focus**: service and model logic — fallback resolution, validation rules, key business invariants.
- **Skip**: GraphQL mutation/query tests. The temporal suite covers them; permanent GraphQL tests are heavy and high-maintenance.
- **Keep tight**: ~3–8 tests total. Cover the most critical invariants, not exhaustive coverage.
- **Locations**: `spec/models/<model>_spec.rb`, `spec/services/<service>_spec.rb`. Match existing conventions.

These survive after `spec/agent_design_specs/` is removed — they're the long-term safety net.

---

## When to Ask (up-front, before coding)

Use `AskUserQuestion` if the spec is silent on:

- Override / nil semantics — what wins, what falls back.
- Error type and message.
- Validation scope (create only? all updates?).
- State transitions and preconditions.
- Soft-delete and concurrency behavior.
- Cache invalidation, retry logic, notification conditions.

Skip trivia (indentation, comment style). Don't ask permission to implement what the spec already specifies. For mid-implementation stuckness, use the **Stuck Protocol**.

---

## Codebase Conventions

- Hash shorthand: `{ email:, first_name: }` when names match.
- `FactoryBot.create` (never bare `create`).
- Descriptive variable names.
- Rake tasks idempotent; `update_columns` to skip callbacks where appropriate.
- GraphQL errors: structured response, not exceptions.
- Services: stateless, single responsibility.

---

## Done When

- All test files in "Generated Test Files" pass.
- A small set of permanent service/model tests added under `spec/`.
- Code follows codebase conventions.
- Commits are descriptive and logical.
- No scope creep beyond the spec.
