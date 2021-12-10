import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { RecurringEvent } from 'src/app/services/calendar.service';
import { CalendarService } from 'src/app/services/calendar.service';
import jsPDF from 'jspdf';
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
  printAction: string;
  pdf: jsPDF = new jsPDF('l', 'in', 'letter');

  constructor(
    public dialogRef: MatDialogRef<CalendarPrinterComponent>,
    private calendarService: CalendarService,
    @Inject(MAT_DIALOG_DATA) public data: EventsData,
  ) {
    this.viewYears = this.calendarService.getViewYears();
    this.selectedYear = new Date().getFullYear().toString();
  }

  ngOnInit(): void {
    this.allEvents = this.data.events;
    this.events = this.allEvents;
    this.viewDate = new Date('January 1, ' + this.selectedYear);
  }

  downloadOrPrint(action: string): void {
    this.printAction = action;
    this.viewDate = new Date('January 1, ' + this.selectedYear);
    this.updateEvents(this.allEvents, this.selectedYear, this.shouldPrintBirthdays, this.shouldPrintAnniversaries);
    this.captureNextOrSave(true);
  }

  refreshPrintCalendar(): void {
    this.viewDate = new Date('January 1, ' + this.selectedYear);
    this.updateEvents(this.allEvents, this.selectedYear, this.shouldPrintBirthdays, this.shouldPrintAnniversaries);
  }

  captureNextOrSave(isFirst: boolean): void {
    if (this.viewDate.getFullYear() !== +this.selectedYear + 1) {
      if (!isFirst)
        this.pdf.addPage();
      this.capturePage();
      this.viewDate = new Date(this.viewDate.setMonth(this.viewDate.getMonth() + 1))
      this.updateEvents(this.allEvents, this.selectedYear, this.shouldPrintBirthdays, this.shouldPrintAnniversaries);
      let progress = Math.floor((this.pdf.getNumberOfPages() / 12) * 100);
      this.printProgress = progress;
    } else {
      this.printProgress = 0;
      if (this.printAction === 'print') {
        this.pdf.autoPrint();
        // this.calendarPdf.save();
        // window.open(this.calendarPdf.output('bloburl'));
        // window.open(this.calendarPdf.output('bloburl'), '_blank');
        // window.open(this.calendarPdf.output())
        // this.calendarPdf.output('dataurlnewwindow');;
        window.open(this.pdf.output('bloburl').toString());
      } else if (this.printAction === 'download') {
        this.pdf.save(`LeCoursville_Calendar_${this.selectedYear}.pdf`)
      }
      this.dialogRef.close();
    }
  }

  capturePage(): void {
    const calendarElement = document.getElementById('calendar-print-view');

    html2canvas(calendarElement).then(
      (canvas: any) => {
        const imgWidth = 10;
        const imgHeight = 8;

        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        let leftMargin = 0.45;
        let topMargin = 0.25;

        this.pdf.addImage(imgData, 'JPEG', leftMargin, topMargin, imgWidth, imgHeight, '', 'FAST');
        this.captureNextOrSave(false);
      }
    )
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
}
