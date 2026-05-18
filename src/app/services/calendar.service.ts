import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';
import { PeopleService } from 'src/app/services/people.service';
import { Person } from 'src/app/models/person';

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

  constructor(
    private peopleService: PeopleService
  ) {
    this.peopleService.people$.subscribe(
      (people: Person[]) => {
        this.deriveEventsFromPeople(people);
      }
    );
  }

  private deriveEventsFromPeople(people: Person[]): void {
    const events: RecurringEvent[] = [];

    for (const person of people) {
      // Skip spouse records (-S) to avoid duplicates
      if (person.id.endsWith('-S')) continue;

      // Birthday event
      if (person.birthday && person.birthday.year > 0) {
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

      // Anniversary event
      if (person.anniversaryDate) {
        const spouse = people.find(p => p.id === person.spouseId);
        const title = spouse
          ? this.getAnniversaryTitle(person, spouse)
          : this.getPersonFullName(person);

        const event = new RecurringEvent();
        event.id = `anniv-${person.id}`;
        event.type = 'anniversary';
        event.personId = person.id;
        event.personId2 = spouse?.id || null;
        event.title = title;
        event.date = new Date(person.anniversaryDate.year, person.anniversaryDate.month - 1, person.anniversaryDate.day);
        event.start = new Date(event.date);
        event.isLiving = person.isLiving;
        events.push(event);
      }
    }

    this.calendarEventsSource.next(events);
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
      const date = new Date(event.date);
      date.setFullYear(year);
      eventClone.start = new Date(date);
      eventClone.date = new Date(event.date);
      output.push(eventClone);
    }
    return output.sort(this.compareByDate);
  }

  getYearsSince(eventYear: number, currentYear: number): number {
    return currentYear - eventYear;
  }

  private compareByDate(a: RecurringEvent, b: RecurringEvent): number {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  }
}