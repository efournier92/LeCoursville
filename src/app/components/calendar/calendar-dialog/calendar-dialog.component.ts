import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CalendarService, RecurringEvent } from 'src/app/services/calendar.service';
import { ConfirmPromptService } from 'src/app/services/confirm-prompt.service';

export interface DialogData {
  header: string,
  message: string,
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
    private confirmPrompt: ConfirmPromptService,
    @Inject(MAT_DIALOG_DATA) public data: RecurringEvent,
  ) { }

  ngOnInit(): void { }

  deleteEvent(event: RecurringEvent): void {
    const dialogRef = this.confirmPrompt.openDialog(
      "Are You Sure?",
      "Do you want to delete this event from LeCoursville?",
    );
    dialogRef.afterClosed().subscribe(
      (confirmedAction: boolean) => {
        if (confirmedAction) {
          this.calendarService.deleteCalendarEvent(event);
          this.dialogRef.close();
        }
      }
    )
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
