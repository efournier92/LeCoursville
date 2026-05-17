# Contacts from People — Agent Design Spec

## Branch & Directories

- **Branch:** `contacts-from-people`
- **Base directory:** `/Users/e/mnt/bnk/cs/lecoursville`
- **Design spec:** `/Users/e/mnt/bnk/cs/lecoursville/design_specs/contacts-from-people-ads.md`

---

## Context & Motivation

The `/contacts` component currently reads from a standalone `Contact` model that duplicates information now available on the `Person` model. The `Person` interface already contains `addressId`, `emails`, and `phones` — the same three pillars of contact info that the legacy `Contact` model carries separately.

Migrating contacts to derive from `Person` unifies the data model and eliminates drift between two sources of truth. The `/contacts` component also needs a visual facelift to feel more professional and modern.

---

## Glossary

- **Contact card** — A UI card representing a person's contact information in the `/contacts` component.
- **Spouse sharing** — When two people are married (`spouseId` is set on both), all contact fields are merged and shown for both people as identical entries.
- **Spouse display** — Spouses are displayed on the same line as the primary person, separated by ` & ` (e.g., "John & Jane Doe"). No "Married to" subheader.
- **Generation sort** — Contacts are ordered by `generationNumber` ascending (generation 1 first), then by `person.id` as a tiebreaker. Spouse records (`-S` suffix) are excluded from the top-level list but included in merged display.
- **Clan color accent** — The clan `hexColor` is used as a left-border accent on contact cards, providing a splash of color tied to the person's clan affiliation.
- **Clickable names** — Person and spouse names in the card title are clickable links that open the `PersonDetailModal`. Names show underline on hover.
- **Deceased filtering** — People with `isLiving === false` are excluded from appearing as primary entries on the contacts list. If a person's spouse is deceased, the deceased spouse is not displayed in the card title (even though they are linked via `spouseId`), but their contact info (emails, phones, address) is still merged into the card. This ensures living people with living spouses appear with both names, while living people whose spouse has died appear alone but retain any shared contact information from the deceased spouse.
- **Contact info required** — People with no contact info (no emails, no phones, no `addressId`) are excluded from the contacts list. The `addressId` field on Person is the mailing address reference used to display addresses on contact cards.
- **Query params** — The `/contacts` page supports `?filter=` and `?clan=` query params for shareable filtered views. The `?selected=` param opens the `PersonDetailModal`.

---

## Current State

### Contact component structure

`src/app/components/contacts/` contains:
- `contacts.component.ts` — top-level component, loads and displays contacts list
- `contact-view/contact-view.component.ts` — read-only contact display
- `contact-edit/contact-edit.component.ts` — editable contact form

### Current data source

`src/app/services/contact.service.ts` (lines 12-17):
```typescript
getContactView(): Observable<ContactView> {
  return combineLatest([
    this.db.object('contacts').valueChanges(),
    this.personsService.getPersons(),
    this.db.list('clans').valueChanges()
  ]).pipe(...)
```

Currently reads from `contacts` Firebase path, not from `Person` model.

### Person model with contact fields

`src/app/models/person.ts` (lines 27-44):
```typescript
export interface Person {
  id: string;
  name: Name;
  clanId: string | null;
  birthday: PersonDate;
  spouseId: string | null;
  generationNumber: number;
  addressId: string | null;
  emails: Email[];
  phones: Phone[];
}
```

### Spouse resolution patterns

Two patterns exist in the codebase:
1. Direct `person.spouseId` field
2. ID suffix convention (`-S`) for spouse ID derivation

See `people.service.ts` lines 146-147 for `-S` suffix pattern:
```typescript
const spouseId = person.id + '-S';
const spouse = allPeople.find(p => p.id === spouseId) || null;
```

### Generation sort pattern

`people.component.ts` lines 378-383:
```typescript
children.sort((a, b) => {
  if (a.person.generationNumber !== b.person.generationNumber) {
    return a.person.generationNumber - b.person.generationNumber;
  }
  return a.person.id.localeCompare(b.person.id);
});
```

### Clan color usage pattern

