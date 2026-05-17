# People Filter Feature ADS

**Branch:** `feature/people-from-csv`
**Directory:** `src/app/components/people/`

## Context & Motivation

The `/people` page currently has a "Search" input that filters the people list but does not affect the family tree structure. The family tree is always rendered in full regardless of the search. The requested feature replaces the "Search" label with "Filter" and implements substring-matching name filtering that (1) narrows the family tree to only show matched person nodes and their ancestor nodes, and (2) hides non-matching nodes entirely from the UI.

## Glossary

- **Filter** — the text input previously labeled "Search"; accepts a string pattern that is matched against a person's full name
- **Match** — a person whose `name.full` or `name.firstPreferred` contains the filter string as a case-agnostic substring
- **Ancestor chain** — a person P and all of P's parents, grandparents, etc. traversed recursively through `parentIds[]` until no further parents exist or a founder is reached
- **Spouse node** — a person record with an ID ending in `-S`; does not have independent name fields; always shown/hidden with their partner
- **Visible node** — a `PersonNode` that should be rendered in the family tree because it matches the filter directly OR is an ancestor of a matched person OR is the spouse of a visible person
- **Non-matching subtree** — nodes that have no matched descendant and are not ancestors of any matched person; these are removed from the DOM

## Current State

### PeopleComponent — template and bindings

**`src/app/components/people/people.component.html`** (lines 3-20):

```html
<mat-form-field class="filter-people-form-field">
  <mat-label>Search</mat-label>
  <input
    matInput
    type="text"
    [(ngModel)]="searchQuery"
    (input)="onSearchChange(searchQuery)"
  />
  <button *ngIf="searchQuery" matSuffix mat-icon-button aria-label="Clear" (click)="onSearchChange('')">
    <mat-icon>close</mat-icon>
  </button>
</mat-form-field>
```

### PeopleComponent — filter logic

**`src/app/components/people/people.component.ts`**:

- Line 45: `searchQuery = ''` — input bound to this field
- Lines 94-97: `onSearchChange(query: string)` — updates `searchQuery` and calls `applyFilter()`
- Lines 158-247: `applyFilter()` — private method that runs the list filter

Current `applyFilter()` only filters the flat `filteredPeople` list. It does not affect the `familyGroups` tree structure — the tree is always fully built from the filtered list.

### Name matching in Person model

**`src/app/models/person.ts`** (lines 9-16):

```typescript
export interface Name {
  full: string;           // line 10
  firstFormal: string | null;
  firstPreferred: string | null;  // line 12
  maiden: string | null;
  last: string | null;
  suffix: string | null;
}
```

Person name is matched via `name.full` and `name.firstPreferred` (substring, case-agnostic). Deprecated `nickname` field is NOT included in matching.

### PersonNode tree structure

**`src/app/components/people/people.component.ts`** (lines 10-15):

```typescript
interface PersonNode {
  person: Person;
  spouse: Person | null;
  children: PersonNode[];
  level: number;
}
```

The tree is built via `buildNode()` and `findChildren()`. `parentIds` on Person is a string array of direct parent IDs.

### FamilyGroup tree assembly

- `findFirstGeneration()` — builds generation-1 spouse-pair nodes
- `findRootNodes()` — builds generation-2+ root nodes under each spouse pair
- `findChildren()` — recursively builds child nodes; uses `parentIds` to find children

### Existing search behavior

Lines 160-167 filter using `toLowerCase().includes()` on `name.full`, `name.firstPreferred`, and clan name. The clan name clause is removed when search becomes filter.

## Goals

1. Change the input label from "Search" to "Filter"
2. Rename `searchQuery` to `filterQuery` and `onSearchChange` to `onFilterChange`
3. When filter text is present, find all people whose `name.full` or `name.firstPreferred` contains the filter as a case-agnostic substring
4. For each matched person, recursively traverse `parentIds[]` to include all ancestor nodes in the visible tree
5. Build a new filtered tree that only contains matched nodes and their ancestor chains
6. Remove non-matching nodes from the DOM entirely
7. When filter is cleared, restore the full tree (all clans, all trees) — same as today
8. When filter text is entered, reset the clan dropdown to "All clans"

## Non-Goals

