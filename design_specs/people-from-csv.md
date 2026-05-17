# Agent Design Spec: People Feature and Calendar/Contacts Migration

> **Note**: This spec is now split into focused specifications:
> - `admin-people-import.md` — Admin CSV import UI and processing
> - `people-page.md` — User-facing People page and Person detail modal
>
> This document provides high-level context. For implementation, see the focused specs.

## 1. Branch & Directories

- **Frontend Repository**: `/Users/e/mnt/bnk/cs/lecoursville` (Angular 15, TypeScript)
- **Firebase Backend**: Realtime Database (no separate repo)
- **Spec File**: `/Users/e/mnt/bnk/cs/lecoursville/design_specs/people-from-csv.md` (context document)

---

## 2. Context & Motivation

Calendar events and contacts both represent people, but there is no binding between them. A calendar event with title "John Smith" and a contact named "John Smith" are completely disconnected data.

The CSV (Google Sheet) contains a complete, authoritative list of people with all fields needed to seed the new `person` data type. The CSV has been updated with granular name and address columns for easier parsing.

This ADS covers three phases:
1. **Phase A**: Build the People feature (new person DB type, PeopleService, PeopleComponent, person detail modal, admin CSV import UI, link calendar events to people).
2. **Phase B**: Migrate the contacts feature to read from people.
3. **Phase C**: Migration plan for existing contact address data.

---

## 3. Glossary

| Term | Definition |
|------|------------|
| **person** | A record in `/people/{id}` representing a family member. Contains all person data from CSV (name fields, birthday, spouse, generation, lineage, etc.). |
| **Name** | Complex type on Person with granular name components: firstFormal, firstPreferred, maiden, last, suffix, plus nickname (preferred name). |
| **Address** | Complex type on Person with street, city, state, zip, label fields. Embeds directly on the Person record (not a separate collection). |
| **PeopleService** | Service that reads/writes `/people` Firebase path. |
| **PeopleComponent** | Component at `/people` route. Shows a table of all people, grouped by family, sorted oldest to youngest (generation number asc). Clicking a row opens the person detail modal. |
| **PersonDetailModalComponent** | Modal overlay showing full person details. Triggered by clicking a row in PeopleComponent. |
| **People page** | The `/people` route displaying the people table with family grouping and filtering. |
| **Person card** | The modal that shows full person details. |
| **Contact** (legacy) | Existing Contact model. Contacts in Firebase `/contacts` are the legacy representation of people. Phase B migrates this to people. |
| **RecurringEvent** | Calendar event record in `/calendarEvents/{id}`. Existing records have no personId. New records have personId: string. Birth events and anniversary events link to a person. |
| **AppSettings.families** | Family ordering defined in `src/environments/app-settings.ts`. Used to sort families in the People page. |

---

## 4. Current State

### Firebase paths

```
/people/{id}           -> Person record (Phase A, new path)
  /calendarEvents     -> existing calendar events
  /features            -> feature flags
```

### Existing files

- **Person model**: `src/app/models/person.ts` — existing interface with id, name, nickname, birthday, spouse, spouseId, anniversary, anniversaryId, emails, phones, addressId, directDescendent, generationNumber, parentIds, childIds, descendantIds, taxonomyFull, familyLabel, familyDescriptor, colorHue, colorHex, isActive, createdAt, updatedAt.
- **Address model**: `src/app/models/address.ts` — existing interface with id, street, city, state, zip, info, createdAt, updatedAt. **This model is deprecated — address data is moving directly onto Person.**
- **Anniversary model**: `src/app/models/anniversary.ts` — existing interface with id, date, spouse1Id, spouse2Id, createdAt, updatedAt.
- **AddressesService**: `src/app/services/addresses.service.ts` — **deprecated**, will be removed in Phase C.
- **PeopleService**: `src/app/services/people.service.ts` — existing service using BehaviorSubject pattern.
- **AdminPeopleImportComponent**: `src/app/components/admin-people-import/admin-people-import.component.ts` — existing component with CSV parser. Currently references old CSV column headers (Name, Nickname, Address_Street, Address_Area, Taxonomy_Full, Family_Label, Family_Descriptor). Needs update for new CSV structure.

### Key models

- **RecurringEvent** (`src/app/interfaces/recurring-event.ts`): id, title, date, type (birth/anniversary), isLiving, **personId: string | null** (already added).
- **Contact** (legacy): id, name, addresses[], family, emails[], phones[], isEditable.

---

## 5. Goals

- **Phase A**:
  - New `/people` route with a table view of all people, grouped by family, sorted oldest to youngest.
  - Person detail modal on row click.
  - PeopleService reads/writes `/people/{id}` with full person fields from CSV.
  - Admin CSV import UI component that parses the Google Sheet CSV, maps columns, handles spouse name-to-ID lookup, and writes to `/people/{id}`. Re-uploadable.
  - RecurringEvent has `personId: string | null` field (already exists).
  - PeopleComponent is feature-flag gated.

- **Phase B**:
  - ContactsComponent refactored to use PeopleService. Reads from `/people` instead of `/contacts`.
  - ContactsComponent has different sort/filter rules than PeopleComponent.
  - `/contacts/:id` and `/people/:id` open the same PersonDetailModalComponent.

- **Phase C**:
  - Plan for migrating existing address data from Contact records.

---

## 6. Non-Goals

