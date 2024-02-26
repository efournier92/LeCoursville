import { Injectable } from '@angular/core';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/compat/database';
import { AngularFireStorageReference, AngularFireStorage, AngularFireUploadTask } from '@angular/fire/compat/storage';
import { BehaviorSubject } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Calendar } from 'src/app/models/calendar';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';

export const Months: string[] = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December',
];

@Injectable({
  providedIn: 'root'
})
export class CalendarService {

  constructor(
    private db: AngularFireDatabase,
    private storage: AngularFireStorage,
  ) {
    this.getCalendarEvents().valueChanges().subscribe(
      (calendarEvents: RecurringEvent[]) => {
        this.updateCalendarEventsEvent(calendarEvents);
      }
    );
    // this.getCalendars().valueChanges().subscribe(
    //   (calendars: Calendar[]) => {
    //     this.updateCalendarsEvent(calendars);
    //   }
    // );
  }
  calendarEvents: AngularFireList<RecurringEvent>;
  calendars: AngularFireList<Calendar>;

  private calendarEventsSource = new BehaviorSubject([]);
  calendarEventsObservable = this.calendarEventsSource.asObservable();

  private calendarsSource = new BehaviorSubject([]);
  calendarsObservable = this.calendarsSource.asObservable();

  getYearsSince(eventYear: number, selectedYear: number) {
    return +selectedYear - +eventYear;
  }

  formatYearsSinceString(years: number, totalCharacters: number = 3) {
    const charactersInYears = years.toString().length;
    const chractersToAdd = totalCharacters - charactersInYears;
    return ' '.repeat(chractersToAdd) + years;
  }

  updateCalendarEventsEvent(calendarEvents: RecurringEvent[]) {
    this.calendarEventsSource.next(calendarEvents);
  }

  getCalendarEvents(): AngularFireList<object> {
    this.calendarEvents = this.db.list('calendarEvents');
    return this.calendarEvents;
  }

  createCalendarEvent(event: RecurringEvent): void {
    event.id = this.db.createPushId();
    this.calendarEvents.update(event.id, event);
  }

  updateCalendarEvent(event: RecurringEvent): void {
    this.calendarEvents.update(event.id, event);
  }

  deleteCalendarEvent(event: RecurringEvent): void {
    this.calendarEvents.remove(event.id);
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

  // TODO: Take array with birthays, anniversaries, notLiving
  updateEvents(events: RecurringEvent[], year: number, birthdays: boolean, anniversaries: boolean, notLiving: boolean): RecurringEvent[] {
    let output = [];
    for (const event of events) {
      if (event.type === 'birth' && birthdays === false) {
        continue;
      }
      if (event.type === 'anniversary' && anniversaries === false) {
        continue;
      }
      if (!event.isLiving && notLiving === false) {
        continue;
      }
      const date = new Date(event.date);
      date.setFullYear(year);
      event.start = date;
      event.date = new Date(event.date);
      output.push(event);
    }
    output = this.sortEvents(output);
    return output;
  }

  private sortEvents(events: RecurringEvent[]): RecurringEvent[] {
    return events.sort(this.compareMessagesByTimestamp);
  }

  private compareMessagesByTimestamp(a: RecurringEvent, b: RecurringEvent): number {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  }
}
