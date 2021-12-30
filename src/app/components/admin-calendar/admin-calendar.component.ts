import { Component, OnInit } from '@angular/core';
import { CalendarEvent } from 'angular-calendar';
import { CalendarConstants } from 'src/app/constants/calendar-constants';
import { RecurringEvent } from 'src/app/interfaces/RecurringEvent';
import { CalendarService } from 'src/app/services/calendar.service';

@Component({
  selector: 'app-admin-calendar',
  templateUrl: './admin-calendar.component.html',
  styleUrls: ['./admin-calendar.component.scss']
})
export class AdminCalendarComponent implements OnInit {
  events: RecurringEvent[];
  eventTypes: string[] = CalendarConstants.EventTypes;

  constructor(
    private calendarService: CalendarService,
  ) { }

  // LIFECYCLE EVENTS

  ngOnInit(): void {
    this.calendarService.calendarEventsObservable.subscribe(
      (events: RecurringEvent[]) => {
        this.events = this.sortEvents(events);
      }
    );
  }

  // PUBLIC METHODS

  onAddEvent(): void {
    const event = new RecurringEvent();
    this.events.unshift(event);
  }

  onCreateEvent(event: RecurringEvent): void {
    this.calendarService.createCalendarEvent(event);
  }

  onSaveEvent(event: RecurringEvent): void {
    this.calendarService.updateCalendarEvent(event);
  }

  onDeleteEvent(event: RecurringEvent): void {
    this.calendarService.deleteCalendarEvent(event);
  }

  // HELPER METHODS

  private sortEvents(events: RecurringEvent[]): RecurringEvent[] {
    return events.sort(this.compareEventsByTimestamp);
  }

  private compareEventsByTimestamp(a: RecurringEvent, b: RecurringEvent): number {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  }
}
