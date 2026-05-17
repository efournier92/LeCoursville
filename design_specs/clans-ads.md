# Clan Management Agent Design Spec

**Branch**: `feature/people-from-csv`
**Base directory**: `/Users/e/mnt/bnk/cs/lecoursville`

---

## Context & Motivation

Currently the Person model uses free-text fields for clan assignment: `clan: string`, `colorHue`, and `colorHex` on `src/app/models/person.ts:28-52`. This creates inconsistent data (misspellings, duplicates) and no single source of truth for clan colors. We need a proper clans collection with a foreign key on Person and an admin tool to manage clans CRUD.

Additionally, the AdminPeopleImportComponent must resolve clan names to clanId during CSV import, auto-creating missing clans rather than skipping or failing.

---

## Glossary

- **Clan**: A named group with a hex color. People belong to clans via `clanId`.
- **ClanId**: Foreign key on Person pointing to Clan.id
- **BehaviorSubject**: RxJS pattern used by all services in this codebase for reactive state
- **AngularFireList**: Firebase list query wrapper returning `Observable<T[]>`
- **Auto-created clan**: A clan created during CSV import when the clan name in the CSV does not match any existing clan in the database. Uses default color #808080.

---

## Current State

### Person Model
`src/app/models/person.ts:28-52` — Person interface currently has:
```typescript
clan: string | null;       // line 33 — deprecated, kept for backward compat
clanId: string | null;      // line 32 — foreign key to Clan.id
colorHue: string | null;    // REMOVED (was line 46)
colorHex: string | null;    // REMOVED (was line 47)
```

### Admin Pattern
- Admin components live in `src/app/components/admin-*/`
- Routes at `/admin/*` use `AuthAdminGuardService` (`src/app/services/auth-admin-guard.service.ts:20-30`)
- Admin feature flags component: `src/app/components/admin-features/admin-features.component.ts`
- Admin people import component: `src/app/components/admin-people-import/admin-people-import.component.ts`

### Service Pattern
`src/app/services/people.service.ts:17-27`:
```typescript
private peopleSource: BehaviorSubject<Person[]> = new BehaviorSubject([]);
people$: Observable<Person[]> = this.peopleSource.asObservable();
constructor(private db: AngularFireDatabase) {
  this.getPeople().valueChanges().subscribe((people: Person[]) => {
    this.peopleSource.next(people);
  });
}
```

### Feature Flag Config
`src/app/config/feature-config.ts:8-17` — list of toggleable features. New entry `clans` needed.

---

## Goals

1. New `Clan` model with `id`, `name`, `hexColor`
2. `ClanService` with CRUD methods using BehaviorSubject pattern
3. `AdminClansComponent` at `/admin/clans` supporting add, edit, delete, change name/color
4. Person model updated: `clanId` foreign key added, `clan`/`colorHue`/`colorHex` removed
5. Initial clan data documented in spec for manual entry
6. ClanService integrated into `PeopleComponent` — Filter By Family dropdown populated from clans collection
7. Family tree left borders colored using clan `hexColor` from ClanService lookup (not person.colorHex)
8. Person detail modal header border colored using clan `hexColor` via `ClanService` lookup
9. **AdminPeopleImportComponent updated to resolve clan names to clanId during import**
10. **Auto-create missing clans during import with default color #808080**

---

## Non-Goals

- Bulk reassignment of people to clans (beyond CSV import resolution)
- Migration of existing Person.clan strings to Clan references (they become legacy via clan field)
- Automatic migration of existing Person.clan strings to Clan references

---

## Prerequisites

- Firebase Realtime Database path `clans` must be available
- `AuthAdminGuardService` already in place
- `AngularFireDatabase` already injected in services
- ClanService already implemented

---

## Design Principles

- Mirror existing service patterns exactly (BehaviorSubject + Observable)
- Firebase paths in constants at top of service
- Admin components follow same structure as `AdminFeaturesComponent`
- Use `db.createPushId()` for clan IDs
- Auto-created clans use color #808080
- CSV import resolves clan names case-insensitively

---

## Front End Requirements

### 1. New Model

**File**: `src/app/models/clan.ts` (already created)
```typescript
export interface Clan {
  id: string;
  name: string;
  hexColor: string;  // e.g. '#F44336'
  createdAt: number;
  updatedAt: number;
}
```

### 2. New Service

