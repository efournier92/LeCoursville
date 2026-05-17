# Agent Design Spec: Admin People CSV Import

## 1. Branch & Directories

- **Frontend Repository**: `/Users/e/mnt/bnk/cs/lecoursville` (Angular 15, TypeScript)
- **Firebase Backend**: Realtime Database
- **Spec File**: `/Users/e/mnt/bnk/cs/lecoursville/design_specs/admin-people-import-ads.md`

---

## 2. Context & Motivation

The admin needs to import people data from a CSV (Google Sheet export) into Firebase. The CSV has granular name and address columns that map to structured types on the Person record. The import must handle validation, spouse resolution, and re-imports (soft delete for removed rows).

This spec covers the admin-only CSV import UI and processing logic.

---

## 3. CSV Column Mapping

| CSV Column | Person Field |
|------------|--------------|
| ID | id |
| Name_Full | name.full |
| Name_First_Formal | name.firstFormal |
| Name_First_Preferred | name.preferred (also nickname) |
| Name_Maiden | name.maiden |
| Name_Last | name.last |
| Name_Suffix | name.suffix |
| Clan | clan (deprecated, use clanId via ClanService) |
| Birthday | birthday (PersonDate: year/month/day) |
| Spouse | spouse (string name, not resolved to ID in the Person field) |
| Anniversary | anniversary (PersonDate, nullable) |
| Email | emails[0].address |
| Phone_Home | phones[{ label: 'Home', number: ... }] |
| Phone_Cell | phones[{ label: 'Cell', number: ... }] |
| Address_Full | address.full |
| Address_Street | address.street |
| Address_City | address.city |
| Address_State | address.state |
| Address_Zip | address.zip |
| Living? | isLiving (TRUE/FALSE maps to boolean) |
| Direct_Descendent? | directDescendent |
| Generation_Number | generationNumber |
| ID | id |
| Lineage_Full | lineage (raw string, for display) |
| Lineage_Short | (not stored) |
| Color_Hex | hexColor (used for clan color during CSV import, auto-creates clan if not found) |

---

## 4. Non-Goals

- End-user facing people display (see `people-page.md`)
- Calendar event linking
- Contacts migration
- Lineage_Full parsing for grandparent detection (ID-based parent detection is sufficient)

---

## 5. AdminPeopleImportComponent

**Location**: `src/app/components/admin-people-import/admin-people-import.component.ts`

**Selector**: `app-admin-people-import`

**Route**: `/admin/people-import` (protected by AuthAdminGuardService)

### 5.1 UI Elements

- File input for CSV upload (accepts `.csv`)
- "Parse" button after file selected
- Preview table showing: ID, Name_Full, Generation_Number, Lineage_Full, Spouse ID
- Validation summary: row count, errors count, warnings count
- "Confirm Import" button (enabled after valid parse)
- "Cancel" button to reset
- Last import timestamp display

### 5.2 Parsing Flow

1. **File selected** → `parseCSV(rawCsv: string)` called
2. **Header validation** — verify expected columns present (warn if missing)
3. **Row-by-row parse** → build Person objects
4. **Relationship resolution** → resolve spouse IDs via ID pattern
5. **Preview available** → show summary, enable Confirm
6. **Confirm** → call `importPeople()` on PeopleService

### 5.3 Validation Rules

| Rule | Error/Warning | Result |
|------|--------------|--------|
| Empty ID column | None (silent skip) | Row excluded |
| Missing Name_Full | Error | Row excluded, error shown |
| Invalid Birthday format | Warning | Uses default {0,1,1} |
| Invalid Anniversary format | Warning | Sets null |
| Invalid Color Hex | Warning | Sets null |
| Invalid Generation_Number | Error | Uses 0 |
| Invalid isLiving | Warning | Sets true |

### 5.4 Spouse Resolution (ID-based Pattern)

- If ID ends with `-S`, spouse is base ID (e.g., A-2-S → A-2)
- Otherwise, spouse is ID + `-S` (e.g., A-2 → A-2-S)
- Bidirectional: when A-2 points to A-2-S, set A-2-S spouseId to A-2

### 5.5 Parent IDs Derivation (ID-based Pattern)

The ID field encodes parent-child relationships. Parse ID to derive parentIds, with special cases for Generation 0 roots and spouses.

**ID Structure**: `<rootID>-<generation>-<sibling>` where:
- `-S` suffix = spouse entry
- No `-S` = the person's own ID
- Each `-` delimiter adds one generation level

**Special Cases**:

1. **Generation 0 roots (0-0, 0-1, etc.)**: `parentIds: []` — These are the founding ancestors with no parents in the dataset.

2. **Spouses (ID ending in -S)**: `parentIds: []` — Spouses of any generation do not get parentIds since their parent lineage is not represented in the dataset. Example: A-S (Bob LeBlanc), A-1-S (Emily Hague).