- Lazy loading is not required.
- User isolation on `/people` path — not in scope. Global collection like contacts and calendarEvents.
- Deleting existing calendar events or contacts — migration is additive.
- Email/SMS notifications — not in scope.
- Mobile-responsive redesign — existing responsive patterns apply.
- Photo/media associations — not in scope.
- Parsing Lineage_Full to populate parentIds/childIds/descendantIds — store raw string only.
- A separate `/addresses` collection — address data embeds directly on Person.
- AddressesService — deprecated.

---

## 7. Prerequisites

- Angular 15 project with AngularFire installed.
- Firebase Realtime Database configured with write access for authenticated users.
- Feature flag system already in place (FeatureFlagsService, feature-config.ts).
- AuthGuard already protecting feature routes.
- RecurringEvent already has `personId: string | null` field.

---

## 8. Design Principles

1. **Mirror existing service patterns**: PeopleService uses `BehaviorSubject` + `Observable` exactly like ContactsService and CalendarService.
2. **Firebase push key from CSV ID**: Use CSV `ID` column as the Firebase push key. Write to `/people/{ID}` directly.
3. **Spouse resolution via ID pattern**: If ID ends with `-S`, spouse is base ID. Otherwise spouse is ID with `-S` appended. Example: I-3 spouse is I-4, I-4 spouse is I-3.
4. **No shared address collection**: Address data embeds directly on Person as an Address object. Married couples share the same address data on both person records (duplicated, not referenced).
5. **Soft delete for re-uploads**: Missing CSV rows on re-upload set `isActive: false` on the person record. No hard deletes.
6. **Strict type parsing**: CSV import validates all typed fields (date, integer, hex). Failures shown as validation warnings, record still saved with best-effort defaults.
7. **Modal with URL**: PersonDetailModalComponent renders on the list page, URL updates to `/people/:id` for shareability. Router history management closes modal on back navigation.
8. **Feature flag gated**: People feature entry in FEATURES array, hidden until enabled.
9. **Lineage stored as raw string**: Lineage_Full is stored as `lineage: string | null`. No parsing to extract parent/child references.
10. **Accept duplicate addresses**: Address data embeds directly on Person as an Address object. Spouses do not share address references. If one spouse's address changes, the other spouse's record retains the old value. No automatic sync. Accept this as a tradeoff of the embedded-address pattern.

---

## 9. CSV Column Mapping

The CSV file has the following columns. Each row maps to a Person record.

| CSV Column | Person Field |
|------------|--------------|
| ID | id |
| Name_Full | name.full (also used as Person.name string) |
| Name_First_Formal | name.firstFormal |
| Name_First_Preferred | name.preferred (also Person.nickname) |
| Name_Maiden | name.maiden |
| Name_Last | name.last |
| Name_Suffix | name.suffix |
| Clan | clan |
| Birthday | birthday (PersonDate: year/month/day) |
| Spouse | spouse (string name, not resolved to ID in the Person field — spouseId is set via ID pattern) |
| Anniversary | anniversary (PersonDate, nullable) |
| Email | emails[0].address |
| Phone_Home | phones[{ label: 'Home', number: ... }] |
| Phone_Cell | phones[{ label: 'Cell', number: ... }] |
| Address_Full | address.full (informational only, not stored) |
| Address_Street | address.street |
| Address_City | address.city |
| Address_State | address.state |
| Address_Zip | address.zip |
| Living? | isLiving (boolean: TRUE/FALSE) |
| Direct_Descendent? | directDescendent (boolean) |
| Generation_Number | generationNumber (integer) |
| Lineage_Full | lineage (string, stored raw, displayed as-is) |
| Lineage_Short | (not stored — Lineage_Full only) |
| Color_Hue | colorHue |
| Color Hex | colorHex (validated as hex) |

**Empty ID column**: If the CSV `ID` column is empty for a row, that row is silently skipped (not imported, no error, no warning). This allows draft rows in the CSV.

---

## 10. UI Patterns & Behaviors

### 10.1 People Page (`/people`)

**URL Parameters:**
- `?family=<family>` - Filter people by family. When absent, shows all families.

**Components:**
- **Search input**: Text filter on person names (searches name.full, name.preferred/nickname)
- **Family dropdown**: Filters by family. Empty selection shows all. When a family is selected, shows X button to clear filter.

**Sorting:**
- Groups sorted by `AppSettings.families` order
- Within group, sorted by `generationNumber` ascending (oldest first)

### 10.2 Person Card (Modal)

**Trigger:** Click a person row in the PeopleComponent table.

**URL:** Opens with `/people/:id` route. URL change triggers modal to open.

**Interactions:**
- Click backdrop to close modal
- Press Escape key to close modal
- Click spouse name to navigate to spouse's person card

**Sections (top to bottom):**

1. **Header**
   - Person name (name.full, black text)
   - Left border colored with `person.colorHex`
   - Close button (X icon)

2. **Basic Information**
   - Birthday (with calculated age in parentheses)
   - Anniversary (only if no spouse)
   - Family (from lineage — first segment before `>` in Lineage_Full)
   - Generation (generationNumber)

3. **Spouse** (own card, only if person has spouse)
   - Name (link to spouse's card)
   - Anniversary

4. **Emails**
   - Each email is a `mailto:` link

5. **Phones**
   - Each phone is a `tel:` link
   - Label displayed before number

6. **Lineage**
   - Plain text from `lineage` field

7. **Events**
   - Calendar events linked to this person

**Link Styling:**
- Blue color (`#1976d2`) by default
- Underline on hover only
- No initial underline or decoration

### 10.3 Person Card Header Styling

- Person name: black, 1.4rem, font-weight 600
- Left border: 6px solid, colored with `person.colorHex` (fallback `#e0e0e0`)
- Background: white
- Padding: 20px 24px 20px 20px

### 10.4 Card Styling

- Background: white
- Border-radius: 8px
- Box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08)
- Border: 1px solid #e8e8e8

