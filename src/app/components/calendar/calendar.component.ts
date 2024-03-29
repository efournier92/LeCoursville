import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { CalendarView } from 'angular-calendar';
import { Subject } from 'rxjs';
import { CalendarService, Months } from 'src/app/services/calendar.service';
import { Calendar } from 'src/app/models/calendar';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { CalendarPrinterComponent } from 'src/app/components/calendar-printer/calendar-printer.component';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements OnInit {
  @Output() refreshView = new EventEmitter();

  refresh: Subject<any> = new Subject();
  user: User;
  view = CalendarView.Month;
  months: string[] = Months;
  years: number[];
  viewDate: Date = new Date();
  viewMonth: string;
  selectedYear: number;
  allEvents: RecurringEvent[] = [];
  events: RecurringEvent[] = [];
  showBirthdays = true;
  showAnniversaries = true;
  showNotLiving = false;
  allCalendars: Calendar[];

  constructor(
    public authService: AuthService,
    public dialog: MatDialog,
    public printerPrompt: MatDialog,
    public http: HttpClient,
    private calendarService: CalendarService,
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE

  ngOnInit(): void {
    this.initializeDates();

    this.subscribeToUserObservable();

    this.subscribeToCalendarEventsObservable();

    this.subscribeToCalendarsObservable();

    this.analyticsService.logEvent('component_load_calendar',
      { viewDate: this?.viewDate.toString() });
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  private subscribeToCalendarEventsObservable(): void {
    this.calendarService.calendarEventsObservable.subscribe(
      (events: RecurringEvent[]) => {
        this.allEvents = events;
        this.events = this.calendarService.updateEvents(events, this.selectedYear, this.showBirthdays, this.showAnniversaries, this.showNotLiving);
      }
    );
  }

  private subscribeToCalendarsObservable(): void {
    this.calendarService.calendarsObservable.subscribe(
      (calendars: Calendar[]) => {
        this.allCalendars = calendars;
      }
    );
  }

  // PUBLIC METHODS

  toggleBirthdays(event: any): void {
    const showBirthdays = event.checked;
    this.events = this.calendarService.updateEvents(this.allEvents, this.selectedYear, showBirthdays, this.showAnniversaries, this.showNotLiving);
    this.analyticsService.logEvent('calendar_toggle_birthdays', {
      isTrue: event?.checked, userId: this.user?.id,
    });
  }

  toggleAnniversaries(event: any): void {
    const showAnniversaries = event.checked;
    this.events = this.calendarService.updateEvents(this.allEvents, this.selectedYear, this.showBirthdays, showAnniversaries, this.showNotLiving);
    this.analyticsService.logEvent('calendar_toggle_anniversaries', {
      isTrue: event?.checked, userId: this.user?.id,
    });
  }

  toggleNotLiving(event: any): void {
    const showNotLiving = event.checked;
    this.events = this.calendarService.updateEvents(this.allEvents, this.selectedYear, this.showBirthdays, this.showAnniversaries, showNotLiving);
    this.analyticsService.logEvent('calendar_toggle_notLiving', {
      isTrue: event?.checked, userId: this.user?.id,
    });
  }

  changeViewMonth(event: any): void {
    const monthName = event.value;
    this.viewDate = new Date(monthName + '1,' + this.selectedYear);
    this.analyticsService.logEvent('calendar_change_view_month', {
      value: event?.value, date: this.viewDate.toString(),
      userId: this.user?.id,
    });
  }

  changeSelectedYear(event: any): void {
    this.selectedYear = event.value;
    this.viewDate = new Date(this.viewMonth + '1,' + this.selectedYear);
    this.events = this.calendarService.updateEvents(this.events, this.selectedYear, this.showBirthdays, this.showAnniversaries, this.showNotLiving);
    this.analyticsService.logEvent('calendar_change_selected_year', {
      value: event?.value, date: this.viewDate.toString(),
      userId: this.user?.id,
    });
  }

  changeView(date: Date): void {
    this.viewMonth = this.months[date.getMonth()];
    const selectedYear = date.getFullYear();
    if (selectedYear !== this.selectedYear) {
      this.selectedYear = selectedYear;
      this.events = this.calendarService.updateEvents(this.events, selectedYear, this.showBirthdays, this.showAnniversaries, this.showNotLiving);
    }
    this.analyticsService.logEvent('calendar_change_selected_year', {
      newDate: date.toString(),
      isTrue: `Birthdays: ${this.showBirthdays}; Anniversaries: ${this.showAnniversaries}`,
      userId: this.user?.id,
    });
  }

  printPdf(): void {
    this.printerPrompt.open(CalendarPrinterComponent, {
      data: { events: this.allEvents },
    });
    this.analyticsService.logEvent('calendar_open_print_dialog', {
      date: this.viewDate.toString(),
      isTrue: `Birthdays: ${this.showBirthdays}; Anniversaries: ${this.showAnniversaries}`,
      userId: this.user?.id,
    });
  }

  // HELPERS

  private initializeDates(): void {
    this.years = this.calendarService.getViewYears();

    const now = new Date();
    this.selectedYear = now.getFullYear();

    const monthIndex: number = now.getMonth();
    this.viewMonth = this.months[monthIndex];
  }
}
