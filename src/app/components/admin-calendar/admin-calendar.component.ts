import { Component, OnInit } from '@angular/core';
import { CalendarEvent } from 'angular-calendar';
import { CalendarConstants } from 'src/app/constants/calendar-constants';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';
import { CalendarService } from 'src/app/services/calendar.service';
import { PageEvent } from '@angular/material/paginator';
import { SortSettingsForCalendar } from 'src/app/models/sort-settings-for-calendar';

@Component({
  selector: 'app-admin-calendar',
  templateUrl: './admin-calendar.component.html',
  styleUrls: ['./admin-calendar.component.scss']
})
export class AdminCalendarComponent implements OnInit {
  allEvents: RecurringEvent[];
  displayedEvents: RecurringEvent[];
  sortSettings: SortSettingsForCalendar;
  eventTypes = CalendarConstants.EventTypes;

  constructor(
    private calendarService: CalendarService,
  ) { }

  // LIFECYCLE EVENTS

  ngOnInit(): void {
    this.initializeSortSettings();
    this.calendarService.calendarEventsObservable.subscribe(
      (events: RecurringEvent[]) => {
        this.allEvents = events;
        this.displayedEvents = this.sortSettings.getItemsToDisplay(this.allEvents);
      }
    );
  }

  // PUBLIC METHODS

  onAddEvent(): void {
    const event = new RecurringEvent();
    this.allEvents.unshift(event);
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

  onUpdatePage(event: PageEvent): void {
    this.sortSettings.currentPageIndex = event.pageIndex;
    this.displayedEvents = this.sortSettings.getItemsToDisplay(this.allEvents);
  }

  onFilterQueryChange(query: string): void {
    this.sortSettings.filterQuery = query;
    this.sortSettings.currentPageIndex = 0;
    this.displayedEvents = this.sortSettings.getItemsToDisplay(this.allEvents);
  }

  toggleDisplay(event, toggleId): void {
    let toggle = this.sortSettings.displayToggles.find(toggle => toggle.id === toggleId);

    toggle.isToggled = event.checked;

    this.sortSettings.displayToggleStates[toggle.id] = toggle.isToggled

    this.displayedEvents = this.sortSettings.getItemsToDisplay(this.allEvents);
  }

  // HELPER METHODS

  private initializeSortSettings(): void {
    this.sortSettings = new SortSettingsForCalendar();
  }
}