### 10.5 Section Headers

- Font: 0.85rem, uppercase, font-weight 600
- Color: #757575
- Letter-spacing: 0.5px

---

## 11. Focused Implementation Specs

This spec has been split into:

| Focused Spec | Covers |
|-------------|--------|
| `admin-people-import.md` | AdminPeopleImportComponent, CSV parsing, validation, import/sync, test cases |
| `people-page.md` | PeopleComponent, PersonDetailModalComponent, user display, test cases |

---

## 12. Front End Requirements (Reference)

For detailed requirements, see the focused specs above. This section provides an overview:

### 12.1 Components

1. **PeopleComponent** — List view with search, family filter, grouped table, click-to-detail
2. **PersonDetailModalComponent** — Modal overlay with full person details, spouse navigation
3. **AdminPeopleImportComponent** — CSV upload, parse, preview, confirm import

### 12.2 Services

1. **PeopleService** — reads/writes `/people`, importPeople(), getPeopleByAnniversary(), getPeopleByAddress()
2. **AnniversariesService** — unchanged
3. **CalendarService** — getEventsByPerson()

### 12.3 Models

1. **Person** — updated with Name, Address, lineage, isLiving
2. **Anniversary** — unchanged

### 12.4 Routing

- `/people` — list (feature-flagged)
- `/people/:id` — modal
- `/admin/people-import` — admin only

### 12.5 Firebase

- `/people/{id}` — Person records (new shape)
- `/anniversaries/{id}` — Anniversary records

---

## 13. Production Risks & Mitigations

### 11.1 New or Modified Components

#### Phase A

1. **PeopleComponent** (`src/app/components/people/people.component.ts`)
   - Selector: `app-people`
   - Template: `people.component.html`
   - Shows a table of all people, grouped by first segment of lineage, sorted by `generationNumber` ascending.
   - Row columns: Name (name.full), Generation, Lineage (rightmost).
   - Group headers show first lineage segment with colored left border (using colorHex). Headers sorted by AppSettings.families order.
   - Clicking a row opens PersonDetailModalComponent and updates URL to `/people/:id`.
   - Filter bar: "Search" input on left, "Filter by Family" dropdown on right.
   - URL query param `family` filters by first lineage segment.
   - Searches across name.full and name.preferred.

2. **PersonDetailModalComponent** (`src/app/components/person-detail-modal/person-detail-modal.component.ts`)
   - Selector: `app-person-detail-modal`
   - Template: `person-detail-modal.component.html`
   - Modal overlay displaying full person details:
     - Header: name.full with family-colored left border
     - Sections: Birthday (with calculated age), Anniversary (if no spouse), Family (from lineage), Generation
     - Spouse section (if has spouse): name (link), Anniversary
     - Emails section: mailto: links
     - Phones section: tel: links
     - Lineage section: plain text from `lineage` field
     - Events section: calendar events
   - Closes on backdrop click, Escape key, or close button.
   - Routing: triggered by route parameter change (`/people/:id`).

3. **AdminPeopleImportComponent** (`src/app/components/admin-people-import/admin-people-import.component.ts`)
   - Selector: `app-admin-people-import`
   - Template: `admin-people-import.component.html`
   - Admin-only (AuthAdminGuardService).
   - File upload field for CSV.
   - Preview table: ID, Name_Full, Generation_Number, Lineage_Full, Spouse ID.
   - Spouse resolution uses ID pattern (e.g., I-3 <-> I-4).
   - Validation summary shown after parse: row count, errors, warnings.
   - "Confirm Import" button writes to Firebase. Re-import shows diff (added, updated, inactive).
   - Shows last import timestamp.
   - **Updated to use new CSV column headers** (Name_Full, Name_First_Formal, Name_First_Preferred, etc.)

#### Phase B

4. **ContactsComponent** refactored (`src/app/components/contacts/contacts.component.ts`)
   - Now uses PeopleService instead of ContactsService.
   - Same table template structure as PeopleComponent but with different sort/filter rules:
     - Default sort: alphabetical by name.full.
     - Filter: show only people with `phones.length > 0` or `emails.length > 0`.
     - Grouping: by first lineage segment.
   - Clicking a row opens PersonDetailModalComponent. URL updates to `/contacts/:id`.
   - "Visit Person" link in modal points to `/people/:id`.

### 11.2 New or Modified Services

1. **PeopleService** (`src/app/services/people.service.ts`) — existing, no structural changes needed
   - Injectable root (providedIn: 'root')
   - BehaviorSubject `peopleSource: BehaviorSubject<Person[]>` initialized to `[]`
   - Observable `people$: Observable<Person[]>` from `peopleSource.asObservable()`
   - Firebase path: `people`
   - Methods: `getPeople()`, `getPerson(id)`, `savePerson(person)`, `updatePerson(id, data)`, `importPeople(people)`, `getPeopleByAnniversary(anniversaryId)`, `getPeopleByAddress(addressId)` (addressId retained on Person for backward compat, but address data now lives directly on Person)

2. **AnniversariesService** (`src/app/services/anniversaries.service.ts`) — unchanged from existing

