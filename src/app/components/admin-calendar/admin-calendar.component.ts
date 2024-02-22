import { Component, OnInit } from '@angular/core';
import { CalendarEvent } from 'angular-calendar';
import { CalendarConstants } from 'src/app/constants/calendar-constants';
import { RecurringEvent } from 'src/app/interfaces/RecurringEvent';
import { CalendarService } from 'src/app/services/calendar.service';
import { PageEvent } from '@angular/material/paginator';
import { SortSettingsForCalendar } from 'src/app/models/sort-settings-for-calendar';
import { SortingConstants } from 'src/app/constants/sorting-constants';

@Component({
  selector: 'app-admin-calendar',
  templateUrl: './admin-calendar.component.html',
  styleUrls: ['./admin-calendar.component.scss']
})
export class AdminCalendarComponent implements OnInit {
  allEvents: RecurringEvent[];
  filteredEvents: RecurringEvent[];
  displayedEvents: RecurringEvent[];
  eventTypes: string[] = CalendarConstants.EventTypes;
  sortSettings: SortSettingsForCalendar;
  totalFilteredEvents: number;

  constructor(
    private calendarService: CalendarService,
  ) { }

  // LIFECYCLE EVENTS

  ngOnInit(): void {
    this.initializeSortSettings();
    this.calendarService.calendarEventsObservable.subscribe(
      (events: RecurringEvent[]) => {
        this.allEvents = this.sortEvents(events);
        this.displayedEvents = this.refreshDisplayedEvents(this.allEvents, this.sortSettings)
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

  getTotalEvents(): number {
    return this.allEvents.length;
  }

  onUpdatePage(event: PageEvent): void {
    this.sortSettings.currentPageIndex = event.pageIndex;
    this.displayedEvents = this.refreshDisplayedEvents(this.allEvents, this.sortSettings);
  }

  onFilterQueryChange(query: string): void {
    this.sortSettings.filterQuery = query;
    this.sortSettings.currentPageIndex = 0;
    this.displayedEvents = this.refreshDisplayedEvents(this.allEvents, this.sortSettings);
  }

  toggleDisplay(event, toggleId): void {
    let toggle = this.sortSettings.displayToggles.find(toggle => toggle.id === toggleId);

    toggle.isToggled = event.checked;

    this.sortSettings.displayToggleStates[toggle.id] = toggle.isToggled

    this.displayedEvents = this.refreshDisplayedEvents(this.allEvents, this.sortSettings);
  }

  // HELPER METHODS

  private initializeSortSettings(): void {
    const sortDirection = SortingConstants.Directions.descending;
    const sortProperty = SortingConstants.Users.properties.dateLastActive;
    const filterQuery = '';
    const itemsPerPage = 48;
    const currentPageIndex = 0;

    this.sortSettings = new SortSettingsForCalendar(sortDirection, sortProperty.key, filterQuery, itemsPerPage, currentPageIndex);
  }

  private sortEvents(events: RecurringEvent[]): RecurringEvent[] {
    return events.sort(this.compareEventsByTimestamp);
  }

  private compareEventsByTimestamp(a: RecurringEvent, b: RecurringEvent): number {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  }

  private displayItemsPerPage(items: RecurringEvent[], sortSettings: SortSettingsForCalendar): RecurringEvent[] {
    let output: RecurringEvent[];

    const start = sortSettings.currentPageIndex === 0 ? 0 : sortSettings.currentPageIndex * sortSettings.itemsPerPage;
    const end = start + sortSettings.itemsPerPage;

    if (items.length) {
      output = items?.slice(start, end);
    }

    return output;
  }

  private refreshDisplayedEvents(eventsToSort: RecurringEvent[], sortSettings: SortSettingsForCalendar): RecurringEvent[] {
    let events: RecurringEvent[];

    if (!eventsToSort?.length) { return eventsToSort; }

    events = this.filterEvents(eventsToSort, sortSettings?.filterQuery);

    const toggleQuery = this.sortSettings.getToggleQuery()

    events = events.filter(event => eval(toggleQuery))
    events = this.displayItemsPerPage(events, sortSettings);

    return events;
  }

  private filterEvents(eventsToSort: RecurringEvent[], query: string): RecurringEvent[] {
    if (!eventsToSort.length) { return eventsToSort; }

    const output = eventsToSort.filter(
      (event: RecurringEvent) => {
        return this.doesAnyValueIncludeQuery([event.title, event.date.toString()], query);
      }
    );

    this.setTotalEvents(output.length);

    return output;
  }

  setTotalEvents(totalFilteredEvents: number): void {
    this.totalFilteredEvents = totalFilteredEvents;
  }

  doesAnyValueIncludeQuery(values: string[], query: string): boolean {
    let output = false;

    for (const value of values) {
      if (this.doesValueIncludeQuery(value, query)) {
        output = true;
        break;
      }
    }

    return output;
  }

  doesValueIncludeQuery(value: string, query: string): boolean {
    return value.toLowerCase().includes(query.toLocaleLowerCase());
  }
}
