import { Component } from '@angular/core';
import { CalendarEvent, CalendarView } from 'angular-calendar';
import * as jspdf from 'jspdf';
import html2canvas from 'html2canvas';
import { MatDialog } from '@angular/material';
import { CalendarDialogComponent } from './calendar-dialog/calendar-dialog.component';
import { CalendarService } from './calendar.service'
import { Subject } from 'rxjs';

// FIX
// Bruce Emerson (Birthday)
interface RecurringEvent extends CalendarEvent {
  title: string;
  color: any;
  date: Date;
  type: string;
  rrule?: {
    freq: any;
    bymonth?: number;
    bymonthday?: number;
    byweekday?: any;
  };
}

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent {
  view = CalendarView.Month;
  viewDate = new Date();
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
        for (const event of events) {
          let thisYear = new Date().getFullYear();
          let date = new Date(event.date);
          date.setFullYear(thisYear);
          event.start = date;
          event.date = new Date(event.date);
          this.events.push(event);
        }
        console.log(this.events);
        this.refreshView();
      }
    )
  }

  private refreshView(): void {
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
  animal: string;
  name: string;

  openDialog(): void {
    const dialogRef = this.dialog.open(CalendarDialogComponent, {
      width: '250px',
      data: { name: this.name, animal: this.animal }
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
      this.animal = result;
    });
  }

  saveEvents(): void {
    for (const event of this.events) {
      this.calendarService.addCalendarEvent(event);
    }
  }

}