3. **AddressesService** (`src/app/services/addresses.service.ts`) — **deprecated after Phase A** (no new code, address data embeds on Person)

4. **CalendarService** modified (`src/app/services/calendar.service.ts`)
   - Add `getEventsByPerson(personId: string): Observable<RecurringEvent[]>` method.

### 11.3 Model/Interface Changes

1. **Person model** (`src/app/models/person.ts`) — **MAJOR UPDATE**

   Replace existing Person interface with the following. This is a breaking change.

   ```typescript
   export interface PersonDate {
     year: number;
     month: number;
     day: number;
   }

   export interface Name {
     full: string;         // Name_Full from CSV, used as display name
     firstFormal: string | null;  // Name_First_Formal
     preferred: string | null;    // Name_First_Preferred (also maps to nickname)
     maiden: string | null;       // Name_Maiden
     last: string | null;         // Name_Last
     suffix: string | null;       // Name_Suffix
   }

   export interface Address {
     full: string | null;   // Address_Full (informational, not displayed separately)
     street: string | null;
     city: string | null;
     state: string | null;
     zip: string | null;
     label: string | null;  // optional label (e.g., 'Home', 'Work')
   }

   export interface Email {
     address: string;
     label: string | null;  // type label, e.g., 'Personal' or 'Work'
   }

   export interface Phone {
     label: string;   // 'Home', 'Cell', etc.
     number: string;
   }

   export interface Person {
     id: string;              // CSV ID, used as Firebase push key
     name: Name;              // structured name
     nickname: string | null;  // alias for name.preferred (backward compat)
     clan: string | null;
     birthday: PersonDate;
     spouse: string | null;   // spouse name from CSV (string, not resolved to Person)
     spouseId: string | null;  // resolved via ID pattern during import
     anniversary: PersonDate | null;
     anniversaryId: string | null;
     emails: Email[];
     phones: Phone[];
     address: Address | null; // embedded address (replaces addressId)
     addressId: string | null; // DEPRECATED: retained for backward compat
     directDescendent: boolean;
     generationNumber: number;
     lineage: string | null;   // Lineage_Full, stored as raw string
     colorHue: string | null;
     colorHex: string | null;
     isLiving: boolean;       // from CSV Living? column (TRUE/FALSE)
     isActive: boolean;       // soft delete flag (true = active, false = removed via re-import)
     createdAt: number;
     updatedAt: number;

     // Deferred to Phase B:
     parentIds: string[];
     childIds: string[];
     descendantIds: string[];
   }
   ```

   **Backward compatibility notes**:
   - `person.nickname` is an alias for `person.name.preferred`. When reading existing data where nickname is set but name.preferred is null, prefer name.preferred.
   - `person.addressId` is deprecated but retained. Address data should be read from `person.address` first.
   - Existing person records in Firebase without `name`, `address`, `lineage` fields should still be readable. Code should handle missing fields gracefully.

   **Spouse resolution (ID-based pattern)**:
   - If ID ends with `-S`, the spouse is the base ID (e.g., I-2-S spouse is I-2).
   - Otherwise, the spouse is the ID with `-S` appended (e.g., I-3 spouse is I-3-S).
   - This is more reliable than name matching.

   **Empty ID rows are skipped silently.**

2. **Address model** (`src/app/models/address.ts`) — **DEPRECATED**
   - The Address interface in `address.ts` is no longer used for new person records.
   - Address data now lives directly on Person as an embedded Address type.
   - The file is retained for backward compatibility with any existing `/addresses` Firebase data.

3. **Anniversary model** (`src/app/models/anniversary.ts`) — **UNCHANGED**

4. **RecurringEvent** modified (`src/app/interfaces/recurring-event.ts`)
   - Already has `personId: string | null` field (added in earlier work).
   - No further changes needed.

### 11.4 Routing Changes

1. Add `/people` route in `src/app/app-routing.module.ts`:
   ```typescript
   { path: 'people', component: PeopleComponent, canActivate: [AuthGuardService, FeatureFlagGuardService], data: { featureFlag: 'people' } }
   ```

2. Add `/people/:id` route:
   ```typescript
   { path: 'people/:id', component: PeopleComponent, canActivate: [AuthGuardService, FeatureFlagGuardService], data: { featureFlag: 'people' } }
   ```

3. Add `/contacts/:id` route:
   ```typescript
   { path: 'contacts/:id', component: ContactsComponent, canActivate: [AuthGuardService, FeatureFlagGuardService] }
   ```

4. Add feature flag entry to `src/app/config/feature-config.ts`:
   ```typescript
   { id: 'people', label: 'People', route: '/people', icon: 'people' }
   ```
   (Already present per current state — verify it exists.)

5. Admin import route:
   ```typescript
   { path: 'admin/people-import', component: AdminPeopleImportComponent, canActivate: [AuthAdminGuardService] }
   ```

### 11.5 Template Changes

1. **NavbarLinksComponent** — already reads from `FEATURES` array, no change needed.

2. **admin-calendar.component.html** — add person selector dropdown after line 97 (before closing form). Options populated from `peopleService.people$ | async`. Selected personId stored in `event.personId`.

3. **PeopleComponent template** (`src/app/components/people/people.component.html`)
   - Table with columns: Name (name.full), Generation, Lineage (rightmost)
   - Group headers show first lineage segment with colored left border
   - Filter bar with Search input and Filter by Family dropdown
   - Click handler calls `openPersonDetail(id)` which updates route to `/people/:id`
   - Empty state when no people match

