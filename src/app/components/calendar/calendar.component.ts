import { Component } from '@angular/core';
import { CalendarView } from 'angular-calendar';
import * as jspdf from 'jspdf';
import html2canvas from 'html2canvas';
import { MatDialog } from '@angular/material';
import { CalendarDialogComponent } from './calendar-dialog/calendar-dialog.component';
import { CalendarService, Months } from './calendar.service'
import { Subject } from 'rxjs';
import { RecurringEvent } from './calendar';

// FIX
// Bruce Emerson (Birthday)

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent {
  view = CalendarView.Month;
  months: string[] = Months;
  years: number[];
  viewDate: Date = new Date();
  viewMonth: string;
  viewYear: string;
  allEvents: RecurringEvent[] = new Array<RecurringEvent>();
  events: RecurringEvent[] = new Array<RecurringEvent>();
  printViewDate = new Date(`01-01-2018`);
  refresh: Subject<any> = new Subject();
  showBirthdays: boolean = true;
  showAnniversaries: boolean = true;

  constructor(
    public dialog: MatDialog,
    private calendarService: CalendarService,
  ) { }

  ngOnInit(): void {
    this.years = this.calendarService.getViewYears();
    const now = new Date();
    this.viewYear = now.getFullYear().toString();
    const monthIndex: number = now.getMonth();
    let monthName = this.months[monthIndex];
    this.viewMonth = monthName;
    this.calendarService.calendarsObservable.subscribe(
      (events: RecurringEvent[]) => {
        this.allEvents = events;
        this.updateEvents(events, this.viewYear, this.showBirthdays, this.showAnniversaries);
      }
    )
  }

  toggleBirthdays($event) {
    let showBirthdays = $event.checked;
    this.updateEvents(this.allEvents, this.viewYear, showBirthdays, this.showAnniversaries);
  }

  toggleAnniversaries($event) {
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

  updateEvents(events: RecurringEvent[], year: string, birthdays: boolean, anniversaries: boolean) {
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

  changeView(viewDate) {
    this.viewMonth = this.months[viewDate.getMonth()];
    let viewYear = viewDate.getFullYear();
    if (viewYear !== this.viewYear) {
      this.viewYear = viewYear;
      this.updateEvents(this.events, viewYear, this.showBirthdays, this.showAnniversaries);
    }
  }

  private refreshCalendarView(): void {
    this.refresh.next();
  }

  getYearsSince(event, date) {
    let eventYear: number = event.date.getUTCFullYear();
    this.calendarService.getYearsSince(eventYear, date);
  }

  public printPdf() {
    const year = new Date().getFullYear();
    let month = 0;
    this.printViewDate = new Date(`${month}-01-${year}`);
    var data = document.getElementById('calendarView');
    html2canvas(data).then(canvas => {
      // Few necessary setting options  
      var imgWidth = 208;
      var pageHeight = 295;
      var imgHeight = canvas.height * imgWidth / canvas.width;
      var heightLeft = imgHeight;

      const contentDataURL = canvas.toDataURL('image/png')
      let doc = new jspdf('l', 'mm', 'letter'); // A4 size page of PDF
      var width = doc.internal.pageSize.width;
      var height = doc.internal.pageSize.height;
      var position = 0;
      doc.addImage(contentDataURL, 'PNG', 0, position, 270, 210)
      doc.save('MYPdf.pdf'); // Generated PDF   
    });
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

  newEvent(): void {
    let event = new Object as RecurringEvent;
    this.openDialog(event);
  }

  saveEvents(): void {
    for (const event of this.events) {
      this.calendarService.addCalendarEvent(event);
    }
  }

}
