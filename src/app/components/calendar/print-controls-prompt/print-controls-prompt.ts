import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { CalendarService } from '../calendar.service';
import { CalendarPrinterService } from '../calendar-printer/calendar-printer.service';

@Component({
  selector: 'print-controls-prompt',
  templateUrl: 'print-controls-prompt.html',
})
export class PrintControlsPrompt {
  userName: string;
  viewYears: Array<string>;
  viewYear: string;
  birthdayChecked: boolean = true;
  anniversaryChecked: boolean = true;

  constructor(
    public dialogRef: MatDialogRef<PrintControlsPrompt>,
    private calendarService: CalendarService,
    private calendarPrintService: CalendarPrinterService,
    @Inject(MAT_DIALOG_DATA) public data: string,
  ) {
    this.viewYears = this.calendarService.getViewYears();
    this.viewYear = new Date().getFullYear().toString();
  }

  printFromFile(year): void {
    window.open("https://firebasestorage.googleapis.com/v0/b/lecoursville.appspot.com/o/calendars%2F2018.pdf?alt=media&token=0a4c6b65-6cb8-4f7b-bc8e-a63ad9886904")
    // this.calendarPrintService.printFromFile(this.viewYear);
  }

  onNoClick(): void {
    this.dialogRef.close();
  }
}