4. **PersonDetailModalComponent template** (`src/app/components/person-detail-modal/person-detail-modal.component.html`)
   - Modal overlay with sections for all person fields
   - Lineage section shows `person.lineage` as "Lineage" (plain text)
   - Close button triggers `close()` which navigates back
   - Backdrop click closes modal
   - Escape key closes modal
   - Does NOT display color swatch

5. **AdminPeopleImportComponent template** (`src/app/components/admin-people-import/admin-people-import.component.html`)
   - File input for CSV upload
   - Preview table: ID, Name_Full, Generation_Number, Lineage_Full, Spouse ID
   - Validation results display (row count, errors, warnings)
   - Confirm/Cancel buttons

### 11.6 Firebase Integration

**New Firebase paths:**

```
/people/{id}           -> Person record (global, all authenticated users)
  /anniversaries/{id} -> Anniversary record (global)
```

**Existing paths unchanged:**
```
/calendarEvents/{id}   -> RecurringEvent with personId field
/contacts/{id}         -> Legacy contacts (Phase B migrates to people)
/features             -> Feature flags
```

**Auth context**: All routes protected by AuthGuardService. No user-specific isolation.

**CSV import**: Admin triggers write to `/people/{id}` via PeopleService. Batch writes use Firebase multi-location update.

### 11.7 RxJS Stream Design

- **PeopleService**: `BehaviorSubject<Person[]>`, `Observable<Person[]>` exposed as `people$`. `getPerson(id)` returns `Observable<Person | null>`.
- **AnniversariesService**: `BehaviorSubject<Anniversary[]>`, `anniversaries$` observable.
- **CalendarService**: `getEventsByPerson(personId)` returns filtered `Observable<RecurringEvent[]>`.
- **Component subscription cleanup**: All components implementing `OnDestroy`, all subscriptions stored and `unsubscribed` in `ngOnDestroy`. Use `async` pipe in templates.

---

## 12. Firebase Requirements

### 12.1 Database Paths

| Path | Type | Description |
|------|------|-------------|
| `/people/{id}` | Object | Person record, key is CSV ID |
| `/anniversaries/{id}` | Object | Shared anniversary, key is push ID |
| `/calendarEvents/{id}` | Object | RecurringEvent with `personId: string \| null` |
| `/addresses/{id}` | Object | **DEPRECATED** — retained for existing data only. New person records do not create address entries here. |

### 12.2 Security Rules

- Add read/write rules for `/people` and `/anniversaries` paths. Match existing `/contacts` rules (authenticated users read/write).
- `/addresses` path rules remain but are not used for new records.

### 12.3 Storage Paths

- No media/files associated with people feature.

### 12.4 Auth Context

- AuthGuardService required on all `/people` routes.
- AuthAdminGuardService required on `/admin/people-import`.
- All authenticated users have equal access (global collection).

---

## 13. Production Risks & Mitigations

1. **CSV import overwrites existing data**: Mitigation: Use Firebase `update()` for existing IDs (merge) and `set()` for new IDs. Soft-deleted records (inactive) are updated rather than deleted. Import is idempotent.

2. **Spouse name collision**: CSV may have multiple people with the same name. Mitigation: Spouse resolution uses ID pattern, not name matching. ID-based pattern is unambiguous.

3. **Backward compatibility with existing person records**: Existing Firebase records have the old Person shape (name as string, addressId, taxonomyFull, etc.). Mitigation: PeopleComponent and PersonDetailModalComponent should handle missing fields gracefully. Null checks on `person.name` (string vs object) and `person.address` (string vs object). A migration script for existing Firebase records to the new schema is deferred to Phase B.

4. **Empty address on existing records**: Existing person records may have `addressId` but no `address` field. UI should check `person.address` first, then fall back to `person.addressId` for display.

5. **Feature flag not enabled by default**: People feature will be invisible until admin enables the flag.

6. **Married couples address drift**: Spouses have duplicate address data on their Person records. If one spouse's address is updated, the other spouse's address becomes stale. Mitigation: Accepted as a tradeoff of the embedded-address pattern. Re-importing the CSV re-syncs addresses if needed.

---

## 14. Rollout Plan

### Phase A
1. Update Person model (add Name, Address types, rename fields).
2. Update AdminPeopleImportComponent CSV parser for new column headers.
3. Seed `/people` collection with CSV data using updated admin import.
4. Update PeopleComponent and PersonDetailModalComponent for new Person shape.
5. Verify `/people` route works with feature flag enabled.
6. Add person selector to admin-calendar form.
7. Run CSV import logic for existing calendar events (matching by name + birthday).
8. Enable feature flag for admin first, then all users.

### Phase B
9. Migrate `/contacts` data to `/people` (copy all records with field mapping, including name string to Name object, addressId to embedded address).
10. Refactor ContactsComponent to use PeopleService with phone/email filter.
11. Add `/contacts/:id` route pointing to ContactsComponent.
12. PersonDetailModalComponent shared between `/people/:id` and `/contacts/:id`.

### Phase C
13. Address migration plan from Contact.addresses to embedded address fields.

---

## 14. Test Plan

The test plan has been split into focused specs:

| Focused Spec | Test Cases |
|-------------|-----------|
| `admin-people-import-ads.md` | 17 test cases for AdminPeopleImportComponent parser |
| `people-page-ads.md` | ~21 test cases for PeopleComponent and PersonDetailModalComponent |

The test utilities at `src/test-utils/firebase-mocks.ts` are shared across all specs.

---

## 15. Summary of Changes

