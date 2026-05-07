---
name: agent_design_committer
description: Use this skill after agent_design_implementer completes to organize changed files into logical commits. The skill chunks changes logically, commits with descriptive messages, and optionally cleans up test directories. Operates autonomously.
version: 2.0.0
user-invocable: true
model: haiku
effort: high
---

# Agent Design Committer

This skill organizes a completed implementation into logical, reviewable commits autonomously. It groups related changes, commits with descriptive messages, and cleans up temporary files — all without pausing for user approval at each step.

When this skill is invoked, it acts as a code organizer: group related changes, create meaningful commits, and handle cleanup.

**Important**: Start each invocation with a completely fresh context. Do not carry over assumptions about prior changesets or commit patterns from previous invocations.

---

## Input

No file path required. The skill operates on the current git working tree. Assumes the user has just completed an implementation and wants to organize the changes into clean, logical commits.

---

## Project Structure

This is a **monorepo with a separate frontend**:

- **Backend Repository**: `/Users/eric/bnk/cs/backend-service` (Rails, GraphQL API)
- **Frontend Repository**: `/Users/eric/bnk/cs/web-app` (React)

Changes may touch both repos in a single logical commit. Always check `git status` to see what files have changed across both directories.

---

## Understanding Commit Style

Your commit messages follow a clear, hierarchical format:

**Subject line** (concise, action-oriented):
```
Add Admin Feature Flags
Add Feature Flag Guard and Disabled Page
Add Unified Feature Configuration
```

**Bulleted details** (specific, imperative actions):
```
- Add FeatureFlag model.
- Add FeatureFlagsService with Firebase CRUD.
- Add AdminFeaturesComponent UI.
```

### How to Apply

When creating commits, **follow this exact style**:
- Subject is short and action-oriented ("Add X", "Fix Y", "Update Z")
- Bullets are specific, imperative actions starting with verbs
- Changes are grouped logically by feature area
- **Always use backticks** around code identifiers, component names, and filenames
- **Reduce redundancy**: When the same action repeats across multiple locations, consolidate under a single statement with indented bullet list

---

## Workflow

### Phase 1 — Assess the Changeset

1. **Run `git status`** to see all untracked and modified files.
2. **Run `git diff --stat`** to understand the scope of changes.
3. **Identify logical chunks** — group related changes by intent:
   - Core models and services
   - UI components and templates
   - Routing and guards
   - Configuration files
   - Test files (to be cleaned up later)

### Phase 2 — Commit Loop

For each logical chunk (in order):

1. **Stage the chunk.** Use `git add` to stage all files in this logical group.

2. **Create the commit.** Use `git commit -m` with your suggested message following the style guide.

3. **Verify the commit.** Run `git status` to confirm the staged changes are now committed.

4. **Repeat** for the next logical chunk until all feature code is committed.

### Phase 3 — Clean Up Temporary Test Files

After all feature code is committed:

1. **Identify test-related files.** Look for:
   - `spec/agent_design_specs/<feature_name>/` directories
   - `**/*.spec.ts` files that were created specifically for this feature
   - Test files that aren't part of the permanent test suite

2. **Remove test artifacts.** Delete the temporary test directory if it exists.

3. **Commit the cleanup.** Create a commit for test file removal.

### Phase 4 — Handoff

When all feature code is committed and cleanup is done:

- Report final git log showing the commits created.
- Confirm implementation is ready for PR.

---

## Hard Rules

1. **Commit autonomously.** No pausing for user approval — make the call yourself.
2. **Logical grouping.** Group changes by intent, even if they span multiple directories.
3. **Descriptive messages.** Use the subject + bullet style consistently.
4. **Verify each commit.** Check `git status` after each commit to confirm it's clean.
5. **No rewriting history.** No force-push, no rebase, no amend.
6. **No special characters in output.** Never use em dashes, arrows (->), or symbols like →.

---

## Tone & Style

- Be methodical and efficient. The user trusts you to make good commit decisions.
- Create meaningful commits that tell the story of the implementation.
- Keep commits focused — don't mix unrelated concerns.

---

## Anti-patterns

- **Don't mix unrelated concerns.** Keep logical grouping tight.
- **Don't create huge commits.** Split large implementations into logical pieces.
- **Don't leave uncommitted changes.** Verify git status is clean after each commit.
- **Don't forget test cleanup.** Remove temporary test files created during implementation.

---

## Example Output

When complete:

```
abc1234 Add Feature Flag Model and Service
def5678 Add Admin Features UI Component
ghi9012 Add Feature Disabled Page and Guard
jkl3456 Add Unified Feature Configuration
mno6789 Cleanup: Remove Pre-existing Broken Specs

Implementation committed and ready for PR.
```