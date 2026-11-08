import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';
import { PeopleService } from 'src/app/services/people.service';
import { Person } from 'src/app/models/person';
import { getHolidaysForYear } from 'src/app/config/calendar-holidays';

export const Months: string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

@Injectable({
  providedIn: 'root',
})
export class CalendarService {
  private calendarEventsSource = new BehaviorSubject([]);
  calendarEventsObservable = this.calendarEventsSource.asObservable();
  private loadErrorSource = new BehaviorSubject<string | null>(null);
  loadError$: Observable<string | null> = this.loadErrorSource.asObservable();
  eventsLoaded$: Observable<boolean>;

  constructor(
    private peopleService: PeopleService
  ) {
    this.eventsLoaded$ = this.peopleService.peopleLoaded$;

    this.peopleService.people$.subscribe(
      (people: Person[]) => {
        this.deriveEventsFromPeople(people);
      }
    );

    if (this.peopleService.loadError$) {
      this.peopleService.loadError$.subscribe(
        (error: string | null) => this.loadErrorSource.next(error)
      );
    }
  }

  private deriveEventsFromPeople(people: Person[]): void {
    const events: RecurringEvent[] = [];

    for (const person of people) {
      // Birthdays include virtual spouses, except when duplicating a primary's birthday.
      if (person.birthday && person.birthday.year > 0) {
        const primary = person.id.endsWith('-S')
          ? people.find(p => p.id === person.id.slice(0, -2))
          : null;
        const duplicatesPrimary = primary?.birthday
          && this.isSameCalendarDate(primary.birthday, person.birthday);
        if (!duplicatesPrimary) {
          const event = new RecurringEvent();
          event.id = `birth-${person.id}`;
          event.type = 'birth';
          event.personId = person.id;
          event.title = this.getPersonFullName(person);
          event.date = new Date(person.birthday.year, person.birthday.month - 1, person.birthday.day);
          event.start = new Date(event.date);
          event.isLiving = person.isLiving;
          events.push(event);
        }
      }
    }

    // Each couple emits one anniversary, including dates held only by the -S record.
    const seenAnniversaries = new Set<string>();
    for (const person of people) {
      if (!person.anniversaryDate || seenAnniversaries.has(person.id)) continue;

      const isVirtual = person.id.endsWith('-S');
      const primary = isVirtual
        ? people.find(p => p.id === person.spouseId) || null
        : person;
      const anchor = primary || person;
      const spouse = people.find(p => p.id === anchor.spouseId)
        || (isVirtual && primary ? person : null);
      const title = spouse
        ? this.getAnniversaryTitle(anchor, spouse)
        : this.getPersonFullName(anchor);

      const event = new RecurringEvent();
      event.id = `anniv-${anchor.id}`;
      event.type = 'anniversary';
      event.personId = anchor.id;
      event.personId2 = spouse?.id || null;
      event.title = title;
      event.date = new Date(person.anniversaryDate.year, person.anniversaryDate.month - 1, person.anniversaryDate.day);
      event.start = new Date(event.date);
      event.isLiving = anchor.isLiving;
      events.push(event);

      seenAnniversaries.add(person.id);
      if (person.spouseId) seenAnniversaries.add(person.spouseId);
      seenAnniversaries.add(anchor.id);
      if (spouse?.id) seenAnniversaries.add(spouse.id);
    }

    this.calendarEventsSource.next(events);
  }

  private isSameCalendarDate(a: { year: number; month: number; day: number }, b: { year: number; month: number; day: number }): boolean {
    return a.year === b.year && a.month === b.month && a.day === b.day;
  }

  private getPersonFullName(person: Person): string {
    const first = person.name.firstPreferred || person.name.firstGiven || '';
    const last = person.name.last || '';
    return `${first} ${last}`.trim();
  }

  private getPersonFirstName(person: Person): string {
    return person.name.firstPreferred || person.name.firstGiven || '';
  }

  private getAnniversaryTitle(person: Person, spouse: Person): string {
    const personName = this.getPersonFullName(person);
    if (!spouse) return personName;

    const sameLastName = person.name.last === spouse.name.last && person.name.last;
    if (sameLastName) {
      return `${this.getPersonFirstName(person)} & ${this.getPersonFirstName(spouse)} ${sameLastName}`;
    }
    return `${personName} & ${this.getPersonFullName(spouse)}`;
  }

  getEventsByPerson(personId: string): Observable<RecurringEvent[]> {
    return this.calendarEventsSource.pipe(
      map((events: RecurringEvent[]) =>
        events.filter((event: RecurringEvent) => event.personId === personId)
      )
    );
  }

  getViewYears(): number[] {
    const thisYear: number = new Date().getFullYear();
    let year = thisYear - 1;
    const years: number[] = [];
    for (let i = 0; i < 7; i++) {
      years.push(year);
      year += 1;
    }
    return years;
  }

  updateEvents(
    events: RecurringEvent[],
    year: number,
    birthdays: boolean,
    anniversaries: boolean,
    notLiving: boolean,
    holidays: boolean,
  ): RecurringEvent[] {
    let output = [];
    for (const event of events) {
      if (event.type === 'birth' && !birthdays) continue;
      if (event.type === 'anniversary' && !anniversaries) continue;
      if (!event.isLiving && !notLiving) continue;

      const eventClone = new RecurringEvent();
      eventClone.id = event.id;
      eventClone.title = event.title;
      eventClone.type = event.type;
      eventClone.personId = event.personId;
      eventClone.personId2 = event.personId2;
      eventClone.isLiving = event.isLiving;
      const month = event.date.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      // Clamp Feb 29 to Feb 28 in non-leap view years so month, render, and sort agree.
      const date = new Date(year, month, Math.min(event.date.getDate(), daysInMonth));
      eventClone.start = new Date(date);
      eventClone.date = new Date(event.date);
      output.push(eventClone);
    }

    if (holidays) {
      for (const holiday of getHolidaysForYear(year)) {
        const event = new RecurringEvent();
        event.id = `holiday-${year}-${holiday.month}-${holiday.day}`;
        event.type = 'holiday';
        event.title = holiday.name;
        event.personId = null;
        event.personId2 = null;
        event.isLiving = true;
        const date = new Date(year, holiday.month - 1, holiday.day);
        event.start = new Date(date);
        event.date = new Date(date);
        output.push(event);
      }
    }

    return output.sort(this.compareByDate);
  }

  getYearsSince(eventYear: number, currentYear: number): number {
    return currentYear - eventYear;
  }

  private compareByDate(a: RecurringEvent, b: RecurringEvent): number {
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  }
}