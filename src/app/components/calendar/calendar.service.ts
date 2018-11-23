import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CalendarEvent } from 'angular-calendar';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/database';

export interface RecurringEvent extends CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: string;
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

  updateCalendarEvent(event: RecurringEvent): void {
    this.calendarEvents.update(event.id, event);
  }

  deleteCalendarEvent(event: RecurringEvent): void {
    this.calendarEvents.remove(event.id);
  }

  getViewYears(): number[] {
    const thisYear: number = new Date().getFullYear();
    let year = thisYear - 1;
    let years: number[] = [];
    for (let i = 0; i < 3; i++) {
      years.push(year);
      year += 1;
    }
    return years;
  }
  
}
