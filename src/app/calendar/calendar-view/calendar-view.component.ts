import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { RecurringEvent, CalendarService } from '../calendar.service';
import { CalendarView } from 'angular-calendar';
import { MatDialog } from '@angular/material/dialog';
import { CalendarDialogComponent } from '../calendar-dialog/calendar-dialog.component';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../auth/user';

@Component({
  selector: 'app-calendar-view',
  templateUrl: './calendar-view.component.html',
  styleUrls: ['./calendar-view.component.scss']
})
export class CalendarViewComponent implements OnInit {
  user: User;
  view: string = CalendarView.Month;
  @Input()
  viewDate: Date;
  @Input()
  events: RecurringEvent[];
  @Input()
  isPrintView: boolean;
  @Output()
  refreshView: EventEmitter<Event> = new EventEmitter();

  constructor(
    public dialog: MatDialog,
    private auth: AuthService,
    private calendarService: CalendarService,
  ) { }

  ngOnInit(): void {
    this.auth.userObservable.subscribe(
      (user: User) => {
        this.user = user;
      }
    )
  }

  refreshCalendar(): void {
    this.refreshView.emit(event);
  }

  openDialog(event: RecurringEvent): void {
    if (!this.user || !this.user.roles || this.user.roles.admin !== true)
      return;

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
