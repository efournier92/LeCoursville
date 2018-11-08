import { Component } from '@angular/core';
import { CalendarEvent, CalendarView } from 'angular-calendar';
import * as jspdf from 'jspdf';
import html2canvas from 'html2canvas';
import { MatDialog } from '@angular/material';
import { CalendarDialogComponent } from './calendar-dialog/calendar-dialog.component';
import { CalendarService } from './calendar.service'
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
  viewDate: Date = new Date();
  viewYear: number;
  events: RecurringEvent[] = new Array<RecurringEvent>();
  printViewDate = new Date(`01-01-2018`);
  refresh: Subject<any> = new Subject();

  constructor(
    public dialog: MatDialog,
    private calendarService: CalendarService,
  ) { }

  ngOnInit(): void {
    this.calendarService.calendarsObservable.subscribe(
      (events: RecurringEvent[]) => {
        this.viewYear = new Date().getFullYear();
        this.updateEvents(events, this.viewYear);
      }
    )
  }

  updateEvents(events: RecurringEvent[], year: number) {
    this.events = new Array<RecurringEvent>();
    for (const event of events) {
      let date = new Date(event.date);
      date.setFullYear(year);
      event.start = date;
      event.date = new Date(event.date);
      this.events.push(event);
    }
  }

  changeView(viewDate) {
    let viewYear = viewDate.getFullYear();
    if (viewYear !== this.viewYear) {
      this.viewYear = viewYear;
      this.updateEvents(this.events, viewYear);
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
