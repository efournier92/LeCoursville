import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RecurringEvent } from 'src/app/interfaces/recurring-event';

export interface CalendarAgendaSheetData {
  events: RecurringEvent[];
  anchorDate: Date;
  selectedDay: Date;
}

@Component({
    selector: 'app-calendar-agenda-sheet',
    templateUrl: './calendar-agenda-sheet.component.html',
    styleUrls: ['./calendar-agenda-sheet.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class CalendarAgendaSheetComponent {
  selected: Date;
  selectedPersonId: string | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: CalendarAgendaSheetData,
    private dialogRef: MatDialogRef<CalendarAgendaSheetComponent>,
  ) {
    this.selected = data.selectedDay;
  }

  openPerson(id: string): void {
    this.selectedPersonId = id;
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
