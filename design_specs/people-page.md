# Agent Design Spec: People Page

## 1. Branch & Directories

- **Frontend Repository**: `/Users/e/mnt/bnk/cs/lecoursville` (Angular 15, TypeScript)
- **Firebase Backend**: Realtime Database
- **Spec File**: `/Users/e/mnt/bnk/cs/lecoursville/design_specs/people-page.md`

---

## 2. Context & Motivation

The people page is the end-user facing view of all people in the system. It displays people grouped by family in a nested tree structure, with search and filter capabilities. Clicking a person's name opens their detail page.

This spec covers the public-facing PeopleComponent and PersonDetailModalComponent.

---

## 3. Non-Goals

- Admin CSV import (see `admin-people-import.md`)
- Contact migration
- Calendar event creation/linking
- Expand/collapse — tree is always fully expanded

---

## 4. PeopleComponent

**Location**: `src/app/components/people/people.component.ts`

**Selector**: `app-people`

**Route**: `/people` and `/people/:id` (protected by AuthGuardService, FeatureFlagGuardService with 'people' flag)

### 4.1 UI Elements

- **Filter bar**:
  - Search input (left) — filters by name.full, nickname, clan
  - Family dropdown (right) — filters by clan
  - X button to clear family filter
- **Family groups**: Each family (clan) rendered as a card with header and nested tree below
- **Nested tree**: All generations always visible, statically expanded

### 4.2 Tree Structure

**Structure**:
- Families (clan) are the top-level grouping
- Within each family, a tree hierarchy replaces the flat generation list
- Gen 0 roots (0-0, 0-1) are hidden
- Gen 1 and Gen 2+ form the visible tree

**Root Node Determination**:
- Families with living Gen 1 members: Gen 1 members (A, B, etc.) are root nodes
- Families with no living Gen 1: Generation 2 siblings (A-1, A-2, B-1, etc.) become root nodes
- Hidden people: Gen 0 roots, deceased (isLiving=false) people, empty families

**Spouse Pairing**:
- When both A and A-S exist, they appear side-by-side in the same row
- They share children shown indented under the pair
- Spouse names connected by " & " separator

**Visual Design**:
- Each `tree-row` contains a person name and optional spouse name
- `person-info` span wraps name and spouse with `padding: 0.75em 0`
- Names styled: `font-size: 1rem; font-weight: 450; color: #333; letter-spacing: 0.01em`
- Spouse separator " & " styled: `color: #bbb; margin: 0 6px`
- Both primary and spouse use the same `.person-name` class
- Hover on `.person-name.clickable` underlines the name
- Clicking a name navigates to `/people/:id`

**Indentation and Borders**:
- Indentation via `padding-left: 40px` on `children-container` divs
- `tree-rows` uses same pattern as `children-container`: flex with generation bar + children items
- `generation-bar` is 2px wide, colored with parent's colorHex, extends to connect sibling bars
- Bars use `align-self: stretch` to span full height of their container
- Pattern repeats at every nesting level (fully recursive)

**HTML Structure**:
```html
<div class="tree-rows">
  <div class="generation-bar" [style.background-color]="getFamilyColorForClan(group.clan)"></div>
  <div class="children-items">
    <ng-container *ngTemplateOutlet="nodeTemplate; context: { nodes: group.roots, level: 0 }"></ng-container>
  </div>
</div>

<ng-template #nodeTemplate let-nodes="nodes" let-level="level">
  <ng-container *ngFor="let node of nodes">
    <div class="tree-row">
      <span class="person-info">
        <span class="person-name clickable" (click)="openPersonDetail(getPersonId(node))">
          {{ getPersonName(node) }}
        </span>
        <span class="spouse-separator" *ngIf="getSpouseName(node)"> &amp; </span>
        <span class="person-name clickable" *ngIf="getSpouseName(node)" (click)="openPersonDetail(getSpouseId(node))">
          {{ getSpouseName(node) }}
        </span>
      </span>
    </div>
    <div class="children-container" *ngIf="hasChildren(node)">
      <div class="generation-bar" [style.background-color]="getColorHex(node)"></div>
      <div class="children-items">
        <ng-container *ngTemplateOutlet="nodeTemplate; context: { nodes: getNodeChildren(node), level: level + 1 }"></ng-container>
      </div>
    </div>
  </ng-container>
</ng-template>
```

