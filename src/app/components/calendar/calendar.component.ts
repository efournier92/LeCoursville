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
import { RecurringEvent } from 'src/app/interfaces/RecurringEvent';

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
  allEvents: RecurringEvent[] = new Array<RecurringEvent>();
  events: RecurringEvent[] = new Array<RecurringEvent>();
  showBirthdays = true;
  showAnniversaries = true;
  allCalendars: Array<Calendar>;

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

    this.subscribeTocalendarEventsObservable();

    this.subscribeToCalendarsObservable();

    this.analyticsService.logEvent('component_load_calendar', { viewDate: this.viewDate, selectedYear: this.selectedYear });
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  private subscribeTocalendarEventsObservable(): void {
    this.calendarService.calendarEventsObservable.subscribe(
      (events: RecurringEvent[]) => {
        this.allEvents = events;
        this.updateEvents(events, this.selectedYear, this.showBirthdays, this.showAnniversaries);
      }
    );
  }

  private subscribeToCalendarsObservable(): void {
    this.calendarService.calendarsObservable.subscribe(
      (calendars: Array<Calendar>) => {
        this.allCalendars = calendars;
      }
    );
  }

  // PUBLIC METHODS

  toggleBirthdays($event: any): void {
    const showBirthdays = $event.checked;
    this.updateEvents(this.allEvents, this.selectedYear, showBirthdays, this.showAnniversaries);
    this.analyticsService.logEvent('calendar_toggle_birthdays', { user: this.user, event: $event, isChecked: $event.checked });
  }

  toggleAnniversaries($event: any): void {
    const showAnniversaries = $event.checked;
    this.updateEvents(this.allEvents, this.selectedYear, this.showBirthdays, showAnniversaries);
    this.analyticsService.logEvent('calendar_toggle_anniversaries', { user: this.user, event: $event, isChecked: $event.checked });
  }

  changeViewMonth($event: any): void {
    const monthName = $event.value;
    this.viewDate = new Date(monthName + '1,' + this.selectedYear);
    this.analyticsService.logEvent('calendar_change_view_month', { user: this.user, event: $event, newMonth: $event.value });
  }

  changeSelectedYear($event: any): void {
    this.selectedYear = $event.value;
    this.viewDate = new Date(this.viewMonth + '1,' + this.selectedYear);
    this.updateEvents(this.events, this.selectedYear, this.showBirthdays, this.showAnniversaries);
    this.analyticsService.logEvent('calendar_change_selected_year', { user: this.user, event: $event, newYear: $event.value });
  }

  changeView(date: Date): void {
    this.viewMonth = this.months[date.getMonth()];
    const selectedYear = date.getFullYear();
    if (selectedYear !== this.selectedYear) {
      this.selectedYear = selectedYear;
      this.updateEvents(this.events, selectedYear, this.showBirthdays, this.showAnniversaries);
    }
    this.analyticsService.logEvent('calendar_change_selected_year', {
      user: this.user, newDate: date, selectedYear: this.selectedYear,
      isShowingBirthdays: this.showBirthdays, isShowingAnniversaries: this.showAnniversaries
    });
  }

  printPdf(): void {
    this.printerPrompt.open(CalendarPrinterComponent, {
      data: { events: this.allEvents },
    });
    this.analyticsService.logEvent('calendar_open_print_dialog', {
      user: this.user, selectedYear: this.selectedYear, isShowingBirthdays: this.showBirthdays,
      isShowingAnniversaries: this.showAnniversaries });
  }

  private updateEvents(events: RecurringEvent[], year: number, birthdays: boolean, anniversaries: boolean): void {
    this.events = new Array<RecurringEvent>();
    for (const event of events) {
      if (event.type === 'birth' && birthdays === false) {
        continue;
      }
      if (event.type === 'anniversary' && anniversaries === false) {
        continue;
      }
      const date = new Date(event.date);
      date.setFullYear(year);
      event.start = date;
      event.date = new Date(event.date);
      this.events.push(event);
    }
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
