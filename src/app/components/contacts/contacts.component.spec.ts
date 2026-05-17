import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsComponent } from './contacts.component';
import { ContactsFromPeopleService, ContactCard } from 'src/app/services/contacts-from-people.service';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { BehaviorSubject } from 'rxjs';
import { Person } from 'src/app/models/person';
import { Clan } from 'src/app/models/clan';

describe('ContactsComponent', () => {
  let component: ContactsComponent;
  let fixture: ComponentFixture<ContactsComponent>;
  let mockContactsService: any;
  let mockAnalyticsService: any;

  const contactsSubject = new BehaviorSubject<ContactCard[]>([]);

  beforeEach(async () => {
    mockContactsService = {
      contacts$: contactsSubject.asObservable()
    };
    mockAnalyticsService = {
      logEvent: jasmine.createSpy('logEvent')
    };

    await TestBed.configureTestingModule({
      declarations: [ContactsComponent],
      providers: [
        { provide: ContactsFromPeopleService, useValue: mockContactsService },
        { provide: AnalyticsService, useValue: mockAnalyticsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads contact cards from service', () => {
    const testCards: ContactCard[] = [
      {
        person: createPerson({ id: 'person1' }),
        spouse: null,
        clan: null,
        addresses: [],
        emails: [{ address: 'test@test.com', label: null }],
        phones: []
      }
    ];
    contactsSubject.next(testCards);
    fixture.detectChanges();
    expect(component.contacts$).toEqual(testCards);
  });

  it('generation 1 people appear before generation 2 people', () => {
    const testCards: ContactCard[] = [
      { person: createPerson({ id: 'gen2', generationNumber: 2 }), spouse: null, clan: null, addresses: [], emails: [], phones: [] },
      { person: createPerson({ id: 'gen1', generationNumber: 1 }), spouse: null, clan: null, addresses: [], emails: [], phones: [] }
    ];
    contactsSubject.next(testCards);
    fixture.detectChanges();
    expect(component.contacts$[0].person.generationNumber).toBe(1);
    expect(component.contacts$[1].person.generationNumber).toBe(2);
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