**CSS Structure**:
```scss
.tree-rows, .children-container {
  display: flex;
  > .generation-bar { align-self: stretch; flex-shrink: 0; width: 2px; margin-right: 12px; }
  > .children-items { flex: 1; }
}
.children-container { padding-left: 40px; }
.person-info { padding: 0.75em 0; display: flex; align-items: center; flex-wrap: wrap; }
.person-name { font-size: 1rem; font-weight: 450; color: #333; letter-spacing: 0.01em; }
.person-name.clickable:hover { text-decoration: underline; }
.spouse-separator { color: #bbb; margin: 0 6px; }
```

**Recursive Template Implementation**:
The tree uses an Angular recursive template pattern via `ngTemplateOutlet` to handle arbitrary nesting depth. The `children-container` wrapping pattern is applied at every level including the root `tree-rows`, making it work infinitely deep.

Key interfaces:
```typescript
interface PersonNode {
  person: Person;
  spouse: Person | null;
  children: PersonNode[];
  level: number;
}
```

Key methods:
- `getNodeChildren(node)` — returns `node.children`
- `hasChildren(node)` — returns `node.children.length > 0`
- `getPersonName(node)` / `getSpouseName(node)` — name accessors
- `getPersonId(node)` / `getSpouseId(node)` — ID accessors
- `getColorHex(node)` — color accessor for generation bar

**Tree Construction Algorithm**:
```
buildTree(people):
  1. Filter out: isLiving=false, generationNumber=0, empty clan families
  2. Find root nodes per family:
     - If family has living Gen 1 members → those Gen 1 are roots
     - Else → deepest available Gen 2 members are roots
  3. For each root node:
     - If spouse (id + '-S') exists → pair them as shared root
     - Find children: people whose parentIds includes the root (or root pair)
     - Recursively attach children (only under first parent if two exist)
  4. Sort children by: generationNumber ASC, then ID
```

**Filter Integration**:
- Search filters by name.full, nickname, clan
- Family filter restricts to selected clan
- Both filters applied in `applyFilter()` before building family groups

**URL Params**:
- `?family=<clan>` — family filter

**Edge Cases**:
- Gen 1 with no spouse in dataset: single person row
- Person with two parents: shown under first parent in parentIds only
- Orphan nodes (parent not in dataset): treated as root nodes
- Empty family: hidden entirely
- **Group sorting**: sorted by AppSettings.families order
- **Empty state**: when no people match

### 4.3 Interactions

- Type in search → filters displayed people in real-time
- Select family from dropdown → updates URL, filters by clan
- Click X → clears family filter
- Click person name → opens PersonDetailModalComponent, updates URL to `/people/:id`
- Hover person name → underlines name

### 4.4 Data Handling

- Subscribes to `PeopleService.people$`
- Filters for `isActive !== false` (excludes soft-deleted)
- Searches: `name.full.toLowerCase().includes(query) || (nickname && nickname.toLowerCase().includes(query)) || (clan && clan.toLowerCase().includes(query))`
- Family filter: `clan === selectedFamily`
- Group by: clan

---

## 5. PersonDetailModalComponent

**Location**: `src/app/components/person-detail-modal/person-detail-modal.component.ts`

**Selector**: `app-person-detail-modal`

### 5.1 Trigger

- Opens when URL is `/people/:id` (route parameter)
- Same component renders modal overlay
- Closes when URL is `/people` (no id)

### 5.2 UI Layout

**Header section**:
- Person name (name.full)
- Left border: 6px solid, colored with colorHex (fallback `#e0e0e0`)
- Close button (X icon) top-right

**Sections (top to bottom)**:

1. **Basic Information** (no section header)
   - Birthday (with calculated age in parentheses)
   - Anniversary (only if no spouse)
   - Family: first lineage segment
   - Generation: generationNumber

2. **Spouse** (own card, only if person has spouse spouseId)
   - Spouse name (link, clickable → navigates to `/people/:spouseId`)
   - Anniversary date (for the person)

3. **Emails**
   - Each email: mailto: link with address
   - Label shown if present

4. **Phones**
   - Each phone: tel: link with number
   - Label shown before number (Home, Cell, etc.)

5. **Lineage**
   - Plain text from lineage field

6. **Events** (collapsible)
   - Calendar events where personId matches
   - Shows event title and date

### 5.3 Interactions

- Click backdrop → close modal (navigate to `/people`)
- Press Escape → close modal
- Click close button → close modal
- Click spouse name → navigate to spouse's modal

### 5.4 Display Helpers

- **Calculate age**: `today.getFullYear() - birthday.year`, adjust for month/day
- **Format date**: "January 15, 1992" for PersonDate
- **Missing fields**: Show "-" or hide section gracefully

---

## 6. Person Interface (for display)

