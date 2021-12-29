import { Injectable } from '@angular/core';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/database';
import { AngularFireStorageReference, AngularFireStorage, AngularFireUploadTask } from '@angular/fire/storage';
import { BehaviorSubject } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Calendar } from 'src/app/models/calendar';
import { RecurringEvent } from 'src/app/interfaces/RecurringEvent';

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

  updateCalendarEventsEvent(calendarEvents: RecurringEvent[]) {
    this.calendarEventsSource.next(calendarEvents);
  }

  getCalendarEvents(): AngularFireList<object> {
    this.calendarEvents = this.db.list('calendarEvents');
    return this.calendarEvents;
  }

  addCalendarEvent(event: RecurringEvent): void {
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
}
