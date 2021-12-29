import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { CalendarView } from 'angular-calendar';
import { Subject } from 'rxjs';
import { CalendarDialogComponent } from 'src/app/components/calendar-dialog/calendar-dialog.component';
import { CalendarService, Months } from 'src/app/services/calendar.service';
import { Calendar } from 'src/app/models/calendar';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { CalendarPrinterComponent } from 'src/app/components/calendar-printer/calendar-printer.component';
import { ConfirmPromptService } from 'src/app/services/confirm-prompt.service';
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
  years: string[];
  viewDate: Date = new Date();
  viewMonth: string;
  selectedYear: number;
  allEvents: RecurringEvent[] = new Array<RecurringEvent>();
  events: RecurringEvent[] = new Array<RecurringEvent>();
  showBirthdays = true;
  showAnniversaries = true;
  allCalendars: Array<Calendar>;

  constructor(
    public auth: AuthService,
    public dialog: MatDialog,
    public printerPrompt: MatDialog,
    public http: HttpClient,
    private calendarService: CalendarService,
    private confirmPrompt: ConfirmPromptService,
    private analyticsService: AnalyticsService,
  ) { }

  ngOnInit(): void {
    this.years = this.calendarService.getViewYears();
    const now = new Date();
    this.selectedYear = now.getFullYear();
    const monthIndex: number = now.getMonth();
    this.viewMonth = this.months[monthIndex];
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    );
    this.calendarService.calendarEventsObservable.subscribe(
      (events: RecurringEvent[]) => {
        this.allEvents = events;
        this.updateEvents(events, this.selectedYear, this.showBirthdays, this.showAnniversaries);
      }
    );
    this.calendarService.calendarsObservable.subscribe(
      (calendars: Array<Calendar>) => {
        this.allCalendars = calendars;
      }
    );
  }

  toggleBirthdays($event: any): void {
    const showBirthdays = $event.checked;
    this.updateEvents(this.allEvents, this.selectedYear, showBirthdays, this.showAnniversaries);
    this.analyticsService.logEvent('calendar_birthdays_toggle', $event);
  }

  toggleAnniversaries($event: any): void {
    const showAnniversaries = $event.checked;
    this.updateEvents(this.allEvents, this.selectedYear, this.showBirthdays, showAnniversaries);
    this.analyticsService.logEvent('calendar_anniversaires_toggle', $event);
  }

  changeViewMonth($event: any): void {
    const monthName = $event.value;
    this.viewDate = new Date(monthName + '1,' + this.selectedYear);
    this.analyticsService.logEvent('calendar_view_month_change', $event);
  }

  changeSelectedYear($event: any): void {
    this.selectedYear = $event.value;
    this.viewDate = new Date(this.viewMonth + '1,' + this.selectedYear);
    this.updateEvents(this.events, this.selectedYear, this.showBirthdays, this.showAnniversaries);
    this.analyticsService.logEvent('calendar_selected_year_change', $event);
  }

  changeView(date: Date): void {
    this.viewMonth = this.months[date.getMonth()];
    const selectedYear = date.getFullYear();
    if (selectedYear !== this.selectedYear) {
      this.selectedYear = selectedYear;
      this.updateEvents(this.events, selectedYear, this.showBirthdays, this.showAnniversaries);
    }
    this.analyticsService.logEvent('calendar_change_view', date);
  }

  updateEvents(events: RecurringEvent[], year: number, birthdays: boolean, anniversaries: boolean): void {
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

  private refreshCalendarView(): void {
    this.refresh.next();
  }

  openDialog(event: any): void {
    const dialogRef = this.dialog.open(CalendarDialogComponent, {
      data: event,
    });
    dialogRef.afterClosed().subscribe(
      (result: RecurringEvent) => {
        if (!result) { return; }
        const confirmPrompRef = this.confirmPrompt.openDialog(
          'Are You Sure?',
          'Do you want to add this event to LeCoursville?',
        );
        confirmPrompRef.afterClosed().subscribe(
          (confirmedAction: boolean) => {
            if (confirmedAction) {
              if (result.id) {
                this.calendarService.updateCalendarEvent(result);
              } else {
                this.calendarService.addCalendarEvent(result);
              }
              this.refreshCalendarView();
            }
          }
        );
      }
    );
  }

  newEvent(): void {
    const event = new Object as RecurringEvent;
    event.isLiving = true;
    this.openDialog(event);
    this.analyticsService.logEvent('calendar_create_new_event', event);
  }

  saveEvents(): void {
    for (const event of this.events) {
      this.calendarService.addCalendarEvent(event);
    }
    this.analyticsService.logEvent('calendar_save_events', {});
  }

  printPdf(): void {
    this.openPrintControlsPrompt();
  }

  openPrintControlsPrompt(): void {
    this.printerPrompt.open(CalendarPrinterComponent, {
      data: { events: this.allEvents },
    });
  }
}