- Searching across clans field — removed from filter behavior; clan filter is reset when search is active
- Modifying the Firebase data model — no schema changes
- Adding new API endpoints — no backend changes
- Changing the person detail modal — no changes
- Including deprecated `nickname` field in name matching

## Prerequisites

- `src/app/components/people/people.component.ts` — PeopleComponent
- `src/app/components/people/people.component.html` — PeopleComponent template
- `src/app/models/person.ts` — Person and Name interfaces
- `src/app/services/people.service.ts` — PeopleService

## Design Principles

1. **Mirror existing `applyFilter()` pattern** — use the same reactive flow (subscription to `people$`, call `applyFilter()` on changes)
2. **Recursive ancestor traversal** — use the existing `parentIds[]` array to walk up the chain from a matched person
3. **Remove from DOM, do not CSS-hide** — use filtered node sets rather than CSS classes to control visibility
4. **Rename for clarity** — `searchQuery` -> `filterQuery`, `onSearchChange` -> `onFilterChange`, but preserve routing param key `family` for the clan filter
5. **Spouse always follows partner** — if a person node is visible, their spouse node (`id + '-S'`) is always visible regardless of filter match
6. **Sibling visibility propagates upward** — if a person at generation N matches the filter, all of their siblings at generation N are visible (not filtered out)

## Front End Requirements

### 1. Component property renames

- Line 45: Rename `searchQuery = ''` to `filterQuery = ''`
- Line 94-97: Rename `onSearchChange(query: string)` to `onFilterChange(query: string)`, update internal call to `this.filterQuery = query; this.applyFilter();`

### 2. Template label change

- Line 4 of `people.component.html`: Change `<mat-label>Search</mat-label>` to `<mat-label>Filter</mat-label>`
- Update `[(ngModel)]="searchQuery"` to `[(ngModel)]="filterQuery"`
- Update `(input)="onSearchChange(searchQuery)"` to `(input)="onFilterChange(filterQuery)"`
- Update `(click)="onSearchChange('')"` to `(click)="onFilterChange('')"`
- Update `*ngIf="searchQuery"` to `*ngIf="filterQuery"`
- Update `*ngIf="searchQuery"` for the empty state message to `*ngIf="filterQuery"`

### 3. New helper methods

Add the following private methods to `PeopleComponent`:

**`private getMatchedPersonIds(filterQuery: string): Set<string>`** — returns the set of person IDs that match the filter string via substring match on `name.full` and `name.firstPreferred` (case-agnostic). Skips spouse nodes (`id.endsWith('-S')`).

**`private getAncestorIdsSet(matchedIds: Set<string>): Set<string>`** — recursively walks `parentIds[]` from each matched person upward until no further parents exist. Returns a Set including all ancestor IDs but not the matched IDs themselves.

**`private addSpousesToVisibleSet(visibleIds: Set<string>): void`** — iterates over `visibleIds` and adds `id + '-S'` for each if that spouse exists in `peopleMap`.

**`private filterTreeByVisibility(nodes: PersonNode[], visibleIds: Set<string>): PersonNode[]`** — given a tree, returns a new tree containing only nodes whose person ID is in `visibleIds`. Recursively filters children.

**`private buildFamilyGroupsWithFilteredTrees(visiblePeople: Person[], visibleIds: Set<string>): FamilyGroup[]`** — builds family groups with trees filtered to only visible nodes. For each clan: builds firstGeneration and roots, then calls `filterTreeByVisibility` on both. Skips clans where both result arrays are empty.

**`private buildFamilyGroups(visiblePeople: Person[]): FamilyGroup[]`** — extracted original family group building logic (lines 207-249) for use when filter is empty.

### 4. Modified `applyFilter()` logic

Refactor `applyFilter()` to:

1. If `filterQuery` is empty:
   - Build full family trees as today (all clans, all people with `generationNumber > 0`)

2. If `filterQuery` is non-empty:
   - Get `matchedIds = this.getMatchedPersonIds(this.filterQuery)`
   - Get `ancestorIds = this.getAncestorIdsSet(matchedIds)`
   - `visibleIds = matchedIds union ancestorIds`
   - Call `this.addSpousesToVisibleSet(visibleIds)`
   - Call `buildFamilyGroupsWithFilteredTrees(visiblePeople, visibleIds)`

### 5. Clan filter reset

