import { Component, Output, EventEmitter } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { CalendarView } from 'angular-calendar';
import { Subject } from 'rxjs';
import { CalendarDialogComponent } from 'src/app/components/calendar/calendar-dialog/calendar-dialog.component';
import { CalendarService, Months } from 'src/app/services/calendar.service'
import { RecurringEvent } from 'src/app/services/calendar.service';
import { Calendar } from 'src/app/models/calendar';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';
import { CalendarPrinterComponent } from 'src/app/components/calendar/calendar-printer/calendar-printer.component';
import { ConfirmPromptService } from 'src/app/services/confirm-prompt.service';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent {
  @Output()
  refreshView = new EventEmitter();
  user: User;
  view = CalendarView.Month;
  months: string[] = Months;
  years: string[];
  viewDate: Date = new Date();
  viewMonth: string;
  viewYear: string;
  allEvents: RecurringEvent[] = new Array<RecurringEvent>();
  events: RecurringEvent[] = new Array<RecurringEvent>();
  printViewDate = new Date(`01-01-2018`);
  refresh: Subject<any> = new Subject();
  showBirthdays: boolean = true;
  showAnniversaries: boolean = true;
  uploadedCalendarYear: string;
  allCalendars: Array<Calendar>;

  constructor(
    public auth: AuthService,
    public dialog: MatDialog,
    public printerPrompt: MatDialog,
    public http: HttpClient,
    private calendarService: CalendarService,
    private confirmPrompt: ConfirmPromptService,
  ) { }

  ngOnInit(): void {
    this.years = this.calendarService.getViewYears();
    const now = new Date();
    this.viewYear = now.getFullYear().toString();
    const monthIndex: number = now.getMonth();
    let monthName = this.months[monthIndex];
    this.viewMonth = monthName;
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    )
    this.calendarService.calendarEventsObservable.subscribe(
      (events: RecurringEvent[]) => {
        this.allEvents = events;
        this.updateEvents(events, this.viewYear, this.showBirthdays, this.showAnniversaries);
      }
    )
    this.calendarService.calendarsObservable.subscribe(
      (calendars: Array<Calendar>) => {
        this.allCalendars = calendars;
      }
    )
  }

  toggleBirthdays($event): void {
    let showBirthdays = $event.checked;
    this.updateEvents(this.allEvents, this.viewYear, showBirthdays, this.showAnniversaries);
  }

  toggleAnniversaries($event): void {
    let showAnniversaries = $event.checked;
    this.updateEvents(this.allEvents, this.viewYear, this.showBirthdays, showAnniversaries);
  }

  changeViewMonth($event): void {
    let monthName = $event.value;
    this.viewDate = new Date(monthName + '1,' + this.viewYear);
  }

  changeViewYear($event): void {
    let year = $event.value;
    this.viewDate = new Date(this.viewMonth + '1,' + year);
    this.updateEvents(this.events, year, this.showBirthdays, this.showAnniversaries);
  }

  changeView(viewDate): void {
    this.viewMonth = this.months[viewDate.getMonth()];
    let viewYear = viewDate.getFullYear().toString();
    if (viewYear !== this.viewYear) {
      this.viewYear = viewYear;
      this.updateEvents(this.events, viewYear, this.showBirthdays, this.showAnniversaries);
    }
  }

  updateEvents(events: RecurringEvent[], year: string, birthdays: boolean, anniversaries: boolean): void {
    this.events = new Array<RecurringEvent>();
    for (const event of events) {
      if (event.type === 'birth' && birthdays === false)
        continue;
      if (event.type === 'anniversary' && anniversaries === false)
        continue;
      let date = new Date(event.date);
      date.setFullYear(+year);
      event.start = date;
      event.date = new Date(event.date);
      this.events.push(event);
    }
  }

  private refreshCalendarView(): void {
    this.refresh.next();
  }

  openDialog(event): void {
    const dialogRef = this.dialog.open(CalendarDialogComponent, {
      data: event,
    });
    dialogRef.afterClosed().subscribe(
      (result: RecurringEvent) => {
        if (!result) return;
        const confirmPrompRef = this.confirmPrompt.openDialog(
          "Are You Sure?",
          "Do you want to add this event to LeCoursville?",
        );
        confirmPrompRef.afterClosed().subscribe(
          (confirmedAction: boolean) => {
            if (confirmedAction) {
              let event = result;
              if (event.id) {
                this.calendarService.updateCalendarEvent(event);
              } else {
                this.calendarService.addCalendarEvent(event);
              }
              this.refreshCalendarView;
            }
          }
        )
      }
    )
  }

  uploadCalendar($event): void {
    const selectedYearCalendar: Calendar = this.allCalendars.find(
      (calendar: Calendar) => {
        return calendar.year === this.uploadedCalendarYear;
      }
    );
    if (selectedYearCalendar) {
      this.calendarService.updateCalendar($event.currentTarget.files[0], selectedYearCalendar);
    } else {
      this.calendarService.addCalendar($event.currentTarget.files[0], this.uploadedCalendarYear);
    }
  }

  newEvent(): void {
    let event = new Object as RecurringEvent;
    event.isLiving = true;
    this.openDialog(event);
  }

  saveEvents(): void {
    for (const event of this.events) {
      this.calendarService.addCalendarEvent(event);
    }
  }

  openPrintControlsPrompt(): void {
    this.printerPrompt.open(CalendarPrinterComponent, {
      data: { events: this.allEvents },
    });
  }

  printPdf(): void {
    this.openPrintControlsPrompt();
    // this.calendarPrinterService.printPdf();
  }

  addCalendar(event: any): void {
    for (let file of event.currentTarget.files) {
      this.calendarService.addCalendarEvent(file)
    }
  }
}