`person-detail-modal.component.html` line 4:
```html
<div class="clan-color-bar" [style.background-color]="clan?.hexColor"></div>
```

Clan `hexColor` is a string field on the `Clan` interface (`clan.ts` line 4).

---

## Goals

1. `/contacts` component derives all contact info from the `Person` model, not from a separate `Contact` model.
2. Married couples (via `spouseId`) share contact information — when either spouse has an email/phone/address, it appears on both cards.
3. Spouses are displayed on the same line, separated by ` & ` (e.g., "John & Jane Doe").
4. Person and spouse names in the card title are clickable links that open `PersonDetailModal`. Names show underline on hover.
5. Contact cards display with clan `hexColor` as a left-border accent.
6. Contacts are sorted by `generationNumber` ascending (gen 1 first), then by `person.id`.
7. Visual facelift: modern card layout, professional and sleek appearance.
8. People with `isLiving === false` are filtered out and not displayed.
9. People with no contact info (no emails, no phones, no `addressId`) are filtered out and not displayed.
10. Filter and clan inputs allow URL query param-based filtering for shareable links.
11. Legacy `Contact` model and Firebase path are preserved as-is (no migration or deprecation).

---

## Non-Goals

- No migration of existing Contact Firebase data to Person.
- No writes to the contacts Firebase path from this feature — contact info is read-only from Person.
- No changes to the Person model structure.
- No deletion of the legacy Contact model.

---

## Prerequisites

- `Person` model with `addressId`, `emails`, `phones`, `spouseId`, `generationNumber`, and `clanId` fields is already in place.
- `Clan` model with `hexColor` field is already in place.
- `PeopleService` and `ClansService` exist and are injectable.

---

## Design Principles

1. Use `BehaviorSubject` + `Observable` pattern for reactive state, mirroring existing services.
2. Person data is the single source of truth for contact reads.
3. Spouse resolution uses the direct `person.spouseId` field when available, falling back to `-S` suffix convention for backward compat with existing data.
4. Contact merge is additive — if either spouse has a field, it appears for both. No override/priority logic.
5. Cards use `[style.border-left-color]="clan?.hexColor"` with a 4px wide left border.
6. All template bindings use async pipe for Observable streams.
7. Components implement `OnDestroy` for subscription cleanup.

---

## Front End Requirements

### 1. New service: ContactsFromPeopleService

**File:** `src/app/services/contacts-from-people.service.ts`

Replaces `ContactService` for reading contact data. Uses `PeopleService` and `ClansService` as dependencies.

```typescript
// Methods to implement
getContacts(): Observable<ContactCard[]>   // returns list sorted by generation then id
getSpouseContacts(personId: string): Observable<ContactCard[]>  // merged spouse contacts
```

`ContactCard` interface:
```typescript
interface ContactCard {
  person: Person;
  spouse: Person | null;
  clan: Clan | null;
  addresses: Address[];       // derived from addressId on person (and spouse's addressId if sharing)
  emails: Email[];
  phones: Phone[];
}
```

Sorting: `generationNumber` ascending, then `person.id` as tiebreaker. Exclude `-S` suffix records from top-level list but include them in spouse merging.

### 2. New component: ContactCardComponent

**File:** `src/app/components/contacts/contact-card/contact-card.component.ts`

Display a single contact card with:
- Left border accent using `clan.hexColor`
- Person name (primary), spouse name (if married) shown as secondary
- Emails list (merged from both spouses if sharing)
- Phones list (merged from both spouses if sharing)
- Address (from `addressId`, shared if spouse has same addressId)

**Template:** `src/app/components/contacts/contact-card/contact-card.component.html`

