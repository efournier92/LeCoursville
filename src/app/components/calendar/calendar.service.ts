import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CalendarEvent } from 'angular-calendar';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/database';
import { Calendar } from './calendar';
import { AngularFireStorageReference, AngularFireStorage, AngularFireUploadTask } from '@angular/fire/storage';
import { finalize } from 'rxjs/operators';

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

  constructor(
    private db: AngularFireDatabase,
    private storage: AngularFireStorage,
  ) {
    this.getCalendarEvents().valueChanges().subscribe(
      (calendarEvents: RecurringEvent[]) => {
        this.updateCalendarEventsEvent(calendarEvents);
      }
    );
  }

  private calendarsSource = new BehaviorSubject([]);
  calendarsObservable = this.calendarsSource.asObservable();

  getYearsSince(eventYear: number) {
    let now: Date = new Date();
    let currentYear = now.getFullYear();
    return currentYear - eventYear;
  }

  updateCalendarEventsEvent(calendarEvents: RecurringEvent[]) {
    this.calendarsSource.next(calendarEvents);
  }

  getCalendarEvents(): AngularFireList<{}> {
    this.calendarEvents = this.db.list('calendarEvents');
    return this.calendarEvents;
  }

  addCalendarEvent(event: RecurringEvent): void {
    event.id = this.db.createPushId();
    this.calendarEvents.update(event.id, event);
  }

  addCalendar(file: any): void {
    let calendar: Calendar = new Calendar();
    calendar.id = this.db.createPushId();
    calendar.path = `calendars/${calendar.id}.pdf`;

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

  updateCalendarEvent(event: RecurringEvent): void {
    this.calendarEvents.update(event.id, event);
  }

  deleteCalendarEvent(event: RecurringEvent): void {
    this.calendarEvents.remove(event.id);
  }

  getViewYears(): number[] {
    const thisYear: number = new Date().getFullYear();
    let year = thisYear - 3;
    let years: number[] = [];
    for (let i = 0; i < 7; i++) {
      years.push(year);
      year += 1;
    }
    return years;
  }
}