This section defines the test suite for Phase A: PeopleService and AdminPeopleImportComponent. Tests use Jasmine + Karma.

### Test Infrastructure

**`src/test-utils/firebase-mocks.ts`** — shared across all Firebase service specs:

```typescript
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { AngularFireList, AngularFireObject } from '@angular/fire/compat/database';

export function createFakeAngularFireList<T>(initialData: T[] = []): {
  mockList: jasmine.SpyObj<AngularFireList<T>>;
  behaviorSubject: BehaviorSubject<T[]>;
} {
  const behaviorSubject = new BehaviorSubject<T[]>(initialData);
  const mockList = jasmine.createSpyObj('AngularFireList', ['query', 'update', 'set', 'remove']);
  mockList.valueChanges.and.returnValue(behaviorSubject.asObservable());
  return { mockList, behaviorSubject };
}

export function createFakeAngularFireObject<T>(initialData: T | null): {
  mockObject: jasmine.SpyObj<AngularFireObject<T>>;
  behaviorSubject: BehaviorSubject<T | null>;
} {
  const behaviorSubject = new BehaviorSubject<T | null>(initialData);
  const mockObject = jasmine.createSpyObj('AngularFireObject', ['set', 'update', 'remove']);
  mockObject.valueChanges.and.returnValue(behaviorSubject.asObservable());
  return { mockObject, behaviorSubject };
}

export function createFakeAngularFireDatabase(overrides: {
  people?: jasmine.SpyObj<AngularFireList<any>>;
  anniversaries?: jasmine.SpyObj<AngularFireList<any>>;
  calendarEvents?: jasmine.SpyObj<AngularFireList<any>>;
} = {}): jasmine.SpyObj<any> {
  const mockDb = jasmine.createSpyObj('AngularFireDatabase', ['list', 'object', 'createPushId']);
  mockDb.createPushId.and.returnValue('mock-push-id');
  mockDb.list.and.callFake(() => overrides.people || jasmine.createSpyObj('AngularFireList', ['valueChanges']));
  mockDb.object.and.callFake(() => jasmine.createSpyObj('AngularFireObject', ['valueChanges']));
  return mockDb;
}
```

### Test Data

#### v1.csv (new column headers)

```csv
Name_Full,Name_First_Formal,Name_First_Preferred,Name_Maiden,Name_Last,Name_Suffix,Clan,Birthday,Spouse,Anniversary,Email,Phone_Home,Phone_Cell,Address_Full,Address_Street,Address_City,Address_State,Address_Zip,Living?,Direct_Descendent?,Generation_Number,ID,Lineage_Full,Lineage_Short,Color_Hue,Color Hex
Jonathan Smith,Jonathan,Jon,,Smith,,Diane,1992-02-13,,,jsmith@test.com,,802-734-5555,123 Fake Street,123 Fake Street,Philadelphia,PA,19106,TRUE,TRUE,2,I-4,Anselme-Violette > Diane-Emile > Jon,,Indigo,#303F9F
Diane Smith,Diane,,,Smith,,,1970-05-22,Jonathan Smith,1995-06-15,dsmith@test.com,215-555-1234,,456 Oak Avenue,456 Oak Avenue,Arlington,VA,22201,TRUE,TRUE,1,I-3,Anselme-Violette > Diane-Emile,,Teal,#009688
Marie Dubois,Marie,Marie,,DuBois,,DuBois,1965-09-10,Jean-Pierre Dubois,1990-07-20,mdubois@test.com,,555-123-4567,789 Rue Principale,789 Rue Principale,Montreal,QC,H3C 2A8,TRUE,TRUE,1,I-1,Anselme-Violette > Marie,,Blue,#2196F3
Jean-Pierre Dubois,Jean-Pierre,JP,,DuBois,,DuBois,1963-03-15,Marie Dubois,1990-07-20,jpdubois@test.com,514-555-9876,,789 Rue Principale,789 Rue Principale,Montreal,QC,H3C 2A8,TRUE,TRUE,1,I-2,Anselme-Violette > Jean-Pierre,,Blue,#2196F3
Catherine Dubois,Catherine,Cat,,DuBois,,DuBois,1995-12-01,,,cdubois@test.com,,555-111-2222,789 Rue Principale,789 Rue Principale,Montreal,QC,H3C 2A8,TRUE,TRUE,2,I-5,Anselme-Violette > Marie > Catherine,,Blue,#2196F3
Robert Chen,Robert,,,Chen,,,1940-01-30,,,rchen@test.com,,650-555-0001,100 Tech Drive,100 Tech Drive,Palo Alto,CA,94301,TRUE,FALSE,0,I-6,Robert,,Red,#F44336
Alice Chen,Alice,Allie,Chen,Chen,,Chen,1975-08-25,David Chen,2000-09-10,achen@test.com,,650-555-0002,100 Tech Drive,100 Tech Drive,Palo Alto,CA,94301,TRUE,TRUE,1,I-7,Robert > Alice,,Green,#4CAF50
David Chen,David,,,Chen,,,1973-11-12,Alice Chen,2000-09-10,dchen@test.com,650-555-0003,,100 Tech Drive,100 Tech Drive,Palo Alto,CA,94301,TRUE,TRUE,1,I-8,Robert > David,,Green,#4CAF50
Emily Chen,Emily,,,Chen,,,2005-04-18,,,echen@test.com,,650-555-0004,100 Tech Drive,100 Tech Drive,Palo Alto,CA,94301,TRUE,TRUE,2,I-9,Robert > Alice > Emily,,Green,#4CAF50
Thomas Wright,Thomas,,,Wright,,,1988-06-30,,,twright@test.com,,303-555-5555,999 Mountain View,999 Mountain View,Denver,CO,80202,TRUE,TRUE,2,I-10,Wright,,Orange,#FF9800
Sarah Miller,Sarah,,,Miller,,,1990-02-28,,,smiller@test.com,,720-555-6666,777 Colorado Blvd,777 Colorado Blvd,Denver,CO,80202,TRUE,TRUE,2,I-11,Miller,,Purple,#9C27B0
```

