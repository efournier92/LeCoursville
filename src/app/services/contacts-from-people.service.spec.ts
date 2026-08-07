import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ContactsFromPeopleService, ContactCard } from './contacts-from-people.service';
import { PeopleService } from 'src/app/services/people.service';
import { ClanService } from 'src/app/services/clan.service';
import { Person } from 'src/app/models/person';
import { Clan } from 'src/app/models/clan';

describe('ContactsFromPeopleService', () => {
  let service: ContactsFromPeopleService;
  let mockPeopleService: { people$: unknown };
  let mockClanService: { clans$: unknown };

  // Fresh subjects per test: the service holds combineLatest subscriptions for
  // its whole lifetime, so stale values from a previous test would otherwise
  // leak into the next one (the original suite failed intermittently on this).
  let peopleSubject: BehaviorSubject<Person[]>;
  let clansSubject: BehaviorSubject<Clan[]>;

  beforeEach(() => {
    peopleSubject = new BehaviorSubject<Person[]>([]);
    clansSubject = new BehaviorSubject<Clan[]>([]);
    mockPeopleService = { people$: peopleSubject.asObservable() };
    mockClanService = { clans$: clansSubject.asObservable() };

    TestBed.configureTestingModule({
      providers: [
        ContactsFromPeopleService,
        { provide: PeopleService, useValue: mockPeopleService },
        { provide: ClanService, useValue: mockClanService },
      ]
    });

    service = TestBed.inject(ContactsFromPeopleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getContacts', () => {
    it('returns list sorted by generation then id', async () => {
      const clans: Clan[] = [{ id: 'clan1', name: 'Test', hexColor: '#FF0000', sortOrder: 'A', createdAt: 0, updatedAt: 0 }];
      const people: Person[] = [
        createPerson({ id: 'gen2-person', generationNumber: 2, emails: [{ address: 'a@test.com', label: null }] }),
        createPerson({ id: 'gen1-person', generationNumber: 1, emails: [{ address: 'b@test.com', label: null }] })
      ];

      peopleSubject.next(people);
      clansSubject.next(clans);

      const contacts: ContactCard[] = await firstValueFrom(service.getContacts());
      expect(contacts.length).toBe(2);
      expect(contacts[0].person.generationNumber).toBe(1);
      expect(contacts[1].person.generationNumber).toBe(2);
    });

    it('person without spouse shows only their own fields', async () => {
      const people: Person[] = [
        createPerson({
          id: 'person1',
          spouseId: null,
          emails: [{ address: 'test@test.com', label: 'Home' }],
          phones: [{ label: 'Mobile', number: '555-1234' }],
        })
      ];

      peopleSubject.next(people);
      clansSubject.next([]);

      const contacts: ContactCard[] = await firstValueFrom(service.getContacts());
      expect(contacts.length).toBe(1);
      expect(contacts[0].spouse).toBeNull();
      expect(contacts[0].emails.length).toBe(1);
      expect(contacts[0].phones.length).toBe(1);
    });

    it('merges spouse emails into the primary card, deduplicated by address', async () => {
      // Real data model: the spouse is a "-S" suffixed record. It must not
      // produce a second top-level card while its contact info is merged.
      const people: Person[] = [
        createPerson({
          id: 'person1',
          spouseId: 'person1-S',
          emails: [{ address: 'person1@test.com', label: null }]
        }),
        createPerson({
          id: 'person1-S',
          emails: [{ address: 'person2@test.com', label: null }, { address: 'person1@test.com', label: null }]
        })
      ];

      peopleSubject.next(people);
      clansSubject.next([]);

      const contacts: ContactCard[] = await firstValueFrom(service.getContacts());
      expect(contacts.length).toBe(1);
      expect(contacts[0].person.id).toBe('person1');
      expect(contacts[0].spouse).not.toBeNull();
      expect(contacts[0].emails.length).toBe(2);
    });

    it('merges spouse phones into the primary card, deduplicated by number', async () => {
      const people: Person[] = [
        createPerson({
          id: 'person1',
          spouseId: 'person1-S',
          phones: [{ label: 'Mobile', number: '555-1111' }]
        }),
        createPerson({
          id: 'person1-S',
          phones: [{ label: 'Home', number: '555-2222' }]
        })
      ];

      peopleSubject.next(people);
      clansSubject.next([]);

      const contacts: ContactCard[] = await firstValueFrom(service.getContacts());
      expect(contacts.length).toBe(1);
      expect(contacts[0].person.id).toBe('person1');
      expect(contacts[0].phones.length).toBe(2);
    });

    it('spouse records (id.endsWith("-S")) excluded from top-level list while regular spouse is living', async () => {
      const people: Person[] = [
        createPerson({ id: 'person1', generationNumber: 1, emails: [{ address: 'a@test.com', label: null }] }),
        createPerson({ id: 'person1-S', generationNumber: 1, emails: [{ address: 'b@test.com', label: null }] })
      ];

      peopleSubject.next(people);
      clansSubject.next([]);

      const contacts: ContactCard[] = await firstValueFrom(service.getContacts());
      expect(contacts.length).toBe(1);
      expect(contacts[0].person.id).toBe('person1');
    });

    it('excludes deceased people unless they are a -S record whose regular spouse is deceased', async () => {
      const people: Person[] = [
        createPerson({ id: 'deceased1', isLiving: false, emails: [{ address: 'a@test.com', label: null }] }),
        createPerson({ id: 'widow1', isLiving: true, emails: [{ address: 'b@test.com', label: null }] }),
      ];

      peopleSubject.next(people);
      clansSubject.next([]);

      const contacts: ContactCard[] = await firstValueFrom(service.getContacts());
      expect(contacts.map(c => c.person.id)).toEqual(['widow1']);
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