**File**: `src/app/services/clan.service.ts` (already created)
- Inject `AngularFireDatabase`
- `private readonly CLANS_PATH = 'clans';`
- `private clansSource: BehaviorSubject<Clan[]> = new BehaviorSubject([]);`
- `clans$: Observable<Clan[]> = this.clansSource.asObservable();`
- Constructor subscribes to `db.list(this.CLANS_PATH).valueChanges()`
- Methods:
  - `getClans(): AngularFireList<Clan>` — returns the list reference
  - `getClan(id): Observable<Clan | null>` — single clan by id
  - `saveClan(clan: Clan): Promise<void>` — add new clan
  - `updateClan(id: string, data: Partial<Clan>): Promise<void>` — update name/color
  - `deleteClan(id: string): Promise<void>` — remove clan
  - `createPushId(): string` — generates push ID for new clans

### 3. Model Changes

**File**: `src/app/models/person.ts`
- `clanId: string | null` (added at line 32)
- `clan: string | null` (kept at line 33 for backward compat during transition)
- Removed: `colorHue`, `colorHex`

### 4. Feature Config Update

**File**: `src/app/config/feature-config.ts`
- Add to `FEATURES` array: `{ id: 'clans', label: 'Clans' }` (already added)

### 5. AdminClansComponent

**Files** (already created):
- `src/app/components/admin-clans/admin-clans.component.ts`
- `src/app/components/admin-clans/admin-clans.component.html`
- `src/app/components/admin-clans/admin-clans.component.scss`

**Component class** (`admin-clans.component.ts`):
- Inject `ClanService`
- `clans$` subscribed in `ngOnInit`
- Properties: `clans: Clan[]`, `editingClan: Clan | null`, `isAdding = false`
- Methods: `onAdd()`, `onEdit(clan)`, `onDelete(id)`, `onSave(formData)`, `onCancel()`
- Form fields: `name` (text input, required), `hexColor` (color picker input, required)
- Validation: name required, hexColor must match `^#[0-9A-Fa-f]{6}$`

### 6. Routing

**File**: `src/app/app-routing.module.ts`
- Import `AdminClansComponent`
- Add route:
```typescript
{
  path: 'admin/clans',
  component: AdminClansComponent,
  canActivate: [AuthAdminGuardService],
},
```

### 7. AdminPeopleImportComponent — Clan Resolution

**File**: `src/app/components/admin-people-import/admin-people-import.component.ts`

**Changes to parseRow method (lines 158-188):**

The CSV "Clan" column value is resolved to `clanId` via ClanService lookup by name (case-insensitive). The deprecated `clan` string field is set to null during import (since we deprecate the string column entirely).

**Changes to parseRow:**
- Line 169: `clanId: null` becomes `clanId: this.resolveClanId(values, headerMap)`
- Line 170: `clan: this.getNullable(values, headerMap, 'Clan')` becomes `clan: null`

**New method to add to AdminPeopleImportComponent:**
```typescript
private resolveClanId(values: string[], headerMap: Record<string, number>): string | null {
  const clanName = this.getValue(values, headerMap, 'Clan').trim();
  if (!clanName) return null;

  // Case-insensitive lookup in clansByNameMap
  const clan = this.clansByNameMap.get(clanName.toLowerCase());
  if (clan) return clan.id;

  // Auto-create clan with default color #808080
  const newClan: Clan = {
    id: this.clanService.createPushId(),
    name: clanName,
    hexColor: '#808080',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  this.clanService.saveClan(newClan);
  return newClan.id;
}
```

**New properties to add:**
```typescript
private clansByNameMap: Map<string, Clan> = new Map();
```

**New ngOnInit logic:**
```typescript
this.clanService.clans$.subscribe(clans => {
  this.clansByNameMap = new Map(clans.map(c => [c.name.toLowerCase(), c]));
});
```

**Import updates:**
- After `confirmImport()` completes, the auto-created clans are already saved to Firebase via ClanService
- No additional sync step needed

### 8. Clan Usages (Downstream Consumers)

#### 8a. Filter By Family Dropdown (`PeopleComponent`)

**File**: `src/app/components/people/people.component.ts`

Changes to `getFamilies()` (lines 106-125):
- Currently builds family list from `person.clan` strings via `allPeople`
- After ClanService is available, replace with `clanService.clans$` subscription
- Remove hardcoded `AppSettings.families` ordering logic
- Sort clans by `AppSettings.families` order (same ordering as today) then alphabetically for unknown clans

