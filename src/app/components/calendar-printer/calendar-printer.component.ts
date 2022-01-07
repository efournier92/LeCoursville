import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CalendarService } from 'src/app/services/calendar.service';
import { RecurringEvent } from 'src/app/interfaces/RecurringEvent';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AnalyticsService } from 'src/app/services/analytics.service';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';

interface EventsData extends Object {
  events: RecurringEvent[];
}

@Component({
  selector: 'app-calendar-printer',
  templateUrl: './calendar-printer.component.html',
  styleUrls: ['./calendar-printer.component.scss']
})
export class CalendarPrinterComponent implements OnInit {
  user: User;
  activeDate: Date;
  allEvents: RecurringEvent[];
  events: RecurringEvent[];
  viewYears: number[];
  shouldPrintBirthdays = true;
  shouldPrintAnniversaries = true;
  selectedYear: number;
  printProgress = 0;
  printAction: string;
  pdf: jsPDF;

  constructor(
    public dialogRef: MatDialogRef<CalendarPrinterComponent>,
    private calendarService: CalendarService,
    @Inject(MAT_DIALOG_DATA) public data: EventsData,
    private authService: AuthService,
    private analyticsService: AnalyticsService,
  ) { }

  // LIFECYCLE HOOKS

  ngOnInit(): void {
    this.subscribeToUserObservable();
    this.initializeCalendar();
    this.analyticsService.logEvent('component_load_calendar_printer', {
      selectedYear: this.selectedYear,
    });
  }

  initializeCalendar() {
    this.allEvents = this.data.events;
    this.events = this.allEvents;
    this.viewYears = this.calendarService.getViewYears();
    this.selectedYear = new Date().getFullYear();
    this.activeDate = new Date('January 1, ' + this.selectedYear);
  }

  // SUBSCRIPTIONS

  private subscribeToUserObservable(): void {
    this.authService.userObservable.subscribe(
      (user: User) => this.user = user
    );
  }

  // PUBLIC METHODS

  async downloadPdf(): Promise<void> {
    this.analyticsService.logEvent('calendar_printer_pdf_download', {
      isTrue: `Birthdays: ${this.shouldPrintBirthdays}; Anniversaries: ${this.shouldPrintAnniversaries}`,
      userId: this.user?.id,
    });

    await this.preparePdf();
    this.pdf.save(`LeCoursville_Calendar_${this.selectedYear}.pdf`);
    this.finishPrintJob();
  }

  async printPdf() {
    this.analyticsService.logEvent('calendar_printer_pdf_download', {
      isTrue: `Birthdays: ${this.shouldPrintBirthdays}; Anniversaries: ${this.shouldPrintAnniversaries}`,
      userId: this.user?.id,
    });

    await this.preparePdf();
    this.pdf.autoPrint();
    window.open(this.pdf.output('bloburl').toString());
    this.finishPrintJob();
  }

  refreshPrintJob(): void {
    this.activeDate = new Date('January 1, ' + this.selectedYear);
    this.pdf = new jsPDF('l', 'in', 'letter');
    this.allEvents =
      this.calendarService
        .updateEvents(this.allEvents, this.selectedYear, this.shouldPrintBirthdays, this.shouldPrintAnniversaries);
  }

  // HELPER METHODS

  private async preparePdf(): Promise<void> {
    this.activeDate = new Date('January 1, ' + this.selectedYear);
    await this.createPdf();
  }

  private async createPdf() {
    this.refreshPrintJob();

    for (let i = 0; i < 12; i++) {
      await this.captureNextMonth();
    }

    this.finishPrintJob();
  }

  private async captureNextMonth(): Promise<void> {
    this.prepareNextPage();
    await this.capturePage();
  }

  private addPage(): void {
    this.pdf.addPage();
  }

  private prepareNextPage(): void {
    if (!this.isFirstMonth()) {
      this.addPage();
    }
    this.updateCalendarMonth();
    this.events =
      this.calendarService.updateEvents(this.allEvents, this.selectedYear, this.shouldPrintBirthdays, this.shouldPrintAnniversaries);
    this.updateProgressBar();
  }

  private isFirstMonth(): boolean {
    return this.activeDate.getMonth() === 0;
  }

  private finishPrintJob() {
    this.printProgress = 0;
    this.dialogRef.close();
  }

  private updateCalendarMonth() {
    this.activeDate = new Date(this.activeDate.setMonth(this.activeDate.getMonth() + 1));
  }

  private updateProgressBar() {
    this.printProgress = Math.floor((this.pdf.getNumberOfPages() / 12) * 100);
  }

  private async capturePage(): Promise<void> {
    const calendarElement = document.querySelector('.calendar-print-view');

    await html2canvas(document.querySelector('.calendar-print-view'), {scale: 2}).then(
      (canvas: any) => {
        const imgWidth = 10;
        const imgHeight = 8;

        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const leftMargin = 0.475;
        const topMargin = 0.6;

        this.pdf.addImage(imgData, 'JPEG', leftMargin, topMargin, imgWidth, imgHeight, '', 'FAST');
      }
    );
  }
}
