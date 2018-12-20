import { Component, OnInit, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { CalendarService, RecurringEvent } from '../calendar.service';

export interface DialogData {
  animal: string;
  name: string;
}

@Component({
  selector: 'app-calendar-dialog',
  templateUrl: './calendar-dialog.component.html',
  styleUrls: ['./calendar-dialog.component.scss']
})
export class CalendarDialogComponent implements OnInit {
  eventTypes: string[] = [
    'birth',
    'anniversary',
  ];

  constructor(
    public dialogRef: MatDialogRef<CalendarDialogComponent>,
    private calendarService: CalendarService,
    @Inject(MAT_DIALOG_DATA) public data: RecurringEvent,
  ) { }

  ngOnInit(): void { }

  deleteEvent(event: RecurringEvent): void {
    this.calendarService.deleteCalendarEvent(event);
    this.dialogRef.close();
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
