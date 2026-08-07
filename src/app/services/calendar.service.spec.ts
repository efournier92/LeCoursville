import { TestBed, inject } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { CalendarService } from './calendar.service';
import { PeopleService } from './people.service';
import { Person } from 'src/app/models/person';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';

describe('CalendarService', () => {
  let mockPeopleService: any;
  let mockPeopleSubject: BehaviorSubject<Person[]>;

  beforeEach(() => {
    mockPeopleSubject = new BehaviorSubject<Person[]>([]);
    mockPeopleService = {
      people$: mockPeopleSubject.asObservable()
    };

    TestBed.configureTestingModule({
      providers: [
        CalendarService,
        { provide: PeopleService, useValue: mockPeopleService }
      ]
    });
  });

  it('should be created', inject([CalendarService], (service: CalendarService) => {
    expect(service).toBeTruthy();
  }));

  describe('deriveEventsFromPeople', () => {
    it('creates birthday event for person with birthday', inject([CalendarService], (service: CalendarService) => {
      mockPeopleSubject.next([createPerson({ id: 'person-1', birthday: { year: 1990, month: 6, day: 15 } })]);

      const events = service['calendarEventsSource'].getValue();
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('birth');
      expect(events[0].personId).toBe('person-1');
      expect(events[0].title).toContain('John');
    }));

    it('does not emit a birthday event for a person without a birthday year', inject([CalendarService], (service: CalendarService) => {
      mockPeopleSubject.next([createPerson({ id: 'person-1', birthday: { year: 0, month: 6, day: 15 } })]);

      const events = service['calendarEventsSource'].getValue();
      expect(events.length).toBe(0);
    }));

    it('marks events with the person isLiving flag so updateEvents can filter them', inject([CalendarService], (service: CalendarService) => {
      mockPeopleSubject.next([createPerson({ id: 'person-1', isLiving: false })]);

      const events = service['calendarEventsSource'].getValue();
      expect(events.length).toBe(1);
      expect(events[0].isLiving).toBe(false);

      const filtered = service.updateEvents(events, 2024, true, true, false);
      expect(filtered.length).toBe(0);

      const withNotLiving = service.updateEvents(events, 2024, true, true, true);
      expect(withNotLiving.length).toBe(1);
    }));

    it('creates a single anniversary event for a couple and merges both names into the title', inject([CalendarService], (service: CalendarService) => {
      // Spouses share one anniversary; only the primary record carries the date.
      mockPeopleSubject.next([
        createPerson({ id: 'person-1', spouseId: 'spouse-1', anniversaryDate: { year: 2015, month: 7, day: 4 } }),
        createPerson({ id: 'spouse-1', name: { firstGiven: 'Jane', firstPreferred: null, maiden: null, last: 'Smith', suffix: null }, spouseId: 'person-1' })
      ]);

      const events = service['calendarEventsSource'].getValue();
      const anniversaryEvents = events.filter(e => e.type === 'anniversary');
      expect(anniversaryEvents.length).toBe(1);
      expect(anniversaryEvents[0].title).toContain('John');
      expect(anniversaryEvents[0].title).toContain('Jane');
    }));

    it('anniversary event has personId and personId2 set', inject([CalendarService], (service: CalendarService) => {
      mockPeopleSubject.next([
        createPerson({ id: 'person-1', spouseId: 'spouse-1', anniversaryDate: { year: 2015, month: 7, day: 4 } }),
        createPerson({ id: 'spouse-1', name: { firstGiven: 'Jane', firstPreferred: null, maiden: null, last: 'Smith', suffix: null }, spouseId: 'person-1' })
      ]);

      const events = service['calendarEventsSource'].getValue();
      const anniversaryEvent = events.find(e => e.type === 'anniversary');
      expect(anniversaryEvent?.personId).toBe('person-1');
      expect(anniversaryEvent?.personId2).toBe('spouse-1');
    }));
  });

  describe('updateEvents', () => {
    it('excludes birth events when birthdays filter is false', inject([CalendarService], (service: CalendarService) => {
      const event = new RecurringEvent();
      event.id = 'birth-1';
      event.type = 'birth';
      event.title = 'John Doe';
      event.date = new Date(1990, 5, 15);
      event.isLiving = true;

      const result = service.updateEvents([event], 2024, false, true, true);
      expect(result.length).toBe(0);
    }));

    it('excludes anniversary events when anniversaries filter is false', inject([CalendarService], (service: CalendarService) => {
      const event = new RecurringEvent();
      event.id = 'anniv-1';
      event.type = 'anniversary';
      event.title = 'John & Jane';
      event.date = new Date(2015, 6, 4);
      event.isLiving = true;

      const result = service.updateEvents([event], 2024, true, false, true);
      expect(result.length).toBe(0);
    }));

    it('getEventsByPerson returns only events for specified person', inject([CalendarService], (service: CalendarService) => {
      mockPeopleSubject.next([createPerson({ id: 'person-1' })]);

      const events = service['calendarEventsSource'].getValue();
      expect(events.length).toBe(1);

      let filteredEvents: RecurringEvent[] = [];
      service.getEventsByPerson('person-1').subscribe(events => {
        filteredEvents = events;
      });

      expect(filteredEvents.length).toBe(1);
      expect(filteredEvents[0].personId).toBe('person-1');
    }));
  });
});

function createPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'default-id',
    name: { firstGiven: 'John', firstPreferred: null, maiden: null, last: 'Doe', suffix: null },
    birthday: { year: 1990, month: 6, day: 15 },
    spouseId: null,
    anniversaryDate: null,
    clanId: null,
    emails: [],
    phones: [],
    addresses: [],
    directDescendent: false,
    generationNumber: 1,
    parentIds: [],
    lineage: null,
    isLiving: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  };
}
