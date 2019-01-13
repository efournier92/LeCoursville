import { Component, OnInit, Input, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { RecurringEvent } from '../calendar.service';
import { CalendarService } from '../calendar.service';
import * as jsPDF from 'node_modules/jspdf/dist/jspdf.debug.js';
import html2canvas from 'html2canvas';
import { BehaviorSubject, Observable } from 'rxjs';
import { Calendar } from '../calendar';
import { database } from 'firebase';

@Component({
  selector: 'app-calendar-printer',
  templateUrl: './calendar-printer.component.html',
  styleUrls: ['./calendar-printer.component.scss']
})
export class CalendarPrinterComponent implements OnInit {
  userName: string;
  viewYears: Array<string>;
  selectedYear: string;
  allCalendars: Array<Calendar>;
  birthdayChecked: boolean = true;
  anniversaryChecked: boolean = true;
  printProgress: number = 0;
  viewDate: Date;
  @Input()
  events: RecurringEvent[];
  startTime: Date;
  private printProgressSource: BehaviorSubject<number> = new BehaviorSubject(0);
  printProgressObservable: Observable<number> = this.printProgressSource.asObservable();
  year: string;

  constructor(
    public dialogRef: MatDialogRef<CalendarPrinterComponent>,
    private calendarService: CalendarService,
    // private calendarPrinter: CalendarPrinterComponent,
    @Inject(MAT_DIALOG_DATA) public data: string,
  ) {
    this.viewYears = this.calendarService.getViewYears();
    this.selectedYear = new Date().getFullYear().toString();
    this.calendarService.calendarsObservable.subscribe(
      (calendars: Array<Calendar>) => {
        this.allCalendars = calendars;
      }
    )
  }

  ngOnInit() {
    this.viewDate = new Date('February 1, ' + 1999);

  }

  printFromHtml() {
    this.printPdf(this.selectedYear).subscribe(
      (progress: number) => {
        this.printProgress = progress;
      }
    );
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  updateEvents(events: RecurringEvent[], year: string, birthdays: boolean, anniversaries: boolean): void {
    if (!events)
      return;
    console.log(this.data.events)
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

  updatePrintProgress(progress: number) {
    this.printProgressSource.next(progress);
  }

  printPdf(year: string): Observable<number> {
    this.year = year;
    this.viewDate = new Date('February 1, ' + year);
    let pdf = new jsPDF('l', 'mm', 'letter');

    this.captureNextOrSave(pdf, true)

    return this.printProgressObservable;
  }

  captureNextOrSave(pdf: jsPDF, isFirst: boolean): void {
    if (this.viewDate.getFullYear() !== +this.year + 1) {
      if (!isFirst)
        pdf.addPage();
      this.viewDate = new Date(this.viewDate.setMonth(this.viewDate.getMonth() + 1))
      this.updateEvents(this.events, this.year, true, true);
      this.capturePage(pdf);
      let progress = Math.floor((pdf.internal.getNumberOfPages() / 12) * 100);
      this.updatePrintProgress(progress);
    } else {
      pdf.save();
    }
  }

  capturePage(pdf: any) {
    let data = document.getElementById('calendar-print-view');
    console.log(data);
    html2canvas(data).then(
      (canvas: any) => {
        let imgHeight = pdf.internal.pageSize.getHeight() - 30;
        let imgWidth = canvas.width * imgHeight / canvas.height;
        if (imgHeight > 220) {
          imgHeight = 220;
          imgWidth = canvas.width / imgHeight * canvas.height;
        }
        const contentDataURL = canvas.toDataURL('image/png');
        let leftMargin = (pdf.internal.pageSize.getWidth() - imgWidth) / 2;
        let topMargin = (pdf.internal.pageSize.getHeight() - imgHeight) / 2;
        pdf.addImage(contentDataURL, 'PNG', leftMargin, topMargin, imgWidth, imgHeight);
        this.captureNextOrSave(pdf, false);
      }
    );
  }
}
