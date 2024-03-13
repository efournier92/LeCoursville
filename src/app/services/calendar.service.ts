import { Injectable } from '@angular/core';
import {
  AngularFireList,
  AngularFireDatabase,
} from '@angular/fire/compat/database';
import { BehaviorSubject } from 'rxjs';
import { Calendar } from 'src/app/models/calendar';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';
import { PromptModalService } from 'src/app/services/prompt-modal.service';

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
  photoUpload: boolean;
  message: any;
  parent: any;
  messageService: any;
  constructor(
    private db: AngularFireDatabase,
    private promptModal: PromptModalService,
  ) {
    this.getCalendarEvents()
      .valueChanges()
      .subscribe((calendarEvents: RecurringEvent[]) => {
        this.updateCalendarEventsEvent(calendarEvents);
      });
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
    const dialogRef = this.promptModal.openDialog(
      'Are You Sure?',
      'Do you really want to remove this calendar event?',
    );
    dialogRef.afterClosed().subscribe((didUserConfirm: boolean) => {
      if (didUserConfirm) {
        this.calendarEvents.remove(event.id);
      }
    });
  }
  saveMessageWithPhoto(newMessage: any) {
    throw new Error('Method not implemented.');
  }
  markMessageSaved(newMessage: any): any {
    throw new Error('Method not implemented.');
  }
  updateParent() {
    throw new Error('Method not implemented.');
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
  updateEvents(
    events: RecurringEvent[],
    year: number,
    birthdays: boolean,
    anniversaries: boolean,
    notLiving: boolean,
  ): RecurringEvent[] {
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

  private compareMessagesByTimestamp(
    a: RecurringEvent,
    b: RecurringEvent,
  ): number {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  }
}
