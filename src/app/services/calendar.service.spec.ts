import { TestBed, inject } from '@angular/core/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { CalendarService } from './calendar.service';
import { PeopleService } from './people.service';
import { RtdbService } from './rtdb.service';
import { Person } from 'src/app/models/person';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';

describe('CalendarService', () => {
  let mockPeopleService: any;
  let mockPeopleSubject: BehaviorSubject<Person[]>;
  let mockLoadErrorSubject: BehaviorSubject<string | null>;

  beforeEach(() => {
    mockPeopleSubject = new BehaviorSubject<Person[]>([]);
    mockLoadErrorSubject = new BehaviorSubject<string | null>(null);
    mockPeopleService = {
      people$: mockPeopleSubject.asObservable(),
      loadError$: mockLoadErrorSubject.asObservable()
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

      const filtered = service.updateEvents(events, 2024, true, true, false, false);
      expect(filtered.length).toBe(0);

      const withNotLiving = service.updateEvents(events, 2024, true, true, true, false);
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

    it('emits a shared anniversary once when both records carry the date', inject([CalendarService], (service: CalendarService) => {
      mockPeopleSubject.next([
        createPerson({ id: 'person-1', spouseId: 'spouse-1', anniversaryDate: { year: 2015, month: 7, day: 4 } }),
        createPerson({ id: 'spouse-1', name: { firstGiven: 'Jane', firstPreferred: null, maiden: null, last: 'Smith', suffix: null }, spouseId: 'person-1', anniversaryDate: { year: 2015, month: 7, day: 4 } })
      ]);

      const events = service['calendarEventsSource'].getValue();
      expect(events.filter(e => e.type === 'anniversary').length).toBe(1);
    }));

    it('emits an anniversary held only by the -S record, labelled from the primary', inject([CalendarService], (service: CalendarService) => {
      mockPeopleSubject.next([
        createPerson({ id: 'person-1', spouseId: 'spouse-1-S', anniversaryDate: null }),
        createPerson({ id: 'spouse-1-S', name: { firstGiven: 'Jane', firstPreferred: null, maiden: null, last: 'Smith', suffix: null }, spouseId: 'person-1', anniversaryDate: { year: 2015, month: 7, day: 4 } })
      ]);

      const events = service['calendarEventsSource'].getValue();
      const anniversaryEvents = events.filter(e => e.type === 'anniversary');
      expect(anniversaryEvents.length).toBe(1);
      expect(anniversaryEvents[0].personId).toBe('person-1');
      expect(anniversaryEvents[0].title).toContain('John');
      expect(anniversaryEvents[0].title).toContain('Jane');
    }));

    it('does not duplicate a virtual spouse birthday identical to its primary', inject([CalendarService], (service: CalendarService) => {
      mockPeopleSubject.next([
        createPerson({ id: 'person-1', birthday: { year: 1990, month: 6, day: 15 } }),
        createPerson({ id: 'person-1-S', name: { firstGiven: 'Jane', firstPreferred: null, maiden: null, last: 'Doe', suffix: null }, spouseId: 'person-1', birthday: { year: 1990, month: 6, day: 15 } })
      ]);

      const events = service['calendarEventsSource'].getValue();
      const birthEvents = events.filter(e => e.type === 'birth');
      expect(birthEvents.length).toBe(1);
      expect(birthEvents[0].personId).toBe('person-1');
    }));

    it('propagates a people load error to its error subscriber', inject([CalendarService], (service: CalendarService) => {
      let error: string | null = null;
      service.loadError$.subscribe(value => error = value);

      mockLoadErrorSubject.next('permission denied');
      expect(error).toBe('permission denied');

      mockLoadErrorSubject.next(null);
      expect(error).toBeNull();
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

      const result = service.updateEvents([event], 2024, false, true, true, false);
      expect(result.length).toBe(0);
    }));

    it('excludes anniversary events when anniversaries filter is false', inject([CalendarService], (service: CalendarService) => {
      const event = new RecurringEvent();
      event.id = 'anniv-1';
      event.type = 'anniversary';
      event.title = 'John & Jane';
      event.date = new Date(2015, 6, 4);
      event.isLiving = true;

      const result = service.updateEvents([event], 2024, true, false, true, false);
      expect(result.length).toBe(0);
    }));

    it('appends holidays for the year when the holidays filter is true', inject([CalendarService], (service: CalendarService) => {
      const result = service.updateEvents([], 2026, true, true, false, true);

      expect(result.length).toBe(12);
      expect(result.every(event => event.type === 'holiday')).toBe(true);
      expect(result.every(event => event.personId === null && event.personId2 === null)).toBe(true);

      const christmas = result.find(event => event.title === 'Christmas Day');
      expect(christmas?.date.getFullYear()).toBe(2026);
      expect(christmas?.date.getMonth()).toBe(11);
      expect(christmas?.date.getDate()).toBe(25);
    }));

    it('omits holidays when the holidays filter is false', inject([CalendarService], (service: CalendarService) => {
      const result = service.updateEvents([], 2026, true, true, false, false);

      expect(result.some(event => event.type === 'holiday')).toBe(false);
    }));

    it('places a Feb-29 birthday on Feb 28 in a non-leap view year', inject([CalendarService], (service: CalendarService) => {
      mockPeopleSubject.next([
        createPerson({ id: 'person-1', birthday: { year: 2000, month: 2, day: 29 } })
      ]);

      const events = service['calendarEventsSource'].getValue();
      const result = service.updateEvents(events, 2023, true, true, true, false);

      expect(result.length).toBe(1);
      expect(result[0].start.getMonth()).toBe(1);
      expect(result[0].start.getDate()).toBe(28);
      expect(result[0].date.getMonth()).toBe(1);
    }));

    it('keeps a Feb-29 birthday on Feb 29 in a leap view year', inject([CalendarService], (service: CalendarService) => {
      mockPeopleSubject.next([
        createPerson({ id: 'person-1', birthday: { year: 2000, month: 2, day: 29 } })
      ]);

      const events = service['calendarEventsSource'].getValue();
      const result = service.updateEvents(events, 2024, true, true, true, false);

      expect(result.length).toBe(1);
      expect(result[0].start.getMonth()).toBe(1);
      expect(result[0].start.getDate()).toBe(29);
      expect(result[0].date.getMonth()).toBe(1);
    }));

    it('sorts by the remapped observed date, not the source date', inject([CalendarService], (service: CalendarService) => {
      mockPeopleSubject.next([
        createPerson({ id: 'person-dec', birthday: { year: 1990, month: 12, day: 5 } }),
        createPerson({ id: 'person-jan', birthday: { year: 1990, month: 1, day: 5 } })
      ]);

      const events = service['calendarEventsSource'].getValue();
      const result = service.updateEvents(events, 2024, true, true, true, false);

      expect(result.map(e => e.start.getMonth())).toEqual([0, 11]);
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

describe('PeopleService load errors', () => {
  it('routes valueChanges errors to loadError$ without erroring people$', () => {
    const peopleChanges = new Subject<Person[]>();
    TestBed.configureTestingModule({
      providers: [
        PeopleService,
        {
          provide: RtdbService,
          useValue: { list: () => ({ valueChanges: () => peopleChanges.asObservable() }) }
        }
      ]
    });

    const peopleService = TestBed.inject(PeopleService);
    let error: string | null = null;
    let peopleError = false;
    peopleService.loadError$.subscribe(value => error = value);
    peopleService.people$.subscribe({ error: () => peopleError = true });

    peopleChanges.error(new Error('permission denied'));

    expect(error).toBe('permission denied');
    expect(peopleError).toBe(false);
  });
});

function createPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'default-id',
    name: { firstGiven: 'John', firstPreferred: null, maiden: null, last: 'Doe', suffix: null },
    birthday: { year: 1990, month: 6, day: 15 },
    spouseId: null,
    anniversaryDate: null,
    deathDate: null,
    familyId: null,
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
