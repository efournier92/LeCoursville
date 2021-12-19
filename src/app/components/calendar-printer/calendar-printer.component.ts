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
  activeDate: Date;
  allEvents: RecurringEvent[];
  events: RecurringEvent[];
  viewYears: Array<string>;
  shouldPrintBirthdays: boolean = true;
  shouldPrintAnniversaries: boolean = true;
  selectedYear: number;
  printProgress: number = 0;
  printAction: string;
  pdf: jsPDF;

  constructor(
    public dialogRef: MatDialogRef<CalendarPrinterComponent>,
    private calendarService: CalendarService,
    @Inject(MAT_DIALOG_DATA) public data: EventsData,
  ) {
    this.viewYears = this.calendarService.getViewYears();
    this.selectedYear = new Date().getFullYear();
  }

  ngOnInit(): void {
    this.allEvents = this.data.events;
    this.events = this.allEvents;
    this.activeDate = new Date('January 1, ' + this.selectedYear);
  }

  downloadOrPrint(): void {
    this.createPdf();
  }

  downloadPdf() {
    this.pdf.save(`LeCoursville_Calendar_${this.selectedYear}.pdf`)
  }

  printPdf() {
    this.pdf.autoPrint();
    window.open(this.pdf.output('bloburl').toString());
  }

  createPdf() {
    this.refreshPrintJob();
    this.captureNextPage();
  }

  refreshPrintJob() {
    this.activeDate = new Date('January 1, ' + this.selectedYear);
    this.pdf = new jsPDF('l', 'in', 'letter');
    this.updateEvents(this.allEvents, this.selectedYear, this.shouldPrintBirthdays, this.shouldPrintAnniversaries);
  }

  addPage() {
    this.pdf.addPage();
  }

  async captureNextPage() {
    if (this.shouldFinishPrintJob()) {
      this.finishPrintJob();
      return;
    }
    this.prepareNextPage();
    await this.capturePage();
  }

  prepareNextPage() {
    this.updateCalendarMonth();
    this.updateEvents(this.allEvents, this.selectedYear, this.shouldPrintBirthdays, this.shouldPrintAnniversaries);
    this.updateProgressBar();
    if (this.shouldAddPage())
      this.addPage();
  }

  finishPrintJob() {
    this.printProgress = 0;
    this.dialogRef.close();
    this.downloadPdf();
  }

  shouldFinishPrintJob(): boolean {
    // return this.pdf.getNumberOfPages() >= 12;
    return this.activeDate.getFullYear() !== this.selectedYear;
  }

  shouldAddPage(): boolean {
    return this.activeDate.getMonth() >= 1;
  }

  updateCalendarMonth() {
    this.activeDate = new Date(this.activeDate.setMonth(this.activeDate.getMonth() + 1))
  }

  updateProgressBar() {
    this.printProgress = Math.floor((this.pdf.getNumberOfPages() / 12) * 100);
  }

  async capturePage(): Promise<void> {
    const calendarElement = document.getElementById('calendar-print-view');

    await html2canvas(calendarElement, {scale: 2}).then(
      (canvas: any) => {
        const imgWidth = 10;
        const imgHeight = 8;

        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        let leftMargin = 0.45;
        let topMargin = 0.25;

        this.pdf.addImage(imgData, 'JPEG', leftMargin, topMargin, imgWidth, imgHeight, '', 'FAST');
        this.captureNextPage();
      }
    )
  }

  updateEvents(events: RecurringEvent[], year: number, birthdays: boolean, anniversaries: boolean): void {
    if (!events) return;
    this.events = new Array<RecurringEvent>();
    for (const event of events) {
      if (event.type === 'birth' && birthdays === false)
        continue;
      if (event.type === 'anniversary' && anniversaries === false)
        continue;
      let date = new Date(event.date);
      date.setFullYear(year);
      event.start = date;
      event.date = new Date(event.date);
      this.events.push(event);
    }
  }
}