Changes to `onFamilyChange()` (lines 82-96):
- `selectedFamily` still stores clan name string (from query param)
- No change to router navigation — `?family=<clanName>` stays human-readable

Changes to `applyFilter()` (lines 146-193):
- `selectedFamily` is a clan name string
- Build `clansMap` from `clansSource` for O(1) lookup by clan name (case-insensitive)
- When filtering by `selectedFamily`, find clan by name (case-insensitive) from `clansMap`, then match `person.clanId === clan.id`
- Legacy `person.clan` string still supported for backward compat (people with no clanId)
- Lines 165-169: build clan set from `person.clanId` instead of `person.clan`

Template changes (`people.component.html`):
- Line 25: `mat-option` iterates over `clans` (from ClanService) with `[value]="clan.name"` (stores name, not id)
- Line 45: `getFamilyColorForClan(group.clan)` — group.clan changes to clan name string (still used for display lookup)
- Color binding `[style.border-left-color]="getFamilyColorForClan(group.clan)"` — method looks up clan by name to get hexColor

#### 8b. Family Tree Left Border Colors (`PeopleComponent`)

**File**: `src/app/components/people/people.component.ts`

Method `getFamilyColorForClan(clan: string)` (lines 270-276):
- `clan` parameter is clan name string (not clanId)
- Look up clan by name (case-insensitive) from `clansMap`, return `clan.hexColor`
- Default to `'#e0e0e0'` if clan not found

Method `getColorHex(node: PersonNode)` (lines 310-312):
- Currently returns `node.person.colorHex || '#e0e0e0'`
- After change: look up `node.person.clanId` to find clan, return `clan.hexColor || '#e0e0e0'`
- Add `clansMap: Map<string, Clan>` computed from `clansSource` keyed by clan name (lowercase) for O(1) name lookup
- Also build `clansByIdMap: Map<string, Clan>` keyed by clan.id for id-based lookups

Template (`people.component.html` line 77):
- `[style.background-color]="getColorHex(node)"` — no template change needed, method returns clan hexColor

#### 8c. Person Detail Modal Brand Personality (`PersonDetailModalComponent`)

**File**: `src/app/components/person-detail-modal/person-detail-modal.component.ts`

Inject `ClanService`:
- Add `private clansSource: Clan[] = []` property
- In `ngOnInit`, subscribe to `clanService.clans$` to populate `clansSource`

Inject `PeopleService` is already present.

Add `private clansByIdMap: Map<string, Clan>` — populate from clansSource keyed by clan.id.

Add method `getClanForPerson(clanId: string | null): Clan | null`:
- If `clanId` is null, return null
- Find clan in `clansByIdMap` by id, return null if not found

Add method `getClanByName(name: string): Clan | null`:
- Case-insensitive lookup by clan name in `clansSource`

**File**: `src/app/components/person-detail-modal/person-detail-modal.component.html`

Changes:
- Line 3: `person.colorHex` becomes `getClanForPerson(person.clanId)?.hexColor || '#e0e0e0'`
- Lines 27-30: Clan display section — get clan by `getClanByName(person.clan)` (backward compat when person.clan is still a string)
  - Display as: `<span class="value">{{ clan?.name }}</span>`
  - Link filters by clan name: `[queryParams]="{ family: clan?.name }"`

---

## Firebase Requirements

### Database Paths

- **Read/Write**: `clans/{clanId}` — stores Clan objects
- **Read/Write**: `people/{personId}` — stores Person objects (already exists)
- No subcollections needed

### Security Rules

- Update Firebase rules to allow authenticated admin users read/write on `clans`
- Pattern: same as `features` rules

### Auth Context

- Requires `AuthAdminGuardService` (admin role check via `user.roles.admin`)

---

## Initial Clan Data

The following 14 clans should be entered manually via the admin tool OR auto-created during CSV import if not present:

| Name | Color_Hue | Color_Hex |
|------|-----------|-----------|
| Mignonne | Red | #F44336 |
| Denis | Green | #4CAF50 |
| Robert | Blue | #2196F3 |
| Lawrence | Orange | #FB8C00 |
| Roger | Cyan | #26C6DA |
| Leo | Amber | #FFC107 |
| Annette | Deep Purple | #7E57C2 |
| Jacquie | Pink | #EC407A |
| Diane | Indigo | #303F9F |
| Paulette | Deep Orange | #FF7043 |
| Richard | Black | #000000 |
| Dan | Brown | #795548 |
| Michael | Blue Grey | #78909C |
| Uncle Joe | Teal | #009688 |

