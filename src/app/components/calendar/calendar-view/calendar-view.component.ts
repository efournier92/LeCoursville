import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { RecurringEvent, CalendarService } from '../calendar.service';
import { CalendarView } from 'angular-calendar';
import { MatDialog } from '@angular/material';
import { CalendarDialogComponent } from '../calendar-dialog/calendar-dialog.component';

@Component({
  selector: 'app-calendar-view',
  templateUrl: './calendar-view.component.html',
  styleUrls: ['./calendar-view.component.scss']
})
export class CalendarViewComponent implements OnInit {
  view: string = CalendarView.Month;
  @Input()
  viewDate: Date;
  @Input()
  events: RecurringEvent[];
  @Output()
  refreshView: EventEmitter<Event> = new EventEmitter();

  constructor(
    public dialog: MatDialog,
    private calendarService: CalendarService,
  ) { }

  ngOnInit(): void { }

  refreshCalendar(): void {
    this.refreshView.emit(event);
  }

  openDialog(event): void {
    const dialogRef = this.dialog.open(CalendarDialogComponent, {
      width: '30%',
      data: event,
    });

    dialogRef.afterClosed().subscribe(
      (result: RecurringEvent) => {
        if (!result) return;
        let event = result;
        if (event.id) {
          this.calendarService.updateCalendarEvent(event);
        } else {
          this.calendarService.addCalendarEvent(event);
        }
        this.refreshCalendar();
      }
    );
  }
}
