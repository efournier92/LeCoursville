import { TestBed } from '@angular/core/testing';
import { ContactsFromPeopleService, ContactCard } from './contacts-from-people.service';
import { PeopleService } from 'src/app/services/people.service';
import { ClanService } from 'src/app/services/clan.service';
import { AddressesService } from 'src/app/services/addresses.service';
import { BehaviorSubject } from 'rxjs';
import { Person, Email, Phone } from 'src/app/models/person';
import { Clan } from 'src/app/models/clan';
import { Address } from 'src/app/models/address';

describe('ContactsFromPeopleService', () => {
  let service: ContactsFromPeopleService;
  let mockPeopleService: any;
  let mockClanService: any;
  let mockAddressesService: any;

  const mockPeople$ = new BehaviorSubject<Person[]>([]);
  const mockClans$ = new BehaviorSubject<Clan[]>([]);
  const mockAddresses$ = new BehaviorSubject<Address[]>([]);

  beforeEach(() => {
    mockPeopleService = {
      people$: mockPeople$.asObservable(),
      getPerson: jasmine.createSpy('getPerson').and.returnValue(new BehaviorSubject(null).asObservable())
    };
    mockClanService = {
      clans$: mockClans$.asObservable()
    };
    mockAddressesService = {
      addresses$: mockAddresses$.asObservable(),
      addressesSource: { getValue: () => [] } as BehaviorSubject<Address[]>
    };

    TestBed.configureTestingModule({
      providers: [
        ContactsFromPeopleService,
        { provide: PeopleService, useValue: mockPeopleService },
        { provide: ClanService, useValue: mockClanService },
        { provide: AddressesService, useValue: mockAddressesService },
      ]
    });

    service = TestBed.inject(ContactsFromPeopleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getContacts', () => {
    it('returns list sorted by generation then id', (done) => {
      const clans: Clan[] = [{ id: 'clan1', name: 'Test', hexColor: '#FF0000', sortOrder: 'A', createdAt: 0, updatedAt: 0 }];
      const people: Person[] = [
        createPerson({ id: 'gen2-person', generationNumber: 2, emails: [], phones: [] }),
        createPerson({ id: 'gen1-person', generationNumber: 1, emails: [], phones: [] })
      ];

      mockPeople$.next(people);
      mockClans$.next(clans);
      mockAddresses$.next([]);

      service.getContacts().subscribe((contacts: ContactCard[]) => {
        expect(contacts.length).toBe(2);
        expect(contacts[0].person.generationNumber).toBe(1);
        expect(contacts[1].person.generationNumber).toBe(2);
        done();
      });
    });

    it('person without spouseId shows only their own fields', (done) => {
      const people: Person[] = [
        createPerson({
          id: 'person1',
          spouseId: null,
          emails: [{ address: 'test@test.com', label: 'Home' }],
          phones: [{ label: 'Mobile', number: '555-1234' }],
          addressId: null
        })
      ];

      mockPeople$.next(people);
      mockClans$.next([]);
      mockAddresses$.next([]);

      service.getContacts().subscribe((contacts: ContactCard[]) => {
        expect(contacts.length).toBe(1);
        expect(contacts[0].spouse).toBeNull();
        expect(contacts[0].emails.length).toBe(1);
        expect(contacts[0].phones.length).toBe(1);
        done();
      });
    });

    it('person with spouseId merges emails from both (deduplicated)', (done) => {
      const people: Person[] = [
        createPerson({
          id: 'person1',
          spouseId: 'person2',
          emails: [{ address: 'person1@test.com', label: null }]
        }),
        createPerson({
          id: 'person2',
          spouseId: 'person1',
          emails: [{ address: 'person2@test.com', label: null }, { address: 'person1@test.com', label: null }]
        })
      ];

      mockPeople$.next(people);
      mockClans$.next([]);
      mockAddresses$.next([]);

      service.getContacts().subscribe((contacts: ContactCard[]) => {
        expect(contacts.length).toBe(1);
        expect(contacts[0].spouse).not.toBeNull();
        expect(contacts[0].emails.length).toBe(2);
        done();
      });
    });

    it('person with spouseId merges phones from both (deduplicated)', (done) => {
      const people: Person[] = [
        createPerson({
          id: 'person1',
          spouseId: 'person2',
          phones: [{ label: 'Mobile', number: '555-1111' }]
        }),
        createPerson({
          id: 'person2',
          spouseId: 'person1',
          phones: [{ label: 'Home', number: '555-2222' }]
        })
      ];

      mockPeople$.next(people);
      mockClans$.next([]);
      mockAddresses$.next([]);

      service.getContacts().subscribe((contacts: ContactCard[]) => {
        expect(contacts.length).toBe(1);
        expect(contacts[0].phones.length).toBe(2);
        done();
      });
    });

    it('spouse records (id.endsWith("-S")) excluded from top-level list', (done) => {
      const people: Person[] = [
        createPerson({ id: 'person1', generationNumber: 1 }),
        createPerson({ id: 'person1-S', generationNumber: 1 })
      ];

      mockPeople$.next(people);
      mockClans$.next([]);
      mockAddresses$.next([]);

      service.getContacts().subscribe((contacts: ContactCard[]) => {
        expect(contacts.length).toBe(1);
        expect(contacts[0].person.id).toBe('person1');
        done();
      });
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