```html
<!-- Card with clan color left border -->
<mat-card class="contact-card" [style.border-left-color]="clan?.hexColor || '#cccccc'">
  <mat-card-header>
    <mat-card-title>{{ person.name.first }} {{ person.name.last }}</mat-card-title>
    <mat-card-subtitle *ngIf="spouse">
      Married to {{ spouse.name.first }} {{ spouse.name.last }}
    </mat-card-subtitle>
  </mat-card-header>
  <mat-card-content>
    <!-- Emails section -->
    <div class="contact-section" *ngIf="emails.length">
      <span class="section-label">Email</span>
      <span *ngFor="let email of emails">{{ email.value }}</span>
    </div>
    <!-- Phones section -->
    <div class="contact-section" *ngIf="phones.length">
      <span class="section-label">Phone</span>
      <span *ngFor="let phone of phones">{{ phone.value }}</span>
    </div>
    <!-- Address section -->
    <div class="contact-section" *ngIf="address">
      <span class="section-label">Address</span>
      <span>{{ address | addressFormat }}</span>
    </div>
  </mat-card-content>
</mat-card>
```

### 3. Modify ContactsComponent

**File:** `src/app/components/contacts/contacts.component.ts`

- Remove injection of `ContactService`
- Inject `ContactsFromPeopleService`, `ClanService`, `AnalyticsService`, `Router`, and `ActivatedRoute`
- Replace `contactView$` logic with `contactsFromPeopleService.getContacts()`
- Add filter text input and clan select dropdown that update query params
- Add `PersonDetailModal` integration with `selectedPersonId` state

**Template:** `src/app/components/contacts/contacts.component.html`

Card grid layout with filter row:

```html
<div class="contacts-container">
  <div class="filter-row">
    <!-- Filter input with clear button -->
    <!-- Clan select dropdown with clear button -->
  </div>
  <div class="contacts-grid">
    <app-contact-card
      *ngFor="let card of contacts"
      [contactCard]="card"
      (personClick)="openPersonDetail($event)"
      (spouseClick)="openPersonDetail($event)">
    </app-contact-card>
  </div>
</div>
<app-person-detail-modal
  *ngIf="selectedPersonId"
  [personId]="selectedPersonId"
  (closeModal)="closeModal()"
  (openPerson)="openPersonDetail($event)">
</app-person-detail-modal>
```

Query params:
- `?filter=` — text search filter
- `?clan=` — clan name filter
- `?selected=` — person ID to open in modal

CSS for grid:
```css
.contacts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  padding: 16px;
}
```

### 4. Address lookup

**File:** `src/app/services/address.service.ts` — existing service used to look up addresses by `addressId`.

The `ContactsFromPeopleService` injects `AddressService` to resolve `addressId` on Person objects.

### 5. Spouse merge logic

When building `ContactCard`:
1. Load person by ID
2. If `person.spouseId` is set, load spouse person
3. Merge `emails[]` from both (deduplicate by `value` field)
4. Merge `phones[]` from both (deduplicate by `value` field)
5. If both have same `addressId`, use that address once
6. If spouse has a different `addressId`, include both addresses

---

## Firebase Requirements

### Database paths

- **Read path:** `persons/{personId}` — via `PeopleService.getPersons()`
- **Read path:** `clans/{clanId}` — via `ClansService.getClans()`
- **Read path:** `addresses/{addressId}` — via `AddressService.getAddress()`
- No writes to any Firebase paths from this feature

### Security rules

No changes required — existing read rules on `persons`, `clans`, and `addresses` are sufficient.

### Auth context

No auth required for contact reads — contacts are readable by anyone with database access (same as existing contacts).

---

## Production Risks & Mitigations

1. **Risk:** Spouse resolution fails if `spouseId` is set but the spouse Person does not exist in Firebase.
   **Mitigation:** `ContactsFromPeopleService` handles null spouse gracefully — contact card shows only the person's own info.

2. **Risk:** Address lookup fails for `addressId` that does not exist in Firebase.
   **Mitigation:** Address is optional in UI — if lookup returns null, address section is hidden.

3. **Risk:** If a Person has no `clanId` or the clan lookup returns null, the card has no color accent.
   **Mitigation:** Fallback to `#cccccc` as the border color when `clan.hexColor` is not available.

---

## Rollout Plan

1. Build `ContactsFromPeopleService` with `getContacts()` and spouse merge logic.
2. Build `ContactCardComponent` with clan color accent and merged field display.
3. Modify `ContactsComponent` to use new service and card grid layout.
4. Verify locally with `ng serve` — confirm contacts display, sort order, and spouse sharing work.
5. Deploy to Firebase hosting.
6. Verify on staging — check contact cards render correctly for all people.

