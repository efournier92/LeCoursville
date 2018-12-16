import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { CalendarService } from '../calendar.service';
import { CalendarPrinterService } from '../calendar-printer/calendar-printer.service';
import { Calendar } from '../calendar';

@Component({
  selector: 'print-controls-prompt',
  templateUrl: 'print-controls-prompt.html',
})
export class PrintControlsPrompt {
  userName: string;
  viewYears: Array<string>;
  selectedYear: string;
  allCalendars: Array<Calendar>;
  birthdayChecked: boolean = true;
  anniversaryChecked: boolean = true;

  constructor(
    public dialogRef: MatDialogRef<PrintControlsPrompt>,
    private calendarService: CalendarService,
    private calendarPrintService: CalendarPrinterService,
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

  printFromFile(): void {
    const calendarToPrint = this.allCalendars.find(
      (calendar: Calendar) => {
        return calendar.year === this.selectedYear;
      }
    );
    window.open(calendarToPrint.url);
    // this.calendarPrintService.printFromFile(this.viewYear);
  }


  onNoClick(): void {
    this.dialogRef.close();
  }
}