### PeopleService (`src/app/services/people.service.spec.ts`)

**Setup:** Use `createFakeAngularFireDatabase` factory from test-utils.

**Test cases:**

1. **getPeople():** Push a person with id 'I-3' into `peopleBehaviorSubject`. Call `service.getPeople()`. Subscribe. Expect Observable emits array containing a Person with id 'I-3'.

2. **getPeople(): Error path:** Make `valueChanges()` return `throwError(() => new Error('Firebase error'))`. Call `service.getPeople()`. Subscribe. Expect Observable throws error with message 'Firebase error'.

3. **getPerson(id):** Push `{ id: 'I-3', name: { full: 'Diane Smith', ... } }` into `peopleBehaviorSubject`. Call `service.getPerson('I-3')`. Expect Observable emits non-null Person with id 'I-3'.

4. **getPerson(id): Not found:** Push empty array into `peopleBehaviorSubject`. Call `service.getPerson('non-existent')`. Expect Observable emits null.

5. **savePerson():** Create a Person object with `id: 'I-15'`. Call `service.savePerson(person)`. Expect `mockDb.object('people/I-15').set(person)` was called.

6. **updatePerson():** Create partial data `{ name: { full: 'Updated Name', ... } }`. Call `service.updatePerson('I-3', partial)`. Expect `mockDb.object('people/I-3').update(...)` was called. Does not call set().

7. **importPeople(): Basic import:** Call `service.importPeople()` with 11 Person objects (v1.csv IDs: I-1 through I-11). No existing records. Expect:
   - For each person with a spouse: spouseId resolved via ID pattern
   - Returns `ImportResult` with `created: 11, updated: 0, inactive: 0`

8. **importPeople(): Re-import soft delete:** Seed `peopleBehaviorSubject` with 11 person records (I-1 through I-11). Call `service.importPeople()` with 9 people (missing I-4, I-11). Expect:
   - I-4 and I-11 are updated with `isActive: false`
   - Returns `ImportResult` with `created: 0, updated: 9, inactive: 2`
   - No records are hard deleted

9. **getPeopleByAnniversary(anniversaryId):** Seed `peopleBehaviorSubject` with people where some share an anniversaryId. Call `service.getPeopleByAnniversary('anniv-3')`. Expect Observable emits only people where `anniversaryId === 'anniv-3'`.

10. **Spouse ID resolution:** Import people array containing I-3 (spouse: 'Jonathan Smith') and I-4 (no spouse). After import, expect I-3.spouseId === 'I-4' and I-4.spouseId === 'I-3' (bidirectional).

### AdminPeopleImportComponent (`src/app/components/admin-people-import/admin-people-import.component.spec.ts`)

**Setup:** Mock PeopleService with `importPeople` returning `of({ created: 11, updated: 0, inactive: 0, conflicts: [] })`.

**Test cases:**

1. **parseCSV: Basic parse with new column headers:** Call `component.parseCSV(v1CsvString)` with the new CSV format. Expect `component.parsedPeople` has 11 entries. Each person object has `name.full`, `name.firstFormal`, `name.preferred`, `address.street`, `address.city`, `address.state`, `address.zip`, `isLiving` correctly set.

2. **parseCSV: Name type structure:** After parse, verify I-3 (Diane Smith) has:
   - `name.full === 'Diane Smith'`
   - `name.firstFormal === 'Diane'`
   - `name.preferred === null` (no preferred name in CSV for Diane)
   - `name.last === 'Smith'`
   - `nickname === null` (preferred not set)

3. **parseCSV: Name with preferred name:** Verify I-4 (Jonathan Smith) has:
   - `name.full === 'Jonathan Smith'`
   - `name.firstFormal === 'Jonathan'`
   - `name.preferred === 'Jon'` (Name_First_Preferred)
   - `nickname === 'Jon'`

4. **parseCSV: Address type structure:** Verify I-4 (Jonathan Smith) has:
   - `address.street === '123 Fake Street'`
   - `address.city === 'Philadelphia'`
   - `address.state === 'PA'`
   - `address.zip === '19106'`

5. **parseCSV: Address with label field:** No explicit label in CSV, expect `address.label === null`.

6. **parseCSV: Birthday parsing:** Pass `Birthday: '1992-02-13'` for a row. Expect `person.birthday` is `{ year: 1992, month: 2, day: 13 }`. Not a string.

7. **parseCSV: isLiving boolean:** Pass `Living?: 'TRUE'` for a row. Expect `person.isLiving === true`. Pass `'FALSE'`. Expect `person.isLiving === false`.

8. **parseCSV: Spouse ID resolution via ID pattern:** Feed v1.csv. After resolve phase, expect I-3.spouseId === 'I-4' (Jonathan Smith), I-1.spouseId === 'I-2' (Jean-Pierre Dubois), I-7.spouseId === 'I-8' (David Chen).

