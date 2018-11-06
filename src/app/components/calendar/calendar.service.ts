import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { RecurringEvent } from './calendar';
import { AngularFireList, AngularFireDatabase } from '@angular/fire/database';
import { AngularFireStorage } from '@angular/fire/storage';

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
}