```typescript
interface Person {
  id: string;
  name: Name;
  nickname: string | null;
  clan: string | null;
  birthday: PersonDate;
  spouse: string | null;
  spouseId: string | null;
  anniversary: PersonDate | null;
  anniversaryId: string | null;
  emails: Email[];
  phones: Phone[];
  address: Address | null;
  addressId: string | null;
  directDescendent: boolean;
  generationNumber: number;
  parentIds: string[];
  lineage: string | null;
  colorHue: string | null;
  colorHex: string | null;
  isLiving: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

interface Name {
  full: string;
  firstFormal: string | null;
  preferred: string | null;
  maiden: string | null;
  last: string | null;
  suffix: string | null;
}

interface Address {
  full: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  label: string | null;
}

interface Email {
  address: string;
  label: string | null;
}

interface Phone {
  label: string;
  number: string;
}

interface PersonDate {
  year: number;
  month: number;
  day: number;
}
```

---

## 7. Backward Compatibility

- **name**: If `person.name` is a string (legacy), treat it as name.full
- **address**: If `person.address` is null but `person.addressId` exists, show "Address on file" or fetch from AddressesService
- **lineage**: If null, show "-"
- **parentIds**: If missing (legacy data), treat as empty array
- **colorHex**: Fallback `#e0e0e0` if null

---

## 8. Test Cases

### PeopleComponent

1. **Displays people grouped by clan** — grouped by clan, sorted by AppSettings.families
2. **Search filters by name/nickname/clan** — typing filters correctly
3. **Family dropdown filters** — selecting filters by clan
4. **Clear family filter** — X button resets filter
5. **URL param family filter** — `/people?family=Diane` filters correctly
6. **Sort by generation** — oldest first (generationNumber ascending)
7. **Click name opens modal** — navigation to /people/:id works
8. **Hides inactive** — people with isActive: false not shown

### Nested Tree Tests

1. **Tree builds correctly** — given 0-0, 0-1, A, A-S, A-1, A-1-1, tree shows A/A-S as root with A-1 under them, A-1-1 under A-1
2. **Gen 1 root when living Gen 1 exists** — family with living A and A-S shows A/A-S as root, not children
3. **Gen 2 root when no living Gen 1** — family with no living Gen 1 shows deepest Gen 2 as roots
4. **Spouse pairing** — A and A-S appear in same row with " & " separator
5. **Children under spouse pair** — A-1, A-2 indented under A/A-S pair
6. **Single Gen 1 no spouse** — shows single person row
7. **Deceased hidden** — isLiving=false people excluded from tree
8. **Gen 0 hidden** — generationNumber=0 people not shown in tree
9. **Indentation** — children indented 40px per level
10. **Child ordering** — children sorted by generationNumber ASC, then ID
11. **Bars connect siblings** — generation bars stretch to connect adjacent siblings
12. **Infinite nesting** — recursive children-container pattern works at any depth
13. **Orphan root** — person with no matching parentIds treated as root
14. **Empty family hidden** — family with no visible people not rendered

### PersonDetailModalComponent

1. **Shows name in header** — with colorHex border
2. **Calculates age** — correct from birthday
3. **Shows birthday formatted** — "Month Day, Year"
4. **Shows anniversary** — if no spouse
5. **Spouse section** — link navigates to spouse modal
6. **Email mailto links** — clickable
7. **Phone tel links** — clickable
8. **Phone shows label** — Home, Cell, etc.
9. **Lineage as text** — raw string displayed
10. **Calendar events** — shows linked events
11. **Close on backdrop click** — closes modal
12. **Close on Escape** — closes modal
13. **Close button** — closes modal

---

## 9. Summary of Changes

**Modified:**
- `src/app/components/people/people.component.ts` — static tree (no expand/collapse), family filter in applyFilter()
- `src/app/components/people/people.component.html` — recursive children-container pattern, click on name opens modal
- `src/app/components/people/people.component.scss` — generation-bar 2px, .person-name styling, hover underline
- `src/app/components/person-detail-modal/person-detail-modal.component.ts` — reads new Person shape, calculates age, spouse navigation
- `src/app/components/person-detail-modal/person-detail-modal.component.html` — sections updated

**Dependencies:**
- `src/app/models/person.ts` — Person with Name, Address, parentIds
- `src/app/services/people.service.ts` — existing service
- `src/app/services/calendar.service.ts` — getEventsByPerson method

**Routing:**
- `/people` (list)
- `/people/:id` (modal)
- Feature flag: 'people'
- URL params: `?family=<clan>`

---

## 10. Open Questions

None.

---

*Spec version: 1.4. People page with static recursive tree, children-container grouping pattern, and click-to-open names.*