---

## Production Risks & Mitigations

1. **Breaking change for existing code that reads Person.clan** — Mitigate: Update all references from `person.clan` string to `person.clanId` (FK). Update PeopleComponent and PersonDetailModalComponent to use ClanService lookup.
2. **People with existing clan values have no clanId** — Mitigate: Those people will have `clanId: null` but `clan` string preserved. applyFilter() handles both via legacy clan string lookup.
3. **Color picker input not supported in all browsers** — Mitigate: Use text input with hex validation as fallback.
4. **URL query param `?family=<clanName>` uses clan name string** — This is intentional for human-readability. `applyFilter` does case-insensitive name lookup to get `clanId`, then matches `person.clanId === clan.id`. Backward compatible with existing URL format.
5. **AppSettings.families hardcodes clan names** — After clans live in Firebase, ordering can still reference `AppSettings.families` as override for sort order, but dropdown values come from ClanService.
6. **CSV import creates clan with default color #808080 if clan name not found** — Mitigate: Admin can edit clan color in AdminClansComponent after import if needed.

---

## Rollout Plan

1. Add Clan model (done)
2. Add ClanService (done)
3. Update Person model - add clanId, keep clan for backward compat (done)
4. Add feature flag entry (done)
5. Create AdminClansComponent (HTML, TS, SCSS) (done)
6. Add route (done)
7. Run app locally, verify admin tool works (in progress - verify now)
8. Enter the 14 initial clans manually via admin tool
9. Update AdminPeopleImportComponent to resolve clan names to clanId
10. Deploy and verify

---

## Test Plan

### ClanService (`src/app/services/clan.service.spec.ts`)

Create `src/app/services/clan.service.spec.ts`:

1. **getClans()** — verify returns AngularFireList
2. **getClan(id)** — verify returns Observable of Clan | null
3. **saveClan()** — verify db.object().set() called with correct path and data including createdAt/updatedAt timestamps
4. **updateClan()** — verify db.object().update() called with partial data
5. **deleteClan()** — verify db.object().remove() called
6. **createPushId()** — verify returns a string
7. **BehaviorSubject emission** — after saveClan resolves, verify clansSource emits updated array

### AdminClansComponent (`src/app/components/admin-clans/admin-clans.component.spec.ts`)

Create `src/app/components/admin-clans/admin-clans.component.spec.ts`:

1. **Initial load** — onInit subscribes to clans$ and populates clans array
2. **Add clan** — clicking add button shows form; onSave calls clanService.saveClan() with form data; on success, form closes and list refreshes
3. **Edit clan** — clicking edit populates form with existing name/color; onSave calls updateClan()
4. **Delete clan** — clicking delete calls clanService.deleteClan(); on success, list refreshes
5. **Validation** — empty name shows error; invalid hexColor shows error
6. **Cancel** — clicking cancel clears editing state and hides form

### AdminPeopleImportComponent — Clan Resolution (`src/app/components/admin-people-import/admin-people-import.component.spec.ts`)

Update existing spec file with new test cases:

1. **ClanService injected** — verify ClanService is injected in constructor
2. **ClansByNameMap populated** — verify ngOnInit subscribes to clanService.clans$ and populates clansByNameMap
3. **Clan name resolved to clanId** — when CSV "Clan" column matches existing clan (case-insensitive), parseRow sets person.clanId to that clan's id and person.clan to null
4. **Unknown clan auto-created** — when CSV "Clan" column does not match any existing clan, parseRow auto-creates clan with name from CSV and color #808080; clanService.saveClan() is called
5. **Empty clan column** — when CSV "Clan" column is empty, parseRow sets person.clanId to null and person.clan to null
6. **Multiple auto-created clans deduplicated** — if multiple CSV rows have the same unknown clan name, only one clan is auto-created (not one per row)

### Integration

1. **Route guard** — navigating to `/admin/clans` without admin role redirects to sign-in
2. **Firebase persistence** — after saveClan(), data appears in Firebase Realtime Database under `clans/`
3. **CSV import persists clanId** — after CSV import with clan column, person.clanId field is populated in Firebase

### PeopleComponent (`src/app/components/people/people.component.spec.ts`)

Update existing spec file with new test cases:

1. **Filter dropdown uses ClanService** — verify clans$ subscription populates dropdown options with clan.name as value
2. **Family tree border color from clan** — verify `getFamilyColorForClan(clanName)` does case-insensitive lookup and returns clan.hexColor from clansByNameMap
3. **Node color from clan** — verify `getColorHex(node)` returns `clansByIdMap.get(node.person.clanId)?.hexColor || '#e0e0e0'`
4. **applyFilter uses clanId with case-insensitive name lookup** — verify filtering by selectedFamily (clan name string) does case-insensitive match to find clanId, then matches person.clanId
5. **getFamilies returns clan names sorted** — verify clan list comes from ClanService not AppSettings hardcode
6. **Clan not found fallback** — when clan name not in clansMap, getFamilyColorForClan returns '#e0e0e0'
7. **Legacy clan string backward compat** — people with clanId=null but clan string still appear in family groups

### PersonDetailModalComponent (`src/app/components/person-detail-modal/person-detail-modal.component.spec.ts`)

Update existing spec file with new test cases:

1. **Modal header color from clan** — verify `[style.border-left-color]` uses `getClanForPerson(person.clanId)?.hexColor`
2. **Clan display uses clan.name** — verify clan section displays `getClanForPerson(person.clanId)?.name`
3. **Clan not found graceful fallback** — verify when clanId is null or clan not found, falls back to '#e0e0e0' and null clan name

---

## Summary of Changes

### New Files
- `src/app/models/clan.ts` — Clan interface with id, name, hexColor, createdAt, updatedAt (done)
- `src/app/services/clan.service.ts` — ClanService with BehaviorSubject, getClans, getClan, saveClan, updateClan, deleteClan, createPushId methods (done)
- `src/app/components/admin-clans/admin-clans.component.ts` — AdminClansComponent with add/edit/delete (done)
- `src/app/components/admin-clans/admin-clans.component.html` — template with table, form, buttons (done)
- `src/app/components/admin-clans/admin-clans.component.scss` — styles (done)

### Modified Files
- `src/app/models/person.ts` — add `clanId`, keep `clan` for backward compat, remove `colorHue`, `colorHex` (done)
- `src/app/config/feature-config.ts` — add `{ id: 'clans', label: 'Clans' }` to FEATURES (done)
- `src/app/app-routing.module.ts` — add `/admin/clans` route importing AdminClansComponent (done)
- `src/app/components/people/people.component.ts` — inject ClanService, update getFamilies() to use clans$, update applyFilter() to use clanId, update getFamilyColorForClan() to look up clan.hexColor, add clansMap for O(1) lookup, add clansByIdMap for id-based lookup (done)
- `src/app/components/people/people.component.html` — update mat-select option values to use clan.name, color binding unchanged (done)
- `src/app/components/person-detail-modal/person-detail-modal.component.ts` — inject ClanService, subscribe to clans$, add getClanForPerson() method, add getClanByName() method, add clansByIdMap and clansByNameMap (done)
- `src/app/components/person-detail-modal/person-detail-modal.component.html` — update color binding to use getClanForPerson(), update clan display to use clan.name (done)
- `src/app/components/admin-people-import/admin-people-import.component.ts` — inject ClanService, add clansByNameMap property, add ngOnInit subscription to clanService.clans$, add resolveClanId() method, modify parseRow() to use resolveClanId() for clanId resolution and set clan to null, auto-create missing clans with color #808080

### Seed Data (manual entry or auto-created via import)
- 14 clans listed in Initial Clan Data section

---

## Verification

### Local
```
ng serve
# Admin tool
# Navigate to http://localhost:4200/admin/clans
# Sign in as admin
# Test: add clan, edit clan name/color, delete clan
# Verify data persists after page refresh

# Clan usages
# Navigate to http://localhost:4200/people
# Verify Filter By Family dropdown shows clan names from ClanService
# Verify family tree headers have left border colored by clan hexColor
# Click a person to open modal, verify modal header border uses clan hexColor
# Filter by family from dropdown, verify tree filters correctly

# CSV Import with Clan column
# Navigate to http://localhost:4200/admin/people-import
# Prepare CSV with 'Clan' column containing clan names
# If clan name exists in DB, person.clanId should be populated
# If clan name does not exist, clan should be auto-created with #808080 color
```

### Staging/Production
- Deploy to Firebase Hosting
- Sign in as admin
- Verify `/admin/clans` route accessible
- Verify CRUD operations persist
- Navigate to `/people` and verify clan colors display correctly in tree and modal
- Upload CSV with clan names and verify clanId is resolved

---

## Open Questions

None.