9. **parseCSV: No spouse for I-4, I-6, I-10, I-11:** These have no Spouse column. Expect `spouseId === null`.

10. **parseCSV: Missing name produces validation error:** Pass a CSV row where Name_Full is empty. Expect `validationErrors` includes an error. Row excluded from `parsedPeople`.

11. **parseCSV: Color Hex validation:** Pass invalid `'not-a-hex'` for Color Hex. Expect `validationWarnings` includes a warning.

12. **parseCSV: Empty ID column skips row silently:** Pass a CSV where one row has empty ID. Expect that row not in `parsedPeople`, no error or warning generated, subsequent rows still processed.

13. **parseCSV: Phone array with labels:** Verify I-4 has `phones === [{ label: 'Home', number: '802-734-5555' }]`. Verify I-3 has `phones === [{ label: 'Home', number: '215-555-1234' }]`. Verify I-7 has `phones === [{ label: 'Cell', number: '650-555-0002' }]`.

14. **parseCSV: Lineage stored as raw string:** Verify I-4.lineage === 'Anselme-Violette > Diane-Emile > Jon'. Verify I-6.lineage === 'Robert'. Verify I-9.lineage === 'Robert > Alice > Emily'.

15. **parseCSV: Generation number as integer:** Verify I-4.generationNumber === 2 (number, not string). Verify I-6.generationNumber === 0.

16. **parseCSV: Direct_Descendent boolean:** Verify I-4.directDescendent === true, I-6.directDescendent === false.

17. **parseCSV: Error row does not block others:** Pass CSV with one malformed row mixed among 10 valid rows. Expect 10 valid rows in `parsedPeople`, 1 error in `validationErrors`, no crash.

18. **parseCSV: Email with label field:** Verify I-3 has `emails === [{ address: 'dsmith@test.com', label: null }]`.

19. **Import preview:** After `parseCSV()` with v1.csv, `component.importPreview` shows `{ total: 11, created: 11, updated: 0, inactive: 0 }`.

20. **Confirm import calls PeopleService:** After parse, call `component.confirmImport()`. Expect `mockPeopleService.importPeople()` was called with the parsed people array.

---

## 16. Summary of Changes

### Components

- **MODIFIED**: `src/app/components/people/people.component.ts` — reads `person.name.full` and `person.lineage` instead of `person.name` (string) and `person.taxonomyFull`
- **MODIFIED**: `src/app/components/people/people.component.html` — no structural changes, bindings updated for new Person shape
- **MODIFIED**: `src/app/components/person-detail-modal/person-detail-modal.component.ts` — no structural changes, bindings updated for new Person shape
- **MODIFIED**: `src/app/components/person-detail-modal/person-detail-modal.component.html` — uses `person.lineage` for Lineage section
- **MODIFIED**: `src/app/components/admin-people-import/admin-people-import.component.ts` — CSV parser updated for new column headers (Name_Full, Name_First_Formal, etc.), parses into new Name/Address types, sets isLiving from Living? column, stores Lineage_Full as lineage string
- **MODIFIED**: `src/app/components/admin-people-import/admin-people-import.component.html` — preview columns updated to match new CSV headers

### Services

- **MODIFIED**: `src/app/services/people.service.ts` — no structural changes needed (already uses correct patterns)
- **DEPRECATED**: `src/app/services/addresses.service.ts` — no new code, address data embeds on Person

### Models

- **REPLACE**: `src/app/models/person.ts` — Person interface replaced with new structure (Name type, Address type, lineage field, isLiving field, deprecated addressId). Breaking change.
- **DEPRECATED**: `src/app/models/address.ts` — retained for backward compat with existing /addresses Firebase data
- **UNCHANGED**: `src/app/models/anniversary.ts`

### Routing

- **UNCHANGED**: Routes already added in earlier work. Verify they exist and are correct.

### Firebase

- **NEW**: `/people/{id}` path — Person records with new shape
- **UNCHANGED**: `/anniversaries/{id}` — Anniversary records
- **UNCHANGED**: `/calendarEvents/{id}` — RecurringEvent with personId
- **DEPRECATED**: `/addresses/{id}` — no new records created here

### Other

- **NEW**: `src/test-utils/firebase-mocks.ts` — shared test utilities for Firebase mocking
- **NEW**: `src/app/services/people.service.spec.ts` — 10 test cases
- **NEW**: `src/app/components/admin-people-import/admin-people-import.component.spec.ts` — 20 test cases

---

## 17. Verification

- **Local dev**: `ng serve` and navigate to `/people` (after enabling feature flag). Upload CSV via `/admin/people-import`. Click a row to open person modal. Check name, address, lineage, phones, emails all display correctly.
- **Phone/Email display**: Verify phone labels show correctly, emails have mailto: links.
- **Spouse navigation**: Click a person with spouse, click spouse name in modal, verify navigation to spouse.
- **CSV re-import**: Upload v1.csv, then upload v2.csv (with some rows missing). Verify missing rows are marked inactive (isActive: false).
- **isLiving display**: In person detail modal, verify isLiving status is shown (Living indicator).
- **Staging**: Deploy to Firebase hosting staging. Test full flow with real Firebase data.
- **Post-deploy**: Confirm no console errors, Firebase rules allow reads/writes on `/people`.

---

## 18. Open Questions

None. All questions resolved in review rounds.

---

*Spec version: 1.8. This spec is now a context document. Implementation is split into focused specs: admin-people-import-ads.md (v1.0) and people-page-ads.md (v1.0).*