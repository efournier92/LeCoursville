import { Injectable } from '@angular/core';
import { CalendarEvent } from 'angular-calendar';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/database';
import { AngularFireStorageReference, AngularFireStorage, AngularFireUploadTask } from '@angular/fire/storage';
import { BehaviorSubject } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Calendar } from 'src/app/models/calendar';

export interface RecurringEvent extends CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: string;
  isLiving: boolean;
}

export const Months: string[] = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
]

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  calendarEvents: AngularFireList<RecurringEvent>;
  calendars: AngularFireList<Calendar>;

  constructor(
    private db: AngularFireDatabase,
    private storage: AngularFireStorage,
  ) {
    this.getCalendarEvents().valueChanges().subscribe(
      (calendarEvents: RecurringEvent[]) => {
        this.updateCalendarEventsEvent(calendarEvents);
      }
    );
    this.getCalendars().valueChanges().subscribe(
      (calendars: Calendar[]) => {
        this.updateCalendarsEvent(calendars);
      }
    );
  }

  private calendarEventsSource = new BehaviorSubject([]);
  calendarEventsObservable = this.calendarEventsSource.asObservable();

  getYearsSince(eventYear: number) {
    let now: Date = new Date();
    let currentYear = now.getFullYear();
    return currentYear - eventYear;
  }

  updateCalendarEventsEvent(calendarEvents: RecurringEvent[]) {
    this.calendarEventsSource.next(calendarEvents);
  }

  getCalendarEvents(): AngularFireList<Object> {
    this.calendarEvents = this.db.list('calendarEvents');
    return this.calendarEvents;
  }

  private calendarsSource = new BehaviorSubject([]);
  calendarsObservable = this.calendarsSource.asObservable();

  getCalendars(): AngularFireList<Object> {
    this.calendars = this.db.list('calendars');
    return this.calendars;
  }

  addCalendarEvent(event: RecurringEvent): void {
    event.id = this.db.createPushId();
    this.calendarEvents.update(event.id, event);
  }

  updateCalendarsEvent(calendars: Calendar[]) {
    this.calendarsSource.next(calendars);
  }

  addCalendar(file: any, year: string): void {
    let calendar: Calendar = new Calendar();
    calendar.id = this.db.createPushId();
    calendar.year = year;
    calendar.path = `calendars/${year}.pdf`;

    const fileRef: AngularFireStorageReference = this.storage.ref(calendar.path);
    const task: AngularFireUploadTask = this.storage.upload(calendar.path, file);
    task.snapshotChanges().pipe(
      finalize(() => {
        fileRef.getDownloadURL().subscribe(
          url => {
            const calendarDb: AngularFireList<{}> = this.db.list('calendars');
            calendar.url = url;
            calendarDb.set(calendar.id, calendar);
          }
        )
      })
    ).subscribe()
  }

  updateCalendar(file: any, calendar: Calendar): void {
    const fileRef: AngularFireStorageReference = this.storage.ref(calendar.path);
    const task: AngularFireUploadTask = this.storage.upload(calendar.path, file);
    task.snapshotChanges().pipe(
      finalize(() => {
        fileRef.getDownloadURL().subscribe(
          url => {
            calendar.url = url;
            this.calendars.update(calendar.id, calendar);
          }
        )
      })
    ).subscribe()
  }

  updateCalendarEvent(event: RecurringEvent): void {
    this.calendarEvents.update(event.id, event);
  }

  deleteCalendarEvent(event: RecurringEvent): void {
    this.calendarEvents.remove(event.id);
  }

  getViewYears(): Array<string> {
    const thisYear: number = new Date().getFullYear();
    let year = thisYear - 3;
    let years: string[] = [];
    for (let i = 0; i < 7; i++) {
      years.push(year.toString());
      year += 1;
    }
    return years;
  }
}
