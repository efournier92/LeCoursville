import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactCardComponent } from './contact-card.component';
import { ContactCard } from 'src/app/services/contacts-from-people.service';
import { Person } from 'src/app/models/person';
import { Clan } from 'src/app/models/clan';

describe('ContactCardComponent', () => {
  let component: ContactCardComponent;
  let fixture: ComponentFixture<ContactCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ContactCardComponent]
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

  describe('getSpouseFullName', () => {
    it('returns spouse full name', () => {
      const person = createPerson({ id: 'person1' });
      const spouse = createPerson({
        id: 'person2',
        name: { firstGiven: 'Jane', firstPreferred: null, maiden: null, last: 'Smith', suffix: null }
      });
      component.contactCard = createContactCard({ person, spouse });
      fixture.detectChanges();
      expect(component.getSpouseFullName()).toBe('Jane Smith');
    });

    it('returns empty string when spouse is null', () => {
      const person = createPerson({ id: 'person1' });
      component.contactCard = createContactCard({ person, spouse: null });
      fixture.detectChanges();
      expect(component.getSpouseFullName()).toBe('');
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
        emails: [{ address: 'test@test.com', label: null }]
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
        phones: [{ label: 'Mobile', number: '555-1234' }]
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
    it('formats address with street, city, state, zip', () => {
      const address = { street: '123 Main St', city: 'Boston', state: 'MA', zip: '02101', full: null, label: null };
      expect(component.formatAddress(address)).toBe('123 Main St, Boston, MA, 02101');
    });

    it('filters out null parts', () => {
      const address = { street: '123 Main St', city: null, state: 'MA', zip: null, full: null, label: null };
      expect(component.formatAddress(address)).toBe('123 Main St, MA');
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
    anniversaryId: null,
    emails: [],
    phones: [],
    addressId: null,
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