3. **Generation 1 direct members (A, B, etc.)**: `parentIds: ['0-0', '0-1']` — The first generation below the roots have the Generation 0 roots as parents. This rule applies to single-segment IDs (no `-` after the root letter) with generationNumber === 1.

4. **Standard derivation (children of Generation 1+)**: For IDs with more than one segment (e.g., A-1, A-1-1, A-2, etc.), compute parents from the ID segments.

**Algorithm**:
1. If `generationNumber === 0`: set `parentIds = []`
2. If `id.endsWith('-S')`: set `parentIds = []`
3. If `generationNumber === 1` and id matches pattern `/^[A-Z]$/`: set `parentIds = ['0-0', '0-1']`
4. Otherwise, derive from immediate parent only:
   - Remove the last segment of the ID to get the immediate parent
   - If `parentId + '-S'` exists in the dataset, add it as second parent
   - Result is 1 or 2 parentIds (never grandparents)

**Examples**:
```
0-0         → parentIds: [] (Generation 0 root)
0-1         → parentIds: [] (Generation 0 root)
A           → parentIds: ['0-0', '0-1'] (Generation 1 direct member)
A-S         → parentIds: [] (spouse)
A-1         → parentIds: ['A', 'A-S'] if A-S exists, otherwise ['A']
A-1-S       → parentIds: [] (spouse)
A-1-1       → parentIds: ['A-1', 'A-1-S'] if A-1-S exists, otherwise ['A-1']
```

### 5.6 Import Logic

- **New IDs** (not in Firebase) → `set()` to `/people/{id}`
- **Existing IDs** → `update()` (merge)
- **IDs in Firebase but not in CSV** → set `isActive: false` (soft delete)
- Returns `ImportResult`: { created, updated, inactive, conflicts }

---

## 6. Model Interfaces

### Person (for import)

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
  addressId: string | null;  // deprecated
  directDescendent: boolean;
  generationNumber: number;
  parentIds: string[];       // derived from ID pattern at import time
  lineage: string | null;     // Lineage_Full for display
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

## 7. Component API

### Properties

```typescript
parsedPeople: ParsedPerson[] = [];
validationErrors: string[] = [];
validationWarnings: string[] = [];
importPreview: { total: number; created: number; updated: number; inactive: number } | null = null;
lastImportTimestamp: string | null = null;
isImporting = false;
selectedFileName: string | null = null;
```

### Methods

```typescript
parseCSV(rawCsv: string): void
confirmImport(): void
onFileSelected(event: Event): void
```

---

## 8. Test Cases

1. **parseCSV: Basic parse** — v1.csv parses to 11 Person objects
2. **parseCSV: Name structure** — name.full, name.firstFormal, name.preferred, name.last set correctly
3. **parseCSV: Address structure** — address.street, city, state, zip set correctly
4. **parseCSV: Birthday parsing** — '1992-02-13' → { year: 1992, month: 2, day: 13 }
5. **parseCSV: isLiving TRUE/FALSE** — maps to boolean
6. **parseCSV: Spouse ID resolution** — A-2 ↔ A-2-S, A-1 ↔ A-1-S, etc.
7. **parseCSV: No spouse** — IDs without -S suffix have spouseId: null
8. **parseCSV: Parent IDs derivation - root** — A-2 has parentIds: []
9. **parseCSV: Parent IDs derivation - spouse of root** — A-2-S has parentIds: ['A-2']
10. **parseCSV: Parent IDs derivation - child** — A-2-1 has parentIds: ['A-2', 'A-2-S']
11. **parseCSV: Parent IDs derivation - spouse of child** — A-2-1-S has parentIds: ['A-2-1']
12. **parseCSV: Parent IDs derivation - grandchild** — A-2-1-1 has parentIds: ['A-2-1', 'A-2-1-S']
13. **parseCSV: Missing name** — error, row excluded
14. **parseCSV: Invalid Color Hex** — warning, value set to null
15. **parseCSV: Empty ID** — silent skip, no error
16. **parseCSV: Phone with labels** — Home from Phone_Home, Cell from Phone_Cell
17. **parseCSV: Lineage as raw string** — stored as-is (for display)
18. **parseCSV: Generation integer** — not string
19. **parseCSV: Direct_Descendent boolean** — TRUE → true
20. **Error row doesn't block others** — 10 valid + 1 error → 10 parsed
21. **Import preview** — shows totals
22. **confirmImport calls PeopleService** — service method called with parsed array

---

## 9. Summary of Changes

**Modified:**
- `src/app/components/admin-people-import/admin-people-import.component.ts` — CSV parser updated for new column headers, parses to Name/Address types, handles isLiving
- `src/app/components/admin-people-import/admin-people-import.component.html` — preview columns updated
- `src/app/models/person.ts` — Person, Name, Address, Email types added/updated

**New:**
- `src/app/components/admin-people-import/admin-people-import.component.spec.ts` — 17 test cases

---

## 10. Open Questions

None.

---

*Spec version: 1.1. Admin CSV import with ID-based parent derivation (parentIds from ID pattern).*