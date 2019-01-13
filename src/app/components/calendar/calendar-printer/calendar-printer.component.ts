import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { RecurringEvent } from '../calendar.service';
import { CalendarService } from '../calendar.service';
import * as jsPDF from 'node_modules/jspdf/dist/jspdf.debug.js';
import html2canvas from 'html2canvas';

interface EventsData extends Object {
  events: RecurringEvent[];
}

@Component({
  selector: 'app-calendar-printer',
  templateUrl: './calendar-printer.component.html',
  styleUrls: ['./calendar-printer.component.scss']
})
export class CalendarPrinterComponent implements OnInit {
  viewDate: Date;
  allEvents: RecurringEvent[];
  events: RecurringEvent[];
  viewYears: Array<string>;
  shouldPrintBirthdays: boolean = true;
  shouldPrintAnniversaries: boolean = true;
  selectedYear: string;
  printProgress: number = 0;
  calendarPdf: jsPDF = new jsPDF('l', 'mm', 'letter');

  constructor(
    public dialogRef: MatDialogRef<CalendarPrinterComponent>,
    private calendarService: CalendarService,
    @Inject(MAT_DIALOG_DATA) public data: EventsData,
  ) {
    this.viewYears = this.calendarService.getViewYears();
    this.selectedYear = new Date().getFullYear().toString();
  }

  ngOnInit() {
    this.allEvents = this.data.events;
    this.events = this.allEvents;
    this.viewDate = new Date();
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  updateEvents(events: RecurringEvent[], year: string, birthdays: boolean, anniversaries: boolean): void {
    if (!events)
      return;
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

  updateViewDate() {
    this.viewDate = new Date('January 1, ' + this.selectedYear);
    this.updateEvents(this.allEvents, this.selectedYear, this.shouldPrintBirthdays, this.shouldPrintAnniversaries);
  }

  printPdf() {
    this.viewDate = new Date('January 1, ' + this.selectedYear);
    this.updateEvents(this.allEvents, this.selectedYear, this.shouldPrintBirthdays, this.shouldPrintAnniversaries);
    this.captureNextOrSave(true)
  }

  captureNextOrSave(isFirst: boolean): void {
    if (this.viewDate.getFullYear() !== +this.selectedYear + 1) {
      if (!isFirst)
        this.calendarPdf.addPage();
      this.capturePage();
      this.viewDate = new Date(this.viewDate.setMonth(this.viewDate.getMonth() + 1))
      this.updateEvents(this.allEvents, this.selectedYear, this.shouldPrintBirthdays, this.shouldPrintAnniversaries);
      let progress = Math.floor((this.calendarPdf.internal.getNumberOfPages() / 12) * 100);
      this.printProgress = progress;
    } else {
      this.calendarPdf.save();
      this.printProgress = 0;
    }
  }

  capturePage() {
    const calendarElement = document.getElementById('calendar-print-view');
    html2canvas(calendarElement).then(
      (canvas: any) => {
        let imgHeight = this.calendarPdf.internal.pageSize.getHeight() - 30;
        let imgWidth = canvas.width * imgHeight / canvas.height;
        if (imgHeight > 220) {
          imgHeight = 220;
          imgWidth = canvas.width / imgHeight * canvas.height;
        }
        const contentDataURL = canvas.toDataURL('image/png');
        let leftMargin = (this.calendarPdf.internal.pageSize.getWidth() - imgWidth) / 2;
        let topMargin = (this.calendarPdf.internal.pageSize.getHeight() - imgHeight) / 2;
        this.calendarPdf.addImage(contentDataURL, 'PNG', leftMargin, topMargin, imgWidth, imgHeight);
        this.captureNextOrSave(false);
      }
    )
  }
}
