import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ContactCardComponent } from './contact-card.component';
import { ContactCard } from 'src/app/services/contacts-from-people.service';
import { Person } from 'src/app/models/person';
import { Clan } from 'src/app/models/clan';

describe('ContactCardComponent', () => {
  let component: ContactCardComponent;
  let fixture: ComponentFixture<ContactCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ContactCardComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactCardComponent);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  describe('getPersonFullName', () => {
    it('returns full name from firstPreferred and last', () => {
      const person = createPerson({
        name: { firstGiven: 'John', firstPreferred: 'Johnny', maiden: null, last: 'Doe', suffix: null }
      });
      component.contactCard = createContactCard({ person });
      fixture.detectChanges();
      expect(component.getPersonFullName()).toBe('Johnny Doe');
    });

    it('falls back to firstGiven when firstPreferred is null', () => {
      const person = createPerson({
        name: { firstGiven: 'John', firstPreferred: null, maiden: null, last: 'Doe', suffix: null }
      });
      component.contactCard = createContactCard({ person });
      fixture.detectChanges();
      expect(component.getPersonFullName()).toBe('John Doe');
    });
  });

  describe('getCoupleFirstNames', () => {
    it('returns both first names when the couple shares a last name', () => {
      const person = createPerson({ id: 'person1' });
      const spouse = createPerson({
        id: 'person2',
        name: { firstGiven: 'Jane', firstPreferred: null, maiden: null, last: 'Doe', suffix: null }
      });
      component.contactCard = createContactCard({ person, spouse });
      expect(component.getCoupleFirstNames()).toEqual({ first: 'John', second: 'Jane' });
    });

    it('returns empty second name when last names differ', () => {
      const person = createPerson({ id: 'person1' });
      const spouse = createPerson({
        id: 'person2',
        name: { firstGiven: 'Jane', firstPreferred: null, maiden: null, last: 'Smith', suffix: null }
      });
      component.contactCard = createContactCard({ person, spouse });
      expect(component.getCoupleFirstNames()).toEqual({ first: 'John', second: '' });
    });

    it('returns null when there is no spouse', () => {
      component.contactCard = createContactCard({ person: createPerson({ id: 'person1' }), spouse: null });
      expect(component.getCoupleFirstNames()).toBeNull();
    });
  });

  describe('shared last name helpers', () => {
    it('getSharedLastName returns the shared name when last names match', () => {
      const person = createPerson({ id: 'person1' });
      const spouse = createPerson({
        id: 'person2',
        name: { firstGiven: 'Jane', firstPreferred: null, maiden: null, last: 'Doe', suffix: null }
      });
      component.contactCard = createContactCard({ person, spouse });
      expect(component.getSharedLastName()).toBe('Doe');
      expect(component.hasSameLastName()).toBe(true);
    });

    it('returns empty / false when last names differ', () => {
      const person = createPerson({ id: 'person1' });
      const spouse = createPerson({
        id: 'person2',
        name: { firstGiven: 'Jane', firstPreferred: null, maiden: null, last: 'Smith', suffix: null }
      });
      component.contactCard = createContactCard({ person, spouse });
      expect(component.getSharedLastName()).toBe('');
      expect(component.hasSameLastName()).toBe(false);
    });

    it('returns empty / false when there is no spouse', () => {
      component.contactCard = createContactCard({ person: createPerson({ id: 'person1' }), spouse: null });
      expect(component.getSharedLastName()).toBe('');
      expect(component.hasSameLastName()).toBe(false);
    });
  });

  describe('getClanColor', () => {
    it('returns clan hexColor when clan exists', () => {
      const clan: Clan = { id: 'clan1', name: 'Test', hexColor: '#FF0000', sortOrder: 'A', createdAt: 0, updatedAt: 0 };
      component.contactCard = createContactCard({ clan });
      fixture.detectChanges();
      expect(component.getClanColor()).toBe('#FF0000');
    });

    it('returns fallback #cccccc when clan is null', () => {
      component.contactCard = createContactCard({ clan: null });
      fixture.detectChanges();
      expect(component.getClanColor()).toBe('#cccccc');
    });
  });

  describe('hasEmails', () => {
    it('returns true when emails array has items', () => {
      const card = createContactCard({
        emails: [{ address: 'test@test.com', label: null, owner: null }]
      });
      component.contactCard = card;
      expect(component.hasEmails()).toBe(true);
    });

    it('returns false when emails array is empty', () => {
      const card = createContactCard({ emails: [] });
      component.contactCard = card;
      expect(component.hasEmails()).toBe(false);
    });
  });

  describe('hasPhones', () => {
    it('returns true when phones array has items', () => {
      const card = createContactCard({
        phones: [{ label: 'Mobile', number: '555-1234', owner: null }]
      });
      component.contactCard = card;
      expect(component.hasPhones()).toBe(true);
    });

    it('returns false when phones array is empty', () => {
      const card = createContactCard({ phones: [] });
      component.contactCard = card;
      expect(component.hasPhones()).toBe(false);
    });
  });

  describe('hasAddresses', () => {
    it('returns true when addresses array has items', () => {
      const card = createContactCard({
        addresses: [{ street: '123 Main St', city: 'Boston', state: 'MA', zip: '02101', full: null, label: null }]
      });
      component.contactCard = card;
      expect(component.hasAddresses()).toBe(true);
    });

    it('returns false when addresses array is empty', () => {
      const card = createContactCard({ addresses: [] });
      component.contactCard = card;
      expect(component.hasAddresses()).toBe(false);
    });
  });

  describe('formatAddress', () => {
    it('formats address with street on its own line then city, state, zip', () => {
      const address = { street: '123 Main St', city: 'Boston', state: 'MA', zip: '02101', full: null, label: null };
      expect(component.formatAddress(address)).toBe('123 Main St\nBoston, MA 02101');
    });

    it('filters out null parts', () => {
      const address = { street: '123 Main St', city: null, state: 'MA', zip: null, full: null, label: null };
      expect(component.formatAddress(address)).toBe('123 Main St\nMA');
    });
  });
});

function createPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'default-id',
    name: { firstGiven: 'John', firstPreferred: null, maiden: null, last: 'Doe', suffix: null },
    clanId: null,
    birthday: { year: 1990, month: 1, day: 1 },
    spouseId: null,
    anniversaryDate: null,
    emails: [],
    phones: [],
    addresses: [],
    directDescendent: true,
    generationNumber: 1,
    parentIds: [],
    lineage: null,
    isLiving: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  };
}

function createContactCard(overrides: Partial<ContactCard> = {}): ContactCard {
  return {
    person: createPerson(),
    spouse: null,
    clan: null,
    addresses: [],
    emails: [],
    phones: [],
    ...overrides
  };
}