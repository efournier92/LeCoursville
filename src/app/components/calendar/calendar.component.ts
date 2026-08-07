import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { CalendarView } from 'angular-calendar';
import { Subject } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { CalendarService, Months } from 'src/app/services/calendar.service';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { CalendarPrinterComponent } from 'src/app/components/calendar-printer/calendar-printer.component';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';
import { PersonDetailModalComponent } from 'src/app/components/person-detail-modal/person-detail-modal.component';

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
  selectedPersonId: string | null = null;
  datePickerOpen = false;
  pickerDate: Date;
  pickerYear: number;

  constructor(
    public authService: AuthService,
    public dialog: MatDialog,
    public printerPrompt: MatDialog,
    public http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private calendarService: CalendarService,
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE

  ngOnInit(): void {
    this.initializeDates();

    this.subscribeToUserObservable();

    this.subscribeToCalendarEventsObservable();

    this.subscribeToQueryParams();

    this.pickerDate = new Date(this.selectedYear, this.months.indexOf(this.viewMonth), 1);
    this.pickerYear = this.selectedYear;

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

  private subscribeToQueryParams(): void {
    this.route.queryParamMap.subscribe(queryParams => {
      const selected = queryParams.get('selected');
      this.selectedPersonId = selected || null;

      const monthParam = queryParams.get('month');
      const yearParam = queryParams.get('year');

      if (monthParam && /^\d{1,2}$/.test(monthParam)) {
        const monthIndex = parseInt(monthParam) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          this.viewMonth = this.months[monthIndex];
        }
      }
      if (yearParam && /^\d{4}$/.test(yearParam)) {
        this.selectedYear = parseInt(yearParam);
      }

      if (monthParam || yearParam) {
        this.viewDate = new Date(this.selectedYear, this.months.indexOf(this.viewMonth), 1);
        this.events = this.calendarService.updateEvents(this.allEvents, this.selectedYear, this.showBirthdays, this.showAnniversaries, this.showNotLiving);
      }
    });
  }

  // PUBLIC METHODS

  openPersonModal(personId: string | null): void {
    if (!personId) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { selected: personId },
      queryParamsHandling: 'merge'
    });
  }

  closeModal(): void {
    this.selectedPersonId = null;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { selected: null },
      queryParamsHandling: 'merge'
    });
  }

  isCurrentPickerMonth(index: number): boolean {
    return this.months[index] === this.viewMonth && this.pickerYear === this.selectedYear;
  }

  selectPickerMonth(monthIndex: number): void {
    this.viewMonth = this.months[monthIndex];
    this.viewDate = new Date(this.pickerYear, monthIndex, 1);
    this.selectedYear = this.pickerYear;
    this.datePickerOpen = false;
    this.events = this.calendarService.updateEvents(this.allEvents, this.pickerYear, this.showBirthdays, this.showAnniversaries, this.showNotLiving);
    this.updateQueryParams();
  }

  navigateYear(direction: number): void {
    this.pickerYear += direction;
  }

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

  changeView(date: Date): void {
    this.viewMonth = this.months[date.getMonth()];
    const selectedYear = date.getFullYear();
    if (selectedYear !== this.selectedYear) {
      this.selectedYear = selectedYear;
      this.events = this.calendarService.updateEvents(this.allEvents, selectedYear, this.showBirthdays, this.showAnniversaries, this.showNotLiving);
    }
    this.updateQueryParams();
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

  private updateQueryParams(): void {
    const monthNum = this.months.indexOf(this.viewMonth) + 1;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { month: monthNum, year: this.selectedYear },
      queryParamsHandling: 'merge'
    });
  }

  // HELPERS

  private initializeDates(): void {
    this.years = this.calendarService.getViewYears();

    const now = new Date();
    this.selectedYear = now.getFullYear();
    this.viewDate = new Date();

    const monthIndex: number = now.getMonth();
    this.viewMonth = this.months[monthIndex];
  }
}