---

## Test Plan

### ContactsFromPeopleService specs

**File:** `src/app/services/contacts-from-people.service.spec.ts`

1. `getContacts()` returns list sorted by generation then id
2. Person without spouseId shows only their own fields
3. Person with spouseId merges emails from both (deduplicated)
4. Person with spouseId merges phones from both (deduplicated)
5. Person with spouseId shares address (same addressId) — shows once
6. Person with spouseId with different addressIds — shows both addresses
7. Person with non-existent spouseId — shows only own info (no error)
8. Person with null `addressId` — address section hidden
9. Person with null `clanId` — fallback border color used
10. Spouse records (`id.endsWith('-S')`) excluded from top-level list
11. Person with `isLiving === false` is excluded
12. Person with no emails, no phones, and no addressId is excluded

### ContactCardComponent specs

**File:** `src/app/components/contacts/contact-card/contact-card.component.spec.ts`

1. Card renders with left border color from `clan.hexColor`
2. Card renders person full name in title
3. Spouse shown on same line with ` & ` separator (not "Married to" subheader)
4. Both person and spouse names are clickable and emit events
5. Hovering over name shows underline style
6. Emails section hidden when emails array is empty
7. Phones section hidden when phones array is empty
8. Address section hidden when address is null
9. Multiple emails render as separate items
10. Multiple phones render as separate items

### ContactsComponent integration specs

**File:** `src/app/components/contacts/contacts.component.spec.ts`

1. Component loads and displays contact cards via async pipe
2. Cards display in grid layout (CSS grid)
3. Generation 1 people appear before generation 2 people in the list

---

## Summary of Changes

### New files

- `src/app/services/contacts-from-people.service.ts` — new service deriving contacts from Person model
- `src/app/components/contacts/contact-card/contact-card.component.ts` — contact card component with clickable names
- `src/app/components/contacts/contact-card/contact-card.component.html` — card template with ` & ` spouse display and clickable names
- `src/app/components/contacts/contact-card/contact-card.component.scss` — card styles with hover underline for clickable names
- `src/app/services/contacts-from-people.service.spec.ts` — service unit tests
- `src/app/components/contacts/contact-card/contact-card.component.spec.ts` — component unit tests

### Modified files

- `src/app/components/contacts/contacts.component.ts` — added filter/clan inputs, query params, PersonDetailModal integration
- `src/app/components/contacts/contacts.component.html` — filter row + card grid + modal
- `src/app/components/contacts/contacts.component.scss` — filter row layout + grid styles
- `src/app/app.module.ts` — declared `ContactCardComponent`
- `src/app/models/address.ts` — added optional `id` field to `Address` interface

### No changes (preserved as-is)

- `src/app/models/contact.ts` — legacy Contact model unchanged
- `src/app/services/contact.service.ts` — untouched
- Firebase `contacts/` path — no writes, no migration

---

## Verification

### Local verification

1. Run `ng serve` and navigate to `/contacts`
2. Verify contact cards display with clan color left borders
3. Verify generation 1 people appear before generation 2 people
4. Find a married person (has spouseId) — verify spouse shows with ` & ` on same line
5. Click on a person name — verify `PersonDetailModal` opens
6. Hover over a name — verify underline appears
7. Enter filter text — verify URL updates with `?filter=` and cards filter
8. Select a clan — verify URL updates with `?clan=` and cards filter
9. Copy URL and open in new tab — verify filter/clan persist
10. Verify deceased people (`isLiving === false`) do not appear as primary entries
11. Verify living spouse of deceased person appears as primary without deceased spouse name, but with merged contact info from deceased spouse
12. Verify people with no contact info do not appear
13. Verify empty states: person with no email, no phone, or no address — corresponding sections are hidden

### Staging verification

1. Deploy to Firebase staging hosting
2. Navigate to `/contacts`
3. Verify visual layout matches design (card grid, clan colors, professional appearance)
4. Spot-check married couples — confirm contact sharing works as expected

---

## Open Questions

None — all questions resolved during spec review.