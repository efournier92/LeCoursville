import { Component, Output, EventEmitter } from '@angular/core';
import { CalendarView } from 'angular-calendar';
import { MatDialog } from '@angular/material';
import { CalendarDialogComponent } from './calendar-dialog/calendar-dialog.component';
import { PrintControlsPrompt } from './print-controls-prompt/print-controls-prompt';
import { CalendarPrinterService } from './calendar-printer/calendar-printer.service';
import { CalendarService, Months } from './calendar.service'
import { Subject } from 'rxjs';
import { RecurringEvent } from './calendar.service';
import { HttpClient } from '@angular/common/http';
import { Calendar } from './calendar';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent {
  @Output()
  refreshView = new EventEmitter();
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
    public dialog: MatDialog,
    public printControlsPrompt: MatDialog,
    public http: HttpClient,
    private calendarService: CalendarService,
  ) { }

  ngOnInit(): void {
    this.years = this.calendarService.getViewYears();
    const now = new Date();
    this.viewYear = now.getFullYear().toString();
    const monthIndex: number = now.getMonth();
    let monthName = this.months[monthIndex];
    this.viewMonth = monthName;
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
    let monthNumber = this.months.indexOf($event.value) + 1;
    this.viewDate = new Date(`${monthNumber}-01-${this.viewYear}`);
  }

  changeViewYear($event): void {
    let year = $event.value;
    this.viewDate = new Date(`${this.viewMonth}-01-${year}`);
    this.updateEvents(this.events, year, this.showBirthdays, this.showAnniversaries);
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

  changeView(viewDate): void {
    this.viewMonth = this.months[viewDate.getMonth()];
    let viewYear = viewDate.getFullYear().toString();
    if (viewYear !== this.viewYear) {
      this.viewYear = viewYear;
      this.updateEvents(this.events, viewYear, this.showBirthdays, this.showAnniversaries);
    }
  }

  private refreshCalendarView(): void {
    this.refresh.next();
  }

  openDialog(event): void {
    const dialogRef = this.dialog.open(CalendarDialogComponent, {
      width: '30%',
      data: event,
    });

    dialogRef.afterClosed().subscribe(
      (result: RecurringEvent) => {
        if (!result) return;
        let event = result;
        if (event.id) {
          this.calendarService.updateCalendarEvent(event);
        } else {
          this.calendarService.addCalendarEvent(event);
        }
        this.refreshCalendarView;
      });
  }

  uploadCalendar($event): void {
    console.log($event.currentTarget.file);
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
    this.openDialog(event);
  }

  saveEvents(): void {
    for (const event of this.events) {
      this.calendarService.addCalendarEvent(event);
    }
  }

  openPrintControlsPrompt(): void {
    const namePromptRef = this.printControlsPrompt.open(PrintControlsPrompt, {
      data: { name: 'this.name', animal: 'this.animal' }
    });

    namePromptRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed', result);
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
