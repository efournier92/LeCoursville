import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';

interface DatepickerData {
  initialDate: Date;
}

@Component({
  selector: 'app-calendar-datepicker-dialog',
  templateUrl: './calendar-datepicker-dialog.component.html',
  styleUrls: ['./calendar-datepicker-dialog.component.scss']
})
export class CalendarDatepickerDialogComponent implements OnInit {
  pickerDate: Date;
  selectedDate: Date;

  constructor(
    public dialogRef: MatDialogRef<CalendarDatepickerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DatepickerData
  ) {}

  ngOnInit(): void {
    this.pickerDate = this.data.initialDate || new Date();
    this.selectedDate = this.pickerDate;
  }

  onMonthSelected(date: Date, datepicker: any): void {
    this.selectedDate = date;
    datepicker.close();
  }

  confirm(): void {
    this.dialogRef.close(this.selectedDate);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}