When `onFilterChange` is called with a non-empty `filterQuery`:
- Call `this.clearFamilyFilter()` internally to reset `selectedFamily` and update URL query params

When `onFilterChange` is called with an empty `filterQuery`:
- No change to `selectedFamily` state; the existing clan filter remains active

## Firebase Requirements

None — no backend changes.

## Production Risks & Mitigations

1. **Deep ancestor chains** — matched person at gen 8+ creates a large visible set. Mitigation: algorithm naturally limits to direct parent references; no infinite loops possible since `parentIds` forms a DAG.
2. **Orphan parentIds** — a person whose `parentIds[]` references IDs not in `peopleMap`. Mitigation: `getAncestorIdsSet` checks `this.peopleMap.has(parentId)` before recursing; unknown IDs are skipped.
3. **Null `name.firstPreferred`** — `name.firstPreferred` can be null. Mitigation: existing null-check pattern is preserved in `getMatchedPersonIds`.

## Rollout Plan

1. Update `people.component.html` — change label and bindings
2. Update `people.component.ts` — rename properties and methods
3. Add new private helper methods
4. Refactor `applyFilter()` to call new helper methods
5. Verify locally with `ng serve` and test: empty filter shows full tree, filter "ann" shows matching people + ancestors, clear filter restores full tree

## Test Plan

### `people.component.spec.ts`

1. **Label change** — verify the template renders "Filter" not "Search"
2. **Empty filter shows all clans** — with `filterQuery = ''`, all family groups render with full trees
3. **Filter match on name.full** — set `filterQuery = 'ann'`, verify Person with `name.full = 'Anna Smith'` is matched
4. **Filter match on name.firstPreferred** — set `filterQuery = 'beth'`, verify Person with `name.firstPreferred: 'Elizabeth'` and `name.full: 'Mary Johnson'` is matched
5. **No match on nickname** — Person with `nickname: 'Bobby'` but `name.full` and `name.firstPreferred` do not contain 'bob' should NOT match
6. **Ancestor chain visible** — a grandchild (gen 3) matches; verify parent (gen 2) and grandparent (gen 1) nodes appear in tree
7. **Non-ancestor nodes hidden** — a person with no relationship to any matched person is NOT visible in tree
8. **Spouse shown with partner** — when a person matches, their spouse node (id-S) is also visible
9. **Filter clears clan filter** — with `selectedFamily = 'Smiths'` set, entering `filterQuery = 'ann'` resets `selectedFamily` to empty
10. **Clear filter restores clan filter** — with `selectedFamily = 'Smiths'` and `filterQuery = 'ann'`, clearing `filterQuery` to '' keeps `selectedFamily = 'Smiths'`
11. **Empty filter state** — with `filterQuery = ''` and no clan filter, `familyGroups` contains all clans
12. **No matched people** — with `filterQuery = 'zzznomatch'`, `familyGroups` should be empty
13. **Generation number constraint** — a person with `generationNumber = 0` should never appear in tree regardless of name match

## Summary of Changes

### Components

- **`src/app/components/people/people.component.html`**
  - Change `mat-label` text from "Search" to "Filter" (line 4)
  - Update all `searchQuery` bindings to `filterQuery`
  - Update all `onSearchChange` calls to `onFilterChange`

- **`src/app/components/people/people.component.ts`**
  - Rename `searchQuery` to `filterQuery` (line 45)
  - Rename `onSearchChange()` to `onFilterChange()` (line 94)
  - Add `getMatchedPersonIds(filterQuery: string): Set<string>` (new method)
  - Add `getAncestorIdsSet(matchedIds: Set<string>): Set<string>` (new method)
  - Add `addSpousesToVisibleSet(visibleIds: Set<string>): void` (new method)
  - Add `filterTreeByVisibility(nodes: PersonNode[], visibleIds: Set<string>): PersonNode[]` (new method)
  - Add `buildFamilyGroupsWithFilteredTrees(visiblePeople: Person[], visibleIds: Set<string>): FamilyGroup[]` (new method)
  - Add `buildFamilyGroups(visiblePeople: Person[]): FamilyGroup[]` (new method)
  - Refactor `applyFilter()` to branch on filter active/empty
  - When filter is non-empty, call `clearFamilyFilter()` internally
  - Remove clan name clause from filter matching (only `name.full` and `name.firstPreferred`)

## Open Questions

None.