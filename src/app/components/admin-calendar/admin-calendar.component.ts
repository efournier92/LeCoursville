import { Component, OnInit } from '@angular/core';
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

  ngOnInit(): void {
    this.calendarService.calendarEventsObservable.subscribe(
      (calendarEvents: RecurringEvent[]) => {
        this.events = calendarEvents;
      }
    );
  }

  onSaveEvent(event: RecurringEvent): void {
    this.calendarService.updateCalendarEvent(event);
  }

  onDeleteEvent(event: RecurringEvent): void {
    this.calendarService.deleteCalendarEvent(event